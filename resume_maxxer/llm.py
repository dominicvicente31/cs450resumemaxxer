"""Writing advice from an existing LLM (Claude, through the Anthropic SDK).

Ground rule from the proposal: the model drafts and revises bullets using
ONLY the facts the user supplied. Every prompt repeats that rule, and
factcheck.py double-checks the output.

`_complete` is the only function that talks to the provider. Without an API
key the public functions return their input unchanged, so the app, the tests
and the evaluation script all still run.
"""

from __future__ import annotations

import json
import os

import anthropic
from dotenv import load_dotenv

from resume_maxxer.models import Entry

load_dotenv()

DEFAULT_MODEL = "claude-opus-5-5"
# Models that can re-run a declined request on a fallback model server-side.
_FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"}

SYSTEM_PROMPT = (
    "You are a resume writing assistant for students and recent graduates. "
    "Recruiters and hiring managers will read what you write, so it must be "
    "truthful. Use only the facts you are given. Never invent employers, "
    "dates, numbers, tools, or results, and never upgrade a vague fact into "
    "a specific one."
)

BULLET_RULES = """\
Rules:
- Start each bullet with a strong past-tense action verb. No "I", "we" or "my".
- Keep each bullet under 30 words and to one accomplishment.
- Keep every number, tool, and name exactly as given. Do not add metrics,
  tools, or outcomes that are not in the input. If a fact is vague, keep the
  bullet modest instead of embellishing it.
- When a target job is given, lead with what is most relevant to it and use
  its wording only where the input supports it."""

_BULLETS_SCHEMA = {
    "type": "object",
    "properties": {"bullets": {"type": "array", "items": {"type": "string"}}},
    "required": ["bullets"],
    "additionalProperties": False,
}

_ENTRY_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "organization": {"type": "string"},
        "dates": {"type": "string"},
        "bullets": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "organization", "dates", "bullets"],
    "additionalProperties": False,
}

_RESUME_SCHEMA = {
    "type": "object",
    "properties": {
        "contact": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "links": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["name", "email", "phone", "links"],
            "additionalProperties": False,
        },
        "education": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "school": {"type": "string"},
                    "degree": {"type": "string"},
                    "dates": {"type": "string"},
                    "details": {"type": "string"},
                },
                "required": ["school", "degree", "dates", "details"],
                "additionalProperties": False,
            },
        },
        "experience": {"type": "array", "items": _ENTRY_SCHEMA},
        "projects": {"type": "array", "items": _ENTRY_SCHEMA},
        "skills": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["contact", "education", "experience", "projects", "skills"],
    "additionalProperties": False,
}


class LLMError(Exception):
    """The LLM call failed. The message is safe to show to the user."""


def is_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def _model() -> str:
    return os.environ.get("RESUME_MAXXER_MODEL") or DEFAULT_MODEL


def _complete(prompt: str, system: str = SYSTEM_PROMPT, schema: dict | None = None) -> str:
    """Send one prompt and return the reply text (JSON text when `schema` is given)."""
    model = _model()
    output_config: dict = {"effort": "medium"}
    if schema is not None:
        output_config["format"] = {"type": "json_schema", "schema": schema}
    request = dict(
        model=model,
        max_tokens=16000,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        output_config=output_config,
    )
    client = anthropic.Anthropic()
    try:
        if model in _FALLBACK_MODELS:
            response = client.beta.messages.create(
                betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request
            )
        else:
            response = client.messages.create(**request)
    except anthropic.AuthenticationError as error:
        raise LLMError("The API key was rejected. Check ANTHROPIC_API_KEY in .env.") from error
    except anthropic.RateLimitError as error:
        raise LLMError("The LLM is rate limited right now. Wait a minute and retry.") from error
    except anthropic.APIStatusError as error:
        raise LLMError(f"The LLM request failed ({error.status_code}): {error.message}") from error
    except anthropic.APIConnectionError as error:
        raise LLMError("Could not reach the LLM. Check your internet connection.") from error

    if response.stop_reason == "refusal":
        raise LLMError("The LLM declined this request.")
    if response.stop_reason == "max_tokens":
        raise LLMError("The LLM reply was cut off. Try a shorter input.")
    return "".join(block.text for block in response.content if block.type == "text")


