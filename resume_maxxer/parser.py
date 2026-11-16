"""Read an uploaded draft resume and split it into a structured Resume."""

from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader

from resume_maxxer import llm
from resume_maxxer.models import Contact, Education, Entry, Resume

SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt"]

SECTION_ALIASES = {
    "education": {"education", "academic background"},
    "experience": {
        "experience", "work experience", "professional experience",
        "employment", "work history", "relevant experience", "internships",
        "leadership", "leadership experience", "volunteer experience",
    },
    "projects": {"projects", "academic projects", "personal projects", "class projects"},
    "skills": {"skills", "technical skills", "skills and interests"},
}  # fmt: skip

_BULLET_RE = re.compile(r"^\s*(?:[•·▪●◦○*–—-]|\d+[.)])\s+")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]\d{4}")
_LINK_RE = re.compile(r"(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|io|dev|org|net|me)/\S+", re.IGNORECASE)
_MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?"
_DATE_POINT = rf"(?:(?:{_MONTH}|Fall|Spring|Summer|Winter)\s+)?\d{{4}}"
_DATE_RE = re.compile(
    rf"{_DATE_POINT}(?:\s*(?:-|–|—|to)\s*(?:{_DATE_POINT}|Present|Current|Now))?", re.IGNORECASE
)
_TITLE_SPLIT_RE = re.compile(r"\s*(?:,|\||\t|\s[–—-]\s)\s*")


# --- text extraction ---------------------------------------------------


def _is_list_item(paragraph: Paragraph) -> bool:
    properties = paragraph._p.pPr
    numbered = properties is not None and properties.numPr is not None
    return numbered or (paragraph.style.name or "").startswith("List")


def _docx_lines(parent) -> list[str]:
    """Paragraph and table text in document order. Word list items get a
    bullet marker, since their bullet is formatting rather than text."""
    lines: list[str] = []
    for block in parent.iter_inner_content():
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                lines.append(f"• {text}" if _is_list_item(block) else text)
        elif isinstance(block, Table):
            for row in block.rows:
                seen = set()
                for cell in row.cells:  # merged cells repeat; read each once
                    if cell._tc not in seen:
                        seen.add(cell._tc)
                        lines += _docx_lines(cell)
    return lines


def extract_text(filename: str, data: bytes) -> str:
    """Return the plain text of an uploaded resume file."""
    extension = Path(filename).suffix.lower().lstrip(".")
    if extension == "txt":
        return data.decode("utf-8", errors="replace")
    if extension == "docx":
        return "\n".join(_docx_lines(Document(BytesIO(data))))
    if extension == "pdf":
        # TODO: two-column PDFs come out with the columns interleaved.
        pages = PdfReader(BytesIO(data)).pages
        text = "\n".join(page.extract_text() or "" for page in pages)
        if not text.strip():
            raise ValueError("No text found in this PDF. Scanned PDFs are not supported.")
        return text
    raise ValueError(f"Unsupported file type: .{extension}")


# --- structure ---------------------------------------------------------


def _section_of(line: str) -> str | None:
    """Section key if the line is a known heading, "" for an unknown
    all-caps heading (its content is skipped), None for ordinary text."""
    heading = line.strip().rstrip(":").lower()
    for section, aliases in SECTION_ALIASES.items():
        if heading in aliases:
            return section
    if line.isupper() and len(line.split()) <= 4 and not _BULLET_RE.match(line):
        return ""
    return None


def _split_dates(line: str) -> tuple[str, str]:
    match = _DATE_RE.search(line)
    if not match:
        return line.strip(), ""
    rest = (line[: match.start()] + line[match.end() :]).strip(" \t,|()-–—")
    return rest, match.group().strip()


def _parse_contact(lines: list[str]) -> Contact:
    contact = Contact(name=lines[0].strip() if lines else "")
    rest = " ".join(lines[1:])
    if email := _EMAIL_RE.search(rest):
        contact.email = email.group()
        rest = rest.replace(contact.email, " ")
    contact.links = [link.rstrip(".,|") for link in _LINK_RE.findall(rest)]
    for link in contact.links:
        rest = rest.replace(link, " ")
    if phone := _PHONE_RE.search(rest):
        contact.phone = phone.group().strip()
    return contact


def _parse_education(lines: list[str]) -> list[Education]:
    schools: list[Education] = []
    for line in lines:
        text = _BULLET_RE.sub("", line)
        rest, dates = _split_dates(text)
        if dates or not schools:
            schools.append(Education(school=rest, dates=dates))
        elif not schools[-1].degree:
            schools[-1].degree = text.strip()
        else:
            current = schools[-1]
            current.details = f"{current.details}; {text.strip()}" if current.details else text.strip()
    return schools


def _parse_entries(lines: list[str]) -> list[Entry]:
    entries: list[Entry] = []
    for line in lines:
        if _BULLET_RE.match(line):
            if not entries:
                entries.append(Entry())
            entries[-1].facts.append(_BULLET_RE.sub("", line).strip())
            continue
        rest, dates = _split_dates(line)
        if entries and not entries[-1].facts:
            # Second header line of the same entry (e.g. company under the role).
            current = entries[-1]
            current.organization = ", ".join(part for part in (current.organization, rest) if part)
            current.dates = current.dates or dates
            continue
        parts = _TITLE_SPLIT_RE.split(rest, maxsplit=1)
        organization = parts[1] if len(parts) > 1 else ""
        entries.append(Entry(title=parts[0], organization=organization, dates=dates))
    return entries


def _parse_skills(lines: list[str]) -> list[str]:
    skills: list[str] = []
    for line in lines:
        text = _BULLET_RE.sub("", line)
        if ":" in text:  # "Languages: Python, Java"
            text = text.split(":", 1)[1]
        skills += [skill.strip() for skill in re.split(r"[,;|]", text) if skill.strip()]
    return skills


def parse_resume_heuristic(text: str) -> Resume:
    """Rule-based parser: section headings, bullet markers, and dates.
    Works on conventionally laid-out resumes; needs no API key."""
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in text.splitlines():
        if not line.strip():
            continue
        section = _section_of(line.strip())
        if section is None:
            sections.setdefault(current, []).append(line.strip())
        else:
            current = section
    return Resume(
        contact=_parse_contact(sections["header"]),
        education=_parse_education(sections.get("education", [])),
        experience=_parse_entries(sections.get("experience", [])),
        projects=_parse_entries(sections.get("projects", [])),
        skills=_parse_skills(sections.get("skills", [])),
    )


def _from_llm(text: str) -> Resume:
    data = llm.structure_resume(text)
    for entry in data["experience"] + data["projects"]:
        entry["facts"] = entry.pop("bullets")
    return Resume.from_dict(data)


def parse_resume(text: str) -> Resume:
    """Split draft text into a Resume. The draft's own bullets are stored as
    each entry's `facts`, so revisions can be checked against them.

    Uses the LLM when configured (handles unusual layouts) and falls back to
    the rule-based parser.
    """
    if llm.is_configured():
        try:
            return _from_llm(text)
        except (llm.LLMError, KeyError, TypeError):
            pass
    return parse_resume_heuristic(text)
