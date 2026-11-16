"""Headless smoke tests of the Streamlit app (no browser, no API key)."""

from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

from resume_maxxer import llm

APP_PATH = Path(__file__).parent.parent / "app.py"

DRAFT = """Sample Student
sample.student@example.edu | 555-0100

EXPERIENCE
Tutor, Campus Learning Center    Jan 2025 - Present
- helped students with intro programming homework
- made practice problems in python

SKILLS
Python, SQL
"""


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setattr(llm, "is_configured", lambda: False)
    app = AppTest.from_file(str(APP_PATH), default_timeout=30).run()
    assert not app.exception
    app.sidebar.text_area[0].set_value("Python tutor with SQL and Docker experience")
    return app


def test_questionnaire_builds_a_downloadable_resume(app):
    app.text_input(key="contact_name").set_value("Sample Student")
    app.text_input(key="exp_title_0").set_value("Tutor")
    app.text_area(key="exp_facts_0").set_value("taught python to 10 students\nwrote sql exercises")
    app.button[0].click().run()

    assert not app.exception
    assert not app.error
    assert app.text_area(key="create_exp_bullets_0").value.startswith("taught python")
    assert app.get("download_button")


def test_questionnaire_reports_missing_fields(app):
    app.button[0].click().run()
    assert not app.exception
    assert [error.value for error in app.error] == [
        "Enter your full name.",
        "Describe at least one experience or project.",
    ]


def test_pasted_draft_is_rebuilt_in_the_template(app):
    app.text_area(key="improve_pasted").set_value(DRAFT).run()
    rebuild = next(button for button in app.button if "rebuild" in button.label.lower())
    rebuild.click().run()

    assert not app.exception
    assert "made practice problems in python" in app.text_area(key="improve_exp_bullets_0").value
    assert app.get("download_button")