def _job_block(job_description: str) -> str:
    if not job_description.strip():
        return ""
    return f"\n<target_job>\n{job_description.strip()}\n</target_job>\n"


def _bullet_list(lines: list[str]) -> str:
    return "\n".join(f"- {line}" for line in lines)


def _ask_for_bullets(prompt: str) -> list[str]:
    reply = _complete(prompt, schema=_BULLETS_SCHEMA)
    try:
        bullets = json.loads(reply)["bullets"]
    except (json.JSONDecodeError, KeyError, TypeError) as error:
        raise LLMError("The LLM reply was not in the expected format.") from error
    return [bullet.strip() for bullet in bullets if bullet.strip()]


def draft_bullets(entry: Entry, job_description: str = "") -> list[str]:
    """Turn an entry's raw facts into polished resume bullets."""
    if not is_configured() or not entry.facts:
        return list(entry.facts)
    prompt = (
        "Write resume bullets for the entry below, based on the facts the "
        "student gave in their own words.\n\n"
        f"<title>{entry.title}</title>\n"
        f"<organization>{entry.organization}</organization>\n"
        f"<facts>\n{_bullet_list(entry.facts)}\n</facts>\n"
        f"{_job_block(job_description)}\n"
        "Write at most one bullet per fact; merge facts that describe the "
        "same accomplishment.\n"
        f"{BULLET_RULES}"
    )
    return _ask_for_bullets(prompt)


def revise_bullets(bullets: list[str], job_description: str = "") -> list[str]:
    """Rewrite existing bullets for clarity and relevance to the job."""
    if not is_configured() or not bullets:
        return list(bullets)
    prompt = (
        "Rewrite the resume bullets below so they are clearer and stronger. "
        "The existing bullets are your only source of facts.\n\n"
        f"<bullets>\n{_bullet_list(bullets)}\n</bullets>\n"
        f"{_job_block(job_description)}\n"
        "Return the same number of bullets in the same order, so each one "
        "can be compared with its original. Leave a bullet as it is if it "
        "is already good.\n"
        f"{BULLET_RULES}"
    )
    return _ask_for_bullets(prompt)


def advise(resume_text: str, job_description: str = "") -> str:
    """Free-form writing advice on a draft resume, returned as markdown."""
    if not is_configured():
        return "_LLM not configured yet, so no writing advice is available._"
    prompt = (
        "Review the draft resume below and give the student feedback they "
        "can act on.\n\n"
        f"<resume>\n{resume_text.strip()}\n</resume>\n"
        f"{_job_block(job_description)}\n"
        "Give the five to eight changes that would help most, most important "
        "first. For each one, quote the line it applies to and say what to "
        "change and why (weak verb, missing result, vague wording, ordering, "
        "relevance to the target job). Suggest asking for a number or detail "
        "where one is missing, rather than supplying it yourself. Do not "
        "rewrite the whole resume. Reply in markdown."
    )
    return _complete(prompt)


def structure_resume(resume_text: str) -> dict:
    """Split draft resume text into a dict shaped like Resume.to_dict(),
    except entries carry their original `bullets`. Requires an API key."""
    prompt = (
        "Split the resume text below into structured fields.\n\n"
        f"<resume>\n{resume_text.strip()}\n</resume>\n\n"
        "Copy the text exactly as written; do not correct, reword, or add "
        "anything. Use an empty string or empty list for anything the resume "
        "does not contain. Put work, internships, and volunteering under "
        "experience, and class or personal projects under projects."
    )
    reply = _complete(prompt, schema=_RESUME_SCHEMA)
    try:
        return json.loads(reply)
    except json.JSONDecodeError as error:
        raise LLMError("The LLM reply was not in the expected format.") from error
