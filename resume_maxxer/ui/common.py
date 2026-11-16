"""Widgets shared by both tabs."""

from __future__ import annotations

import json

import streamlit as st

from resume_maxxer import docx_export, factcheck, llm, metrics, similarity
from resume_maxxer.models import Entry, Resume

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def call_llm(function, *args, fallback):
    """Run an llm.py function; on failure show the error and return `fallback`."""
    try:
        with st.spinner("Asking the LLM..."):
            return function(*args)
    except llm.LLMError as error:
        st.error(str(error))
        return fallback


def show_job_match(resume_text: str, job_description: str) -> None:
    st.markdown("#### Match with target job")
    if not job_description.strip():
        st.caption("Paste a job description in the sidebar to see a match score.")
        return
    score = similarity.match_score(resume_text, job_description)
    st.metric("Wording match", f"{score:.0%}", similarity.score_band(score), delta_color="off")
    st.caption(
        "TF-IDF cosine similarity between your resume and the job description. "
        "It measures shared wording, not whether you are qualified."
    )
    missing = similarity.missing_keywords(resume_text, job_description)
    if missing:
        st.write("Job description terms not found in your resume: " + ", ".join(missing))
        st.caption("Only add a term if it is true for you.")


def _entries(resume: Resume) -> list[tuple[str, int, Entry]]:
    labelled = [("exp", i, entry) for i, entry in enumerate(resume.experience)]
    return labelled + [("proj", i, entry) for i, entry in enumerate(resume.projects)]


def _editor_key(prefix: str, kind: str, index: int) -> str:
    return f"{prefix}_{kind}_bullets_{index}"


def seed_bullet_editors(resume: Resume, prefix: str) -> None:
    """Load freshly generated bullets into the review text areas. Call this
    when a resume is (re)built, before review_and_export draws the widgets."""
    for kind, index, entry in _entries(resume):
        st.session_state[_editor_key(prefix, kind, index)] = "\n".join(entry.bullets)


def review_and_export(resume: Resume, job_description: str, prefix: str) -> None:
    """Before/after view with editable bullets, fact-check warnings, scores,
    and downloads. `prefix` keeps widget keys unique per tab."""
    st.markdown("#### Review your bullets")
    st.caption("Left: what you gave us. Right: the resume wording. Edit anything before exporting.")

    for kind, index, entry in _entries(resume):
        heading = ", ".join(part for part in (entry.title, entry.organization) if part)
        st.markdown(f"**{heading or 'Untitled entry'}**")
        left, right = st.columns(2)
        left.markdown("\n".join(f"- {fact}" for fact in entry.facts) or "_No details given._")

        key = _editor_key(prefix, kind, index)
        if key not in st.session_state:
            st.session_state[key] = "\n".join(entry.bullets)
        edited = right.text_area("Resume bullets, one per line", key=key, height=140)
        entry.bullets = lines(edited)

        context = f"{entry.title} {entry.organization}"
        for bullet in entry.bullets:
            flagged = factcheck.unsupported_claims(bullet, entry.facts, context)
            if flagged:
                right.warning(f"Not in your input: {', '.join(flagged)}. Check: “{bullet}”")

    st.metric("Clarity", f"{metrics.resume_clarity(resume):.0%}")
    st.caption("Share of clarity checks passed: action verb, length, no filler, no first person, has a number.")
    show_job_match(resume.to_text(), job_description)

    docx_column, json_column = st.columns(2)
    docx_column.download_button(
        "Download DOCX",
        data=docx_export.build_docx(resume),
        file_name="resume.docx",
        mime=DOCX_MIME,
        key=f"{prefix}_download_docx",
    )
    json_column.download_button(
        "Save answers (JSON)",
        data=json.dumps(resume.to_dict(), indent=2),
        file_name="resume_answers.json",
        mime="application/json",
        key=f"{prefix}_download_json",
        help="Load this file in the Create tab later to pick up where you left off.",
    )
