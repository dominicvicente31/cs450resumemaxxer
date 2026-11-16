"""Tab 2: improve an existing draft."""

from __future__ import annotations

import streamlit as st

from resume_maxxer import llm, parser
from resume_maxxer.ui.common import show_job_match


def render(job_description: str) -> None:
    st.subheader("Improve a draft")

    uploaded = st.file_uploader("Upload your resume", type=parser.SUPPORTED_EXTENSIONS)
    pasted = st.text_area("...or paste the text here", height=200)

    resume_text = pasted
    if uploaded is not None:
        try:
            resume_text = parser.extract_text(uploaded.name, uploaded.getvalue())
        except ValueError as error:
            st.error(str(error))
            return
    if not resume_text.strip():
        return

    st.divider()
    show_job_match(resume_text, job_description)

    st.markdown("#### Writing advice")
    if st.button("Get advice"):
        st.markdown(llm.advise(resume_text, job_description))

    # TODO: once parser.parse_resume works, revise bullets with
    # llm.revise_bullets and offer the draft back in our DOCX template
    # (docx_export.build_docx), with a before/after view.
