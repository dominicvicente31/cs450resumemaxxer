import json
from io import BytesIO
from pathlib import Path

import pytest
from docx import Document

from resume_maxxer import docx_export, factcheck, llm, metrics, parser, similarity, train
from resume_maxxer.models import Entry, Resume

EXAMPLE = Path(__file__).parent.parent / "evaluation" / "synthetic" / "example_01.json"


def load_example() -> Resume:
    return Resume.from_dict(json.loads(EXAMPLE.read_text(encoding="utf-8"))["resume"])


@pytest.fixture
def fake_llm(monkeypatch):
    """Pretend an API key is set and capture prompts instead of calling out."""
    prompts = []
    replies = {"text": json.dumps({"bullets": ["Built a planner", "  ", "Led 3 teammates"]})}

    def fake_complete(prompt, system=llm.SYSTEM_PROMPT, schema=None):
        prompts.append(prompt)
        return replies["text"]

    monkeypatch.setattr(llm, "is_configured", lambda: True)
    monkeypatch.setattr(llm, "_complete", fake_complete)
    return prompts, replies


@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.setattr(llm, "is_configured", lambda: False)


def test_resume_dict_round_trip():
    resume = load_example()
    assert Resume.from_dict(resume.to_dict()) == resume


# --- similarity ---


def test_match_score_ranks_related_text_higher():
    job = "Python developer building REST APIs with SQL databases"
    related = "Built REST APIs in Python backed by a SQL database"
    unrelated = "Served coffee and managed the cash register"
    assert similarity.match_score(related, job) > similarity.match_score(unrelated, job)
    assert similarity.match_score("", job) == 0.0


def test_synonyms_count_as_a_match():
    assert similarity.match_score("Wrote JS and ML code", "javascript machine learning") > 0.5


def test_missing_keywords_only_lists_absent_terms():
    missing = similarity.missing_keywords("Python and SQL", "Python, SQL, and Docker")
    assert missing == ["docker"]


def test_trained_vectorizer_can_be_saved_and_loaded(tmp_path):
    postings = ["python developer sql", "java developer sql", "python data analyst"]
    path = train.train(postings, tmp_path / "tfidf.joblib")
    vectorizer = similarity.joblib.load(path)
    assert "python" in vectorizer.vocabulary_
    assert "analyst" not in vectorizer.vocabulary_  # appears in only one posting


# --- factcheck and metrics ---


def test_factcheck_flags_invented_numbers_and_tools():
    facts = ["made a website with flask", "worked with three teammates"]
    assert factcheck.unsupported_claims("Built a Flask website with 3 teammates", facts) == []
    flagged = factcheck.unsupported_claims("Built a Django site serving 500 users", facts)
    assert flagged == ["500", "Django"]


def test_clarity_prefers_a_strong_bullet():
    weak = "I was responsible for helping with stuff"
    strong = "Tutored 10 students a week in introductory Python programming"
    assert metrics.bullet_issues(strong) == []
    assert metrics.bullet_clarity(strong) > metrics.bullet_clarity(weak)


# --- docx and parsing ---


def test_docx_export_parses_back_to_the_same_resume(no_llm):
    resume = load_example()
    data = docx_export.build_docx(resume)
    assert Document(BytesIO(data)).paragraphs

    parsed = parser.parse_resume(parser.extract_text("resume.docx", data))
    assert parsed.contact == resume.contact
    assert parsed.education == resume.education
    assert parsed.skills == resume.skills
    for original, found in zip(resume.experience + resume.projects, parsed.experience + parsed.projects):
        assert (found.title, found.organization, found.dates) == (
            original.title,
            original.organization,
            original.dates,
        )
        assert found.facts == original.facts


def test_extract_text_reads_docx_tables():
    document = Document()
    document.add_table(rows=1, cols=2).rows[0].cells[1].text = "inside a table"
    buffer = BytesIO()
    document.save(buffer)
    assert "inside a table" in parser.extract_text("draft.docx", buffer.getvalue())


def test_extract_text_rejects_unknown_types():
    with pytest.raises(ValueError):
        parser.extract_text("resume.pages", b"")


# --- llm (no network) ---


def test_without_api_key_bullets_pass_through(no_llm):
    entry = Entry(title="Tutor", facts=["taught python"])
    assert llm.draft_bullets(entry) == ["taught python"]
    assert llm.revise_bullets(["taught python"]) == ["taught python"]


def test_draft_bullets_sends_facts_and_parses_reply(fake_llm):
    prompts, _ = fake_llm
    entry = Entry(title="Course Planner", facts=["made a planner", "3 teammates"])
    bullets = llm.draft_bullets(entry, "Python intern")
    assert bullets == ["Built a planner", "Led 3 teammates"]
    assert "made a planner" in prompts[0] and "Python intern" in prompts[0]


def test_malformed_llm_reply_raises_llm_error(fake_llm):
    _, replies = fake_llm
    replies["text"] = "not json"
    with pytest.raises(llm.LLMError):
        llm.revise_bullets(["taught python"])


def test_parse_resume_uses_llm_structure_when_configured(fake_llm):
    _, replies = fake_llm
    replies["text"] = json.dumps(
        {
            "contact": {"name": "Sam", "email": "", "phone": "", "links": []},
            "education": [],
            "experience": [
                {"title": "Tutor", "organization": "", "dates": "", "bullets": ["taught python"]}
            ],
            "projects": [],
            "skills": ["Python"],
        }
    )
    resume = parser.parse_resume("Sam\nTutor\n- taught python")
    assert resume.contact.name == "Sam"
    assert resume.experience[0].facts == ["taught python"]
