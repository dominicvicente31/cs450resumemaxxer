"""Fit the TF-IDF vectorizer on a corpus of job postings.

Run from the repo root:  python -m resume_maxxer.train

Reads every .txt file in data/job_postings/ (one posting per file) and
writes models/tfidf.joblib, which similarity.py picks up automatically.
See data/README.md for how to add postings.
"""

from __future__ import annotations

from pathlib import Path

import joblib

from resume_maxxer import similarity

POSTINGS_DIR = Path(__file__).parent.parent / "data" / "job_postings"
MIN_POSTINGS = 20  # below this the IDF weights are not worth trusting


def load_postings(directory: Path = POSTINGS_DIR) -> list[str]:
    texts = [path.read_text(encoding="utf-8", errors="replace") for path in sorted(directory.glob("*.txt"))]
    return [text for text in texts if text.strip()]


def train(postings: list[str], output_path: Path = similarity.MODEL_PATH) -> Path:
    # sublinear_tf: a word repeated ten times in a posting is not ten times as important.
    # min_df=2: ignore words that appear in only one posting (typos, company names).
    vectorizer = similarity.build_vectorizer(sublinear_tf=True, min_df=2)
    vectorizer.fit(postings)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(vectorizer, output_path)
    return output_path


def main() -> None:
    postings = load_postings()
    if len(postings) < MIN_POSTINGS:
        print(
            f"Found {len(postings)} posting(s) in {POSTINGS_DIR}; need at least "
            f"{MIN_POSTINGS}. Nothing trained."
        )
        return
    path = train(postings)
    print(f"Trained on {len(postings)} postings. Saved {path}")


if __name__ == "__main__":
    main()
