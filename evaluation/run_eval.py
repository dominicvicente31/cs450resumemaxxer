"""Test plan: compare 20 synthetic resumes before and after for clarity,
relevance, and factual accuracy.

Run from the repo root:  python -m evaluation.run_eval

"Before" is the resume built from the raw facts; "after" uses the LLM's
bullets. Each case is a JSON file in evaluation/synthetic/ (see
example_01.json for the format). Results go to evaluation/results.csv and a
summary is printed.

Metrics (0.0 to 1.0 unless noted):
- alignment: llm.score_alignment, the model's 0-100 grade of keyword coverage
  and how well those keywords are backed by experience. -1 when it cannot
  grade (for example, no API key); -1 rows are left out of the mean.
- relevance: TF-IDF cosine similarity with the case's job description
- clarity: metrics.resume_clarity, share of rule-based checks passed
- factual_accuracy: share of "after" bullets with no number or named term
  missing from the entry's facts (factcheck.py)

Every case's job description must be at least llm.MIN_JOB_DESCRIPTION_CHARS
characters; shorter ones fail the run so they get fixed.
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


def alignment(resume: Resume, job_description: str) -> int:
    return llm.score_alignment(resume.to_text(), job_description)["score"]


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
    if problem := llm.job_description_problem(job_description):
        raise ValueError(f"{path.name}: {problem}")

    before = Resume.from_dict(case["resume"])
    after = Resume.from_dict(case["resume"])
    for entry in after.experience + after.projects:
        entry.bullets = llm.draft_bullets(entry, job_description)

    return {
        "case": path.stem,
        "alignment_before": alignment(before, job_description),
        "alignment_after": alignment(after, job_description),
        "relevance_before": relevance(before, job_description),
        "relevance_after": relevance(after, job_description),
        "clarity_before": metrics.resume_clarity(before),
        "clarity_after": metrics.resume_clarity(after),
        "factual_accuracy": factual_accuracy(after),
    }


def summarize(rows: list[dict]) -> dict:
    """Mean of every metric column across cases. Unscorable alignment (-1) is
    left out; a column with no scorable rows is reported as -1."""
    summary = {}
    for key in rows[0]:
        if key == "case":
            continue
        values = [row[key] for row in rows]
        if key.startswith("alignment"):
            values = [v for v in values if v != llm.UNSCORABLE]
        summary[key] = mean(values) if values else llm.UNSCORABLE
    return summary


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
