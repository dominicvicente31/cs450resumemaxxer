"""Read an uploaded draft resume."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document

from resume_maxxer.models import Resume

SUPPORTED_EXTENSIONS = ["docx", "txt"]


def extract_text(filename: str, data: bytes) -> str:
    """Return the plain text of an uploaded resume file."""
    extension = Path(filename).suffix.lower().lstrip(".")
    if extension == "txt":
        return data.decode("utf-8", errors="replace")
    if extension == "docx":
        # TODO: text inside tables is skipped; many resume templates use them.
        document = Document(BytesIO(data))
        return "\n".join(p.text for p in document.paragraphs if p.text.strip())
    # TODO: PDF support (e.g. pypdf), then add "pdf" to SUPPORTED_EXTENSIONS.
    raise ValueError(f"Unsupported file type: .{extension}")


def parse_resume(text: str) -> Resume:
    """Split draft text into a structured Resume so it can be re-exported
    with our template.

    TODO: implement (section-heading heuristics, or ask the LLM to return
    JSON matching Resume.to_dict()). Until then the Improve tab only gives
    advice and a match score; it cannot re-format the draft.
    """
    raise NotImplementedError
