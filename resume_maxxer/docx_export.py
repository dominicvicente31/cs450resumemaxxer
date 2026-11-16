"""Export a Resume to DOCX with one consistent layout (python-docx).

Single-column template: plain paragraphs and real Word list items, no tables
or text boxes, so applicant tracking systems can read it.
TODO: warn when the resume runs past one page.
TODO: offer more than one template.
"""

from __future__ import annotations

from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

from resume_maxxer.models import Entry, Resume

FONT_NAME = "Calibri"
BODY_SIZE = Pt(11)
NAME_SIZE = Pt(20)
MARGIN = Inches(0.7)


def _add_rule_below(paragraph) -> None:
    """Thin line under the paragraph (python-docx has no API for borders)."""
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for attribute, value in (("val", "single"), ("sz", "6"), ("space", "1"), ("color", "auto")):
        bottom.set(qn(f"w:{attribute}"), value)
    borders.append(bottom)
    paragraph._p.get_or_add_pPr().append(borders)


def _section_heading(doc, text: str) -> None:
    paragraph = doc.add_paragraph()
    _add_rule_below(paragraph)  # before spacing, to keep Word's element order
    paragraph.paragraph_format.space_before = Pt(8)
    paragraph.paragraph_format.space_after = Pt(2)
    run = paragraph.add_run(text.upper())
    run.bold = True


def _heading_with_dates(doc, left: str, dates: str, text_width) -> None:
    """Bold text on the left, dates pushed to the right margin."""
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT)
    paragraph.add_run(left).bold = True
    if dates:
        paragraph.add_run(f"\t{dates}")


def _add_entries(doc, entries: list[Entry], text_width) -> None:
    for entry in entries:
        left = ", ".join(part for part in (entry.title, entry.organization) if part)
        _heading_with_dates(doc, left, entry.dates, text_width)
        for bullet in entry.bullets or entry.facts:
            item = doc.add_paragraph(bullet, style="List Bullet")
            item.paragraph_format.space_after = Pt(0)


def build_docx(resume: Resume) -> bytes:
    """Render the resume and return the .docx file contents."""
    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = FONT_NAME
    normal.font.size = BODY_SIZE

    section = doc.sections[0]
    section.left_margin = section.right_margin = MARGIN
    section.top_margin = section.bottom_margin = MARGIN
    text_width = section.page_width - section.left_margin - section.right_margin

    contact = resume.contact
    name = doc.add_paragraph()
    name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    name.paragraph_format.space_after = Pt(0)
    name_run = name.add_run(contact.name)
    name_run.bold = True
    name_run.font.size = NAME_SIZE

    contact_parts = [contact.email, contact.phone, *contact.links]
    contact_line = doc.add_paragraph(" | ".join(part for part in contact_parts if part))
    contact_line.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if resume.education:
        _section_heading(doc, "Education")
        for edu in resume.education:
            _heading_with_dates(doc, edu.school, edu.dates, text_width)
            for line in (edu.degree, edu.details):
                if line:
                    doc.add_paragraph(line).paragraph_format.space_after = Pt(0)

    if resume.experience:
        _section_heading(doc, "Experience")
        _add_entries(doc, resume.experience, text_width)

    if resume.projects:
        _section_heading(doc, "Projects")
        _add_entries(doc, resume.projects, text_width)

    if resume.skills:
        _section_heading(doc, "Skills")
        doc.add_paragraph(", ".join(resume.skills))

    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
