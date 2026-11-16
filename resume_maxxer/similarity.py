"""Compare resume wording with a target job using TF-IDF + cosine similarity.

This is a working baseline. Ideas to improve it:
TODO: fit IDF on a corpus of job postings instead of just these two texts.
TODO: try bigrams (ngram_range=(1, 2)) so "machine learning" counts as one term.
TODO: normalize synonyms / abbreviations (JS vs JavaScript).
"""

from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _vectorize(resume_text: str, job_text: str):
    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform([resume_text, job_text])
    return vectorizer, matrix


def match_score(resume_text: str, job_text: str) -> float:
    """Cosine similarity between resume and job description, 0.0 to 1.0."""
    if not resume_text.strip() or not job_text.strip():
        return 0.0
    try:
        _, matrix = _vectorize(resume_text, job_text)
    except ValueError:  # nothing left after removing stop words
        return 0.0
    return float(cosine_similarity(matrix[0], matrix[1])[0, 0])


def missing_keywords(resume_text: str, job_text: str, top_n: int = 10) -> list[str]:
    """Highest-weighted job description terms that never appear in the resume."""
    if not job_text.strip():
        return []
    try:
        vectorizer, matrix = _vectorize(resume_text, job_text)
    except ValueError:
        return []
    terms = vectorizer.get_feature_names_out()
    resume_weights = matrix[0].toarray()[0]
    job_weights = matrix[1].toarray()[0]
    missing = [
        (job_weights[i], terms[i])
        for i in range(len(terms))
        if job_weights[i] > 0 and resume_weights[i] == 0
    ]
    missing.sort(key=lambda pair: (-pair[0], pair[1]))
    return [term for _, term in missing[:top_n]]
