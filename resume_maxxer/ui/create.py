"""Tab 1: create a resume from a questionnaire."""

from __future__ import annotations

import json

import streamlit as st

from resume_maxxer import llm
from resume_maxxer.models import Contact, Education, Entry, Resume
from resume_maxxer.ui.common import call_llm, lines, review_and_export, seed_bullet_editors

MAX_EDUCATION, MAX_ENTRIES = 4, 6


def _education_inputs(i: int) -> Education:
    st.markdown(f"**Education {i + 1}**")
    left, right = st.columns(2)
    return Education(
        school=left.text_input("School", key=f"edu_school_{i}"),
        degree=right.text_input("Degree and major", key=f"edu_degree_{i}"),
        dates=left.text_input("Dates", key=f"edu_dates_{i}", placeholder="Aug 2023 - May 2027"),
        details=right.text_input("GPA, coursework, honors", key=f"edu_details_{i}"),
    )


def _entry_inputs(kind: str, i: int) -> Entry:
    """Inputs for one experience or project. `kind` is "exp" or "proj"."""
    is_project = kind == "proj"
    st.markdown(f"**{'Project' if is_project else 'Experience'} {i + 1}**")
    left, right = st.columns(2)
    return Entry(
        title=left.text_input("Project name" if is_project else "Role", key=f"{kind}_title_{i}"),
        organization=right.text_input(
            "Course or context" if is_project else "Organization", key=f"{kind}_org_{i}"
        ),
        dates=left.text_input("Dates", key=f"{kind}_dates_{i}"),
        facts=lines(
            st.text_area(
                "What did you do? One fact per line, plain language is fine. "
                "Include numbers where you have them.",
                key=f"{kind}_facts_{i}",
            )
        ),
    )


def _fill_form(resume: Resume) -> None:
    """Put a saved resume's values into the questionnaire widgets."""
    state = st.session_state
    state["n_edu"] = min(max(len(resume.education), 1), MAX_EDUCATION)
    state["n_exp"] = min(len(resume.experience), MAX_ENTRIES)
    state["n_proj"] = min(len(resume.projects), MAX_ENTRIES)
    state["contact_name"] = resume.contact.name
    state["contact_email"] = resume.contact.email
    state["contact_phone"] = resume.contact.phone
    state["contact_links"] = "\n".join(resume.contact.links)
    state["skills"] = ", ".join(resume.skills)
    for i, edu in enumerate(resume.education[:MAX_EDUCATION]):
        state[f"edu_school_{i}"] = edu.school
        state[f"edu_degree_{i}"] = edu.degree
        state[f"edu_dates_{i}"] = edu.dates
        state[f"edu_details_{i}"] = edu.details
    for kind, entries in (("exp", resume.experience), ("proj", resume.projects)):
        for i, entry in enumerate(entries[:MAX_ENTRIES]):
            state[f"{kind}_title_{i}"] = entry.title
            state[f"{kind}_org_{i}"] = entry.organization
            state[f"{kind}_dates_{i}"] = entry.dates
            state[f"{kind}_facts_{i}"] = "\n".join(entry.facts)


def _load_saved_answers() -> None:
    with st.expander("Load saved answers"):
        uploaded = st.file_uploader("resume_answers.json from an earlier session", type=["json"])
    if uploaded is None or st.session_state.get("loaded_file_id") == uploaded.file_id:
        return
    st.session_state["loaded_file_id"] = uploaded.file_id
    try:
        resume = Resume.from_dict(json.loads(uploaded.getvalue()))
    except (ValueError, TypeError, AttributeError):
        st.error("That file is not a Resume Maxxer answers file.")
        return
    _fill_form(resume)
    st.rerun()


def _validate(resume: Resume) -> list[str]:
    problems = []
    if not resume.contact.name.strip():
        problems.append("Enter your full name.")
    if not any(entry.facts for entry in resume.experience + resume.projects):
        problems.append("Describe at least one experience or project.")
    for entry in resume.experience + resume.projects:
        if entry.facts and not entry.title.strip():
            problems.append("Every experience and project you describe needs a role or name.")
            break
    return problems


def render(job_description: str) -> None:
    st.subheader("Create a resume from a questionnaire")
    _load_saved_answers()

    # Counts live outside the form so changing them redraws the form.
    for key, default in (("n_edu", 1), ("n_exp", 1), ("n_proj", 1)):
        st.session_state.setdefault(key, default)
    counts = st.columns(3)
    n_edu = counts[0].number_input("Education entries", 1, MAX_EDUCATION, key="n_edu")
    n_exp = counts[1].number_input("Experience entries", 0, MAX_ENTRIES, key="n_exp")
    n_proj = counts[2].number_input("Project entries", 0, MAX_ENTRIES, key="n_proj")

    with st.form("questionnaire"):
        st.markdown("**Contact**")
        left, right = st.columns(2)
        contact = Contact(
            name=left.text_input("Full name", key="contact_name"),
            email=right.text_input("Email", key="contact_email"),
            phone=left.text_input("Phone", key="contact_phone"),
            links=lines(
                st.text_area(
                    "Links (LinkedIn, GitHub, ...), one per line", height=68, key="contact_links"
                )
            ),
        )
        education = [_education_inputs(i) for i in range(n_edu)]
        experience = [_entry_inputs("exp", i) for i in range(n_exp)]
        projects = [_entry_inputs("proj", i) for i in range(n_proj)]
        skills = st.text_input("Skills, comma separated", key="skills")
        submitted = st.form_submit_button("Build resume")

    if submitted:
        resume = Resume(
            contact=contact,
            education=[edu for edu in education if edu.school.strip()],
            experience=[entry for entry in experience if entry.title.strip() or entry.facts],
            projects=[entry for entry in projects if entry.title.strip() or entry.facts],
            skills=[skill.strip() for skill in skills.split(",") if skill.strip()],
        )
        problems = _validate(resume)
        for problem in problems:
            st.error(problem)
        if not problems:
            for entry in resume.experience + resume.projects:
                entry.bullets = call_llm(
                    llm.draft_bullets, entry, job_description, fallback=list(entry.facts)
                )
            st.session_state["resume"] = resume
            seed_bullet_editors(resume, "create")

    resume = st.session_state.get("resume")
    if resume is None:
        return

    st.divider()
    if not llm.is_configured():
        st.info("LLM not configured: bullets start as your facts, unchanged. See the README.")
    review_and_export(resume, job_description, "create")
