"""Clarity score for resume bullets.

A rule-based baseline so "clarity" in the test plan is a number we can
compute for every resume. It should be validated against human ratings.
TODO: score a sample by hand with a rubric and report how well this agrees.
"""

from __future__ import annotations

import re

from resume_maxxer.models import Resume

MIN_WORDS, MAX_WORDS = 6, 30

STRONG_VERBS = {
    "built", "led", "wrote", "ran", "taught", "won", "drove", "grew", "cut",
    "set", "began", "oversaw", "spoke", "kept", "sold", "held", "met",
}  # irregular past tense; regular "-ed" verbs are accepted by suffix  # fmt: skip
WEAK_OPENERS = {
    "helped", "worked", "assisted", "participated", "handled", "used",
    "utilized", "did", "made", "was", "responsible", "tasked",
}  # fmt: skip
FILLER_PHRASES = (
    "responsible for", "duties included", "worked on", "helped with",
    "in charge of", "various", "etc",
)  # fmt: skip
_FIRST_PERSON_RE = re.compile(r"\b(i|me|my|we|our)\b", re.IGNORECASE)


def bullet_issues(bullet: str) -> list[str]:
    """Names of the clarity checks this bullet fails (empty list = clean)."""
    words = re.findall(r"[\w'+#.-]+", bullet)
    lowered = bullet.lower()
    first = words[0].lower() if words else ""

    issues = []
    strong_start = first in STRONG_VERBS or (first.endswith("ed") and first not in WEAK_OPENERS)
    if not strong_start:
        issues.append("no action verb")
    if not MIN_WORDS <= len(words) <= MAX_WORDS:
        issues.append("length")
    if _FIRST_PERSON_RE.search(bullet):
        issues.append("first person")
    if any(phrase in lowered for phrase in FILLER_PHRASES):
        issues.append("filler")
    if not any(char.isdigit() for char in bullet):
        issues.append("not quantified")
    return issues


CHECK_COUNT = 5


def bullet_clarity(bullet: str) -> float:
    return 1 - len(bullet_issues(bullet)) / CHECK_COUNT


def resume_clarity(resume: Resume) -> float:
    """Mean bullet clarity across experience and projects, 0.0 to 1.0."""
    bullets = [
        bullet
        for entry in resume.experience + resume.projects
        for bullet in (entry.bullets or entry.facts)
    ]
    if not bullets:
        return 0.0
    return sum(bullet_clarity(bullet) for bullet in bullets) / len(bullets)
