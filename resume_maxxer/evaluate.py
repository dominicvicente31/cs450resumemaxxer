"""One-call evaluation of a draft resume, used by the HTTP API.

Steps: model-graded job alignment (llm.score_alignment, -1 when it cannot
grade), TF-IDF wording overlap, writing advice, parse into sections, rewrite
bullets, fact-check the rewrites, score clarity before and after.
LLM failures never abort the run; the step falls back and a warning is added.
"""

from __future__ import annotations

from itertools import zip_longest

from resume_maxxer import factcheck, llm, metrics, parser, similarity
from resume_maxxer.models import Resume


def evaluate(resume_text: str, job_description: str = "") -> tuple[dict, Resume]:
    """Return (evaluation dict for the frontend, revised Resume for DOCX export).

    Raises ValueError if there is no resume text, or the job description is
    shorter than llm.MIN_JOB_DESCRIPTION_CHARS.
    """
    if not resume_text.strip():
        raise ValueError("No text found in this file.")
    if problem := llm.job_description_problem(job_description):
        raise ValueError(problem)

    warnings: list[str] = []

    def safe(function, *args, fallback):
        try:
            return function(*args)
        except llm.LLMError as error:
            if str(error) not in warnings:
                warnings.append(str(error))
            return fallback

    alignment = llm.score_alignment(resume_text, job_description)
    wording = similarity.match_score(resume_text, job_description)

    advice = safe(llm.advise, resume_text, job_description, fallback="")

    resume = parser.parse_resume(resume_text)
    clarity_before = metrics.resume_clarity(_with_original_bullets(resume))

    entries = []
    for section, items in (("Experience", resume.experience), ("Projects", resume.projects)):
        for entry in items:
            entry.bullets = safe(
                llm.revise_bullets, entry.facts, job_description, fallback=list(entry.facts)
            )
            context = f"{entry.title} {entry.organization}"
            pairs = zip_longest(entry.facts, entry.bullets, fillvalue="")
            entries.append(
                {
                    "section": section,
                    "title": ", ".join(p for p in (entry.title, entry.organization) if p)
                    or "Untitled entry",
                    "bullets": [
                        {
                            "original": original,
                            "revised": revised,
                            "flags": factcheck.unsupported_claims(revised, entry.facts, context)
                            if revised
                            else [],
                        }
                        for original, revised in pairs
                    ],
                }
            )

    if not entries:
        warnings.append(
            "No experience or project sections were found, so there were no bullets to "
            "rewrite. Check that your resume uses standard section headings."
        )
    if not llm.is_configured():
        warnings.append("No Anthropic API key is set, so bullets were not rewritten.")

    evaluation = {
        "alignment": alignment,
        # TF-IDF overlap: shared wording only. Shown as a secondary number.
        "wordingMatch": {"score": wording, "band": similarity.score_band(wording)},
        "clarityScore": metrics.resume_clarity(resume),
        "clarityBefore": clarity_before,
        "advice": advice,
        "entries": entries,
        "warnings": warnings,
        "llmConfigured": llm.is_configured(),
    }
    return evaluation, resume


def _with_original_bullets(resume: Resume) -> Resume:
    """Copy whose bullets are the user's originals, for the 'before' clarity score."""
    copy = Resume.from_dict(resume.to_dict())
    for entry in copy.experience + copy.projects:
        entry.bullets = list(entry.facts)
    return copy
