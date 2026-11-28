"""Tests for the API backend: alignment grading, the evaluation pipeline,
and the (stateless) HTTP routes. No network or API key needed."""

import json

import pytest
from fastapi.testclient import TestClient

from evaluation import run_eval
from resume_maxxer import api, llm
from resume_maxxer.evaluate import evaluate

JOB = "Data analyst intern. Write SQL queries, build Tableau dashboards, and present findings."
RESUME_TEXT = """Sam Rivera
sam@example.edu

EXPERIENCE
Student Assistant, University Library
• organized circulation records
• used Excel pivot tables

SKILLS
SQL, Excel
"""

ALIGNMENT_REPLY = {
    "scorable": True,
    "score": 72,
    "matched_keywords": ["SQL", "Excel"],
    "missing_keywords": ["Tableau"],
    "summary": "Good SQL basics; no dashboard work shown.",
}


@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.setattr(llm, "is_configured", lambda: False)


@pytest.fixture
def fake_llm(monkeypatch):
    """Answers each prompt type with a canned reply, chosen by its schema."""
    replies = {"alignment": json.dumps(ALIGNMENT_REPLY)}

    def fake_complete(prompt, system=llm.SYSTEM_PROMPT, schema=None):
        if schema is llm._ALIGNMENT_SCHEMA:
            return replies["alignment"]
        if schema is llm._BULLETS_SCHEMA:
            return json.dumps({"bullets": ["Organized 2 years of records", "Built Excel pivot tables"]})
        if schema is llm._RESUME_SCHEMA:
            raise llm.LLMError("force the heuristic parser")
        return "- Add numbers."

    monkeypatch.setattr(llm, "is_configured", lambda: True)
    monkeypatch.setattr(llm, "_complete", fake_complete)
    return replies


# --- alignment grading ---


def test_alignment_score_from_model(fake_llm):
    result = llm.score_alignment(RESUME_TEXT, JOB)
    assert result["score"] == 72
    assert result["band"] == "Strong"
    assert result["missingKeywords"] == ["Tableau"]


def test_alignment_is_minus_one_without_key(no_llm):
    assert llm.score_alignment(RESUME_TEXT, JOB)["score"] == llm.UNSCORABLE


def test_alignment_is_minus_one_for_short_job_description(fake_llm):
    result = llm.score_alignment(RESUME_TEXT, "Intern wanted.")
    assert result["score"] == llm.UNSCORABLE
    assert "50 characters" in result["summary"]


@pytest.mark.parametrize(
    "reply",
    [
        json.dumps({**ALIGNMENT_REPLY, "scorable": False, "score": -1, "summary": "Not a resume."}),
        "not json",
        json.dumps({"score": 50}),
    ],
)
def test_alignment_is_minus_one_when_model_cannot_grade(fake_llm, reply):
    fake_llm["alignment"] = reply
    assert llm.score_alignment(RESUME_TEXT, JOB)["score"] == llm.UNSCORABLE


def test_alignment_is_minus_one_on_llm_error(fake_llm, monkeypatch):
    def failing(*args, **kwargs):
        raise llm.LLMError("rate limited")

    monkeypatch.setattr(llm, "_complete", failing)
    result = llm.score_alignment(RESUME_TEXT, JOB)
    assert result["score"] == llm.UNSCORABLE and "rate limited" in result["summary"]


def test_placeholder_key_does_not_count_as_configured(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", llm.PLACEHOLDER_KEY)
    assert not llm.is_configured()


# --- pipeline ---


def test_evaluate_without_llm_still_scores(no_llm):
    evaluation, resume = evaluate(RESUME_TEXT, JOB)
    assert evaluation["alignment"]["score"] == llm.UNSCORABLE
    assert 0 <= evaluation["wordingMatch"]["score"] <= 1
    assert evaluation["entries"][0]["bullets"][0]["original"] == "organized circulation records"
    assert any("API key" in w for w in evaluation["warnings"])


def test_evaluate_flags_invented_numbers(fake_llm):
    evaluation, _ = evaluate(RESUME_TEXT, JOB)
    bullets = evaluation["entries"][0]["bullets"]
    assert bullets[0]["revised"] == "Organized 2 years of records"
    assert "2" in bullets[0]["flags"]
    assert evaluation["alignment"]["score"] == 72


def test_evaluate_rejects_short_job_description(no_llm):
    with pytest.raises(ValueError, match="50 characters"):
        evaluate(RESUME_TEXT, "too short")


def test_run_eval_summary_skips_unscorable_alignment():
    rows = [
        {"case": "a", "alignment_after": 80, "clarity_after": 0.5},
        {"case": "b", "alignment_after": -1, "clarity_after": 1.0},
    ]
    assert run_eval.summarize(rows) == {"alignment_after": 80, "clarity_after": 0.75}


# --- HTTP API ---


@pytest.fixture
def client(no_llm):
    return TestClient(api.app)


def upload(client, name="resume.txt", data=RESUME_TEXT.encode(), job=JOB, **form):
    return client.post(
        "/api/evaluate", files={"file": (name, data)}, data={"job_description": job, **form}
    )


def test_api_evaluate_returns_everything_the_browser_stores(client):
    response = upload(client)
    assert response.status_code == 200
    body = response.json()
    assert body["fileName"] == "resume.txt"
    assert body["resumeText"] == RESUME_TEXT
    assert body["revisedResume"]["experience"][0]["facts"] == [
        "organized circulation records", "used Excel pivot tables",
    ]  # fmt: skip
    assert "alignment" in body["evaluation"]


def test_api_reevaluates_saved_resume_text(client):
    response = client.post(
        "/api/evaluate",
        data={"job_description": JOB, "resume_text": RESUME_TEXT, "file_name": "primary.docx"},
    )
    assert response.status_code == 200
    assert response.json()["fileName"] == "primary.docx"


def test_api_needs_a_file_or_text(client):
    assert client.post("/api/evaluate", data={"job_description": JOB}).status_code == 422


def test_api_rejects_bad_file_with_422(client):
    assert upload(client, name="resume.png").status_code == 422
    assert upload(client, data=b"   ").status_code == 422


def test_api_rejects_short_job_description_with_400(client):
    assert upload(client, job="short").status_code == 400


def test_api_builds_docx_from_revised_resume(client):
    revised = upload(client).json()["revisedResume"]
    response = client.post("/api/docx", json={"resume": revised})
    assert response.status_code == 200 and response.content[:2] == b"PK"
    assert client.post("/api/docx", json={"resume": {"contact": "bad"}}).status_code == 400


def test_api_status_never_returns_the_key(client):
    body = client.get("/api/status").json()
    assert body["minJobDescriptionChars"] == 50
    assert not any("key" in field.lower() for field in body)


def test_api_allows_the_vite_dev_origin(client):
    response = client.get("/api/status", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_api_upload_limit_is_5_gb():
    assert api.MAX_UPLOAD_BYTES == 5 * 1024**3
