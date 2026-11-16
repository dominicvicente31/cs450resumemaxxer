"""Compare resume wording with a target job using TF-IDF + cosine similarity.

Two modes:
- Trained: if models/tfidf.joblib exists (see train.py), its vocabulary and
  IDF weights come from a corpus of real job postings, so common posting
  boilerplate counts for little.
- Untrained: IDF is fit on just the resume and the job description. Works
  with no data, but the weights are crude.

TODO: tokens like "c++" and "c#" are dropped by the default tokenizer.
TODO: calibrate BANDS once real resumes and postings are in data/.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

MODEL_PATH = Path(__file__).parent.parent / "models" / "tfidf.joblib"

# Abbreviations and variants mapped to one spelling before vectorizing.
SYNONYMS = {
    "js": "javascript",
    "ts": "typescript",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "nlp": "natural language processing",
    "oop": "object oriented programming",
    "k8s": "kubernetes",
    "postgres": "postgresql",
    "db": "database",
    "apis": "api",
}
_SYNONYM_RE = re.compile(r"\b(" + "|".join(SYNONYMS) + r")\b")

# Upper bounds for the labels shown next to the score. Placeholders.
BANDS = [(0.15, "Weak"), (0.30, "Fair")]
TOP_BAND = "Strong"


def normalize(text: str) -> str:
    return _SYNONYM_RE.sub(lambda match: SYNONYMS[match.group()], text.lower())


def build_vectorizer(**overrides) -> TfidfVectorizer:
    """The one vectorizer configuration, shared with train.py."""
    settings = dict(preprocessor=normalize, stop_words="english", ngram_range=(1, 2))
    settings.update(overrides)
    return TfidfVectorizer(**settings)


@lru_cache(maxsize=1)
def _trained_vectorizer() -> TfidfVectorizer | None:
    return joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None


def is_trained() -> bool:
    return _trained_vectorizer() is not None


def match_score(resume_text: str, job_text: str) -> float:
    """Cosine similarity between resume and job description, 0.0 to 1.0."""
    if not resume_text.strip() or not job_text.strip():
        return 0.0
    vectorizer = _trained_vectorizer()
    try:
        if vectorizer is not None:
            matrix = vectorizer.transform([resume_text, job_text])
        else:
            matrix = build_vectorizer().fit_transform([resume_text, job_text])
    except ValueError:  # nothing left after removing stop words
        return 0.0
    return float(cosine_similarity(matrix[0], matrix[1])[0, 0])


def score_band(score: float) -> str:
    for upper_bound, label in BANDS:
        if score < upper_bound:
            return label
    return TOP_BAND


def missing_keywords(resume_text: str, job_text: str, top_n: int = 10) -> list[str]:
    """Highest-weighted job description words that never appear in the resume."""
    if not job_text.strip():
        return []
    try:
        vectorizer = build_vectorizer(ngram_range=(1, 1))
        matrix = vectorizer.fit_transform([resume_text, job_text])
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
