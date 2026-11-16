"""Test plan: compare 20 synthetic resumes before and after for clarity,
relevance, and factual accuracy.

Run from the repo root:  python -m evaluation.run_eval

"Before" is the resume built from the raw facts; "after" uses the LLM's
bullets. Each case is a JSON file in evaluation/synthetic/ (see
example_01.json for the format). Results go to evaluation/results.csv.

TODO: write the other 19 synthetic resumes (vary major, experience level,
      and how messy the facts are). Do not use real people's resumes.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from resume_maxxer import llm, similarity
from resume_maxxer.models import Resume

SYNTHETIC_DIR = Path(__file__).parent / "synthetic"
RESULTS_PATH = Path(__file__).parent / "results.csv"


def relevance(resume: Resume, job_description: str) -> float:
    return similarity.match_score(resume.to_text(), job_description)


def clarity(resume: Resume) -> float | None:
    """TODO: decide the metric (rubric scored by teammates, readability
    formula, share of bullets starting with an action verb, ...)."""
    return None


def factual_accuracy(before: Resume, after: Resume) -> float | None:
    """TODO: share of "after" bullets fully supported by the entry's facts.
    Needs manual review or an automatic check for invented numbers/tools."""
    return None


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
        "clarity_before": clarity(before),
        "clarity_after": clarity(after),
        "factual_accuracy": factual_accuracy(before, after),
    }


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


if __name__ == "__main__":
    main()
