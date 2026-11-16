"""Widgets shared by both tabs."""

from __future__ import annotations

import streamlit as st

from resume_maxxer import similarity


def show_job_match(resume_text: str, job_description: str) -> None:
    st.markdown("#### Match with target job")
    if not job_description.strip():
        st.caption("Paste a job description in the sidebar to see a match score.")
        return
    score = similarity.match_score(resume_text, job_description)
    st.metric("TF-IDF cosine similarity", f"{score:.0%}")
    missing = similarity.missing_keywords(resume_text, job_description)
    if missing:
        st.write("Job description terms not found in the resume:")
        st.write(", ".join(missing))
    # TODO: explain the score to the user (what is a "good" number?).
