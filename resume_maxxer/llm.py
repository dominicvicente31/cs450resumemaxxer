"""Writing advice from an existing LLM.

Ground rule from the proposal: the model drafts and revises bullets using
ONLY the facts the user supplied. Keep that rule in every prompt.

Nothing here calls a real model yet. Until `_complete` is implemented, the
public functions fall back to returning the input unchanged so the rest of
the app still runs.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

from resume_maxxer.models import Entry

load_dotenv()

SYSTEM_PROMPT = (
    "You are a resume writing assistant for students and recent graduates. "
    "Use only the facts you are given. Never invent employers, dates, "
    "numbers, tools, or results."
)


def is_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def _complete(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    """Send one prompt to the LLM and return its text reply.

    TODO: pick a provider, add its SDK to requirements.txt, and call it here
    using LLM_API_KEY / LLM_MODEL from the environment. This is the only
    function that should know which provider we use.
    """
    raise NotImplementedError("LLM provider not wired up yet")


def draft_bullets(entry: Entry, job_description: str = "") -> list[str]:
    """Turn an entry's raw facts into polished resume bullets."""
    if not is_configured():
        return list(entry.facts)
    # TODO: build the prompt from entry.title / organization / facts (and the
    # job description when given), call _complete, parse one bullet per line.
    raise NotImplementedError


def revise_bullets(bullets: list[str], job_description: str = "") -> list[str]:
    """Rewrite existing bullets for clarity and relevance to the job."""
    if not is_configured():
        return list(bullets)
    # TODO: prompt + parse, same shape as draft_bullets.
    raise NotImplementedError


def advise(resume_text: str, job_description: str = "") -> str:
    """Free-form writing advice on a draft resume, returned as markdown."""
    if not is_configured():
        return "_LLM not configured yet, so no writing advice is available._"
    # TODO: ask for specific, actionable feedback (weak verbs, missing
    # metrics, vague bullets, ordering) rather than a rewritten resume.
    raise NotImplementedError
