"""Test plan: compare 20 synthetic resumes before and after for clarity,
relevance, and factual accuracy.

Run from the repo root:  python -m evaluation.run_eval

"Before" is the resume built from the raw facts; "after" uses the LLM's
bullets. Each case is a JSON file in evaluation/synthetic/ (see
example_01.json for the format). Results go to evaluation/results.csv and a
summary is printed.

Metrics (all 0.0 to 1.0):
- relevance: TF-IDF cosine similarity with the case's job description
- clarity: metrics.resume_clarity, share of rule-based checks passed
- factual_accuracy: share of "after" bullets with no number or named term
  missing from the entry's facts (factcheck.py)

TODO: write the other 19 synthetic resumes (vary major, experience level,
      and how messy the facts are). Do not use real people's resumes.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from statistics import mean

from resume_maxxer import factcheck, llm, metrics, similarity
from resume_maxxer.models import Resume

SYNTHETIC_DIR = Path(__file__).parent / "synthetic"
RESULTS_PATH = Path(__file__).parent / "results.csv"


def relevance(resume: Resume, job_description: str) -> float:
    return similarity.match_score(resume.to_text(), job_description)


def factual_accuracy(resume: Resume) -> float:
    entries = resume.experience + resume.projects
    bullets = sum(len(entry.bullets) for entry in entries)
    if not bullets:
        return 1.0
    supported = sum(
        factcheck.supported_share(entry.bullets, entry.facts, f"{entry.title} {entry.organization}")
        * len(entry.bullets)
        for entry in entries
    )
    return supported / bullets


def evaluate_case(path: Path) -> dict:
    case = json.loads(path.read_text(encoding="utf-8"))
    job_description = case["job_description"]

    before = Resume.from_dict(case["resume"])
    after = Resume.from_dict(case["resume"])
    for entry in after.experience + after.projects:
        entry.bullets = llm.draft_bullets(entry, job_description)

    return {
        "case": path.stem,
        "relevance_before": relevance(before, job_description),
        "relevance_after": relevance(after, job_description),
        "clarity_before": metrics.resume_clarity(before),
        "clarity_after": metrics.resume_clarity(after),
        "factual_accuracy": factual_accuracy(after),
    }


def summarize(rows: list[dict]) -> dict:
    """Mean of every metric column across cases."""
    return {key: mean(row[key] for row in rows) for key in rows[0] if key != "case"}


def main() -> None:
    if not llm.is_configured():
        print("Warning: LLM not configured, so before and after will be identical.")
    rows = [evaluate_case(path) for path in sorted(SYNTHETIC_DIR.glob("*.json"))]
    if not rows:
        print(f"No cases found in {SYNTHETIC_DIR}")
        return
    with RESULTS_PATH.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} case(s) to {RESULTS_PATH}")
    for metric, value in summarize(rows).items():
        print(f"  mean {metric}: {value:.3f}")


if __name__ == "__main__":
    main()
