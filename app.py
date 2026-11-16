"""Resume Maxxer web app. Run locally with: streamlit run app.py"""

import streamlit as st

from resume_maxxer.ui import create, improve

st.set_page_config(page_title="Resume Maxxer", page_icon="📄", layout="wide")
st.title("Resume Maxxer")
st.caption("AI resume advice, formatting, and creation")

with st.sidebar:
    st.header("Target job")
    job_description = st.text_area(
        "Job description (optional)",
        height=300,
        help="Used to score how well your resume wording matches the job.",
    )

create_tab, improve_tab = st.tabs(["Create from questionnaire", "Improve a draft"])
with create_tab:
    create.render(job_description)
with improve_tab:
    improve.render(job_description)
