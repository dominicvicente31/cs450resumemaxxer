import json
from io import BytesIO
from pathlib import Path

from docx import Document

from resume_maxxer import docx_export, parser, similarity
from resume_maxxer.models import Resume

EXAMPLE = Path(__file__).parent.parent / "evaluation" / "synthetic" / "example_01.json"


def load_example() -> Resume:
    return Resume.from_dict(json.loads(EXAMPLE.read_text(encoding="utf-8"))["resume"])


def test_resume_dict_round_trip():
    resume = load_example()
    assert Resume.from_dict(resume.to_dict()) == resume


def test_match_score_ranks_related_text_higher():
    job = "Python developer building REST APIs with SQL databases"
    related = "Built REST APIs in Python backed by a SQL database"
    unrelated = "Served coffee and managed the cash register"
    assert similarity.match_score(related, job) > similarity.match_score(unrelated, job)
    assert similarity.match_score("", job) == 0.0


def test_missing_keywords_only_lists_absent_terms():
    missing = similarity.missing_keywords("Python and SQL", "Python, SQL, and Docker")
    assert missing == ["docker"]


def test_docx_export_can_be_read_back():
    resume = load_example()
    data = docx_export.build_docx(resume)
    text = parser.extract_text("resume.docx", data)
    assert resume.contact.name in text
    assert "used flask and a sqlite database" in text
    assert Document(BytesIO(data)).paragraphs
