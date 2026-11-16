"""Tab 2: improve an existing draft."""

from __future__ import annotations

import streamlit as st

from resume_maxxer import llm, parser
from resume_maxxer.ui.common import call_llm, review_and_export, seed_bullet_editors, show_job_match


def _read_draft() -> str:
    uploaded = st.file_uploader("Upload your resume", type=parser.SUPPORTED_EXTENSIONS)
    pasted = st.text_area("...or paste the text here", height=200, key="improve_pasted")
    if uploaded is None:
        return pasted
    try:
        return parser.extract_text(uploaded.name, uploaded.getvalue())
    except ValueError as error:
        st.error(str(error))
    except Exception:  # corrupt or mislabeled file
        st.error("Could not read that file. Try saving it again, or paste the text instead.")
    return ""


def render(job_description: str) -> None:
    st.subheader("Improve a draft")
    resume_text = _read_draft()
    if not resume_text.strip():
        return

    # Results belong to one draft; drop them when the draft changes.
    if st.session_state.get("improve_source") != resume_text:
        st.session_state["improve_source"] = resume_text
        st.session_state.pop("improve_advice", None)
        st.session_state.pop("improve_resume", None)

    st.divider()
    show_job_match(resume_text, job_description)

    advice_column, rebuild_column = st.columns(2)
    if advice_column.button("Get writing advice"):
        st.session_state["improve_advice"] = call_llm(
            llm.advise, resume_text, job_description, fallback=None
        )
    if rebuild_column.button("Rewrite and rebuild in our template"):
        resume = parser.parse_resume(resume_text)
        for entry in resume.experience + resume.projects:
            entry.bullets = call_llm(
                llm.revise_bullets, entry.facts, job_description, fallback=list(entry.facts)
            )
        st.session_state["improve_resume"] = resume
        seed_bullet_editors(resume, "improve")

    if advice := st.session_state.get("improve_advice"):
        st.markdown("#### Writing advice")
        st.markdown(advice)

    resume = st.session_state.get("improve_resume")
    if resume is None:
        return
    st.divider()
    if not (resume.experience or resume.projects):
        st.warning(
            "No experience or project sections were found in this draft, so there "
            "are no bullets to rewrite. Check that it has standard section headings."
        )
    elif not llm.is_configured():
        st.info("LLM not configured: bullets are your originals, placed in our template.")
    st.caption("Check that your draft was split into the right sections before exporting.")
    review_and_export(resume, job_description, "improve")
