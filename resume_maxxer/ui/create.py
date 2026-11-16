"""Tab 1: create a resume from a questionnaire."""

from __future__ import annotations

import streamlit as st

from resume_maxxer import docx_export, llm
from resume_maxxer.models import Contact, Education, Entry, Resume
from resume_maxxer.ui.common import show_job_match


def _lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


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
        facts=_lines(
            st.text_area(
                "What did you do? One fact per line, plain language is fine.",
                key=f"{kind}_facts_{i}",
            )
        ),
    )


def _preview(resume: Resume) -> None:
    # TODO: nicer preview that mirrors the DOCX layout; let the user edit or
    # reject individual bullets before export.
    st.markdown(f"### {resume.contact.name}")
    for label, entries in (("Experience", resume.experience), ("Projects", resume.projects)):
        if entries:
            st.markdown(f"#### {label}")
        for entry in entries:
            st.markdown(f"**{entry.title}**, {entry.organization} ({entry.dates})")
            for bullet in entry.bullets:
                st.markdown(f"- {bullet}")


def render(job_description: str) -> None:
    st.subheader("Create a resume from a questionnaire")

    # Counts live outside the form so changing them redraws the form.
    counts = st.columns(3)
    n_edu = counts[0].number_input("Education entries", 1, 4, 1)
    n_exp = counts[1].number_input("Experience entries", 0, 6, 1)
    n_proj = counts[2].number_input("Project entries", 0, 6, 1)

    with st.form("questionnaire"):
        st.markdown("**Contact**")
        left, right = st.columns(2)
        contact = Contact(
            name=left.text_input("Full name"),
            email=right.text_input("Email"),
            phone=left.text_input("Phone"),
            links=_lines(st.text_area("Links (LinkedIn, GitHub, ...), one per line", height=68)),
        )
        education = [_education_inputs(i) for i in range(n_edu)]
        experience = [_entry_inputs("exp", i) for i in range(n_exp)]
        projects = [_entry_inputs("proj", i) for i in range(n_proj)]
        skills = st.text_input("Skills, comma separated")
        submitted = st.form_submit_button("Build resume")

    if submitted:
        # TODO: validate required fields (name, at least one entry with facts).
        resume = Resume(
            contact=contact,
            education=education,
            experience=experience,
            projects=projects,
            skills=[s.strip() for s in skills.split(",") if s.strip()],
        )
        for entry in resume.experience + resume.projects:
            entry.bullets = llm.draft_bullets(entry, job_description)
        st.session_state["resume"] = resume

    resume = st.session_state.get("resume")
    if resume is None:
        return

    st.divider()
    if not llm.is_configured():
        st.info("LLM not configured yet: bullets below are your facts, unchanged.")
    _preview(resume)
    show_job_match(resume.to_text(), job_description)
    st.download_button(
        "Download DOCX",
        data=docx_export.build_docx(resume),
        file_name="resume.docx",
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
