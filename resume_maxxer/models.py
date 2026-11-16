"""Shared data model. Every other module passes a `Resume` around, so change
field names here with care (and update tests/ and evaluation/synthetic/)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class Contact:
    name: str = ""
    email: str = ""
    phone: str = ""
    links: list[str] = field(default_factory=list)  # LinkedIn, GitHub, portfolio


@dataclass
class Education:
    school: str = ""
    degree: str = ""
    dates: str = ""
    details: str = ""  # GPA, relevant coursework, honors


@dataclass
class Entry:
    """One experience or project.

    `facts` is what the user told us, verbatim. `bullets` is the polished
    wording shown on the resume. The LLM may only rephrase `facts`; it must
    never add anything that is not in them.
    """

    title: str = ""
    organization: str = ""
    dates: str = ""
    facts: list[str] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)


@dataclass
class Resume:
    contact: Contact = field(default_factory=Contact)
    education: list[Education] = field(default_factory=list)
    experience: list[Entry] = field(default_factory=list)
    projects: list[Entry] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> Resume:
        return cls(
            contact=Contact(**data.get("contact", {})),
            education=[Education(**e) for e in data.get("education", [])],
            experience=[Entry(**e) for e in data.get("experience", [])],
            projects=[Entry(**e) for e in data.get("projects", [])],
            skills=list(data.get("skills", [])),
        )

    def to_text(self) -> str:
        """Plain-text body used for job matching (contact info left out)."""
        lines: list[str] = []
        for edu in self.education:
            lines += [edu.school, edu.degree, edu.details]
        for entry in self.experience + self.projects:
            lines += [entry.title, entry.organization]
            lines += entry.bullets or entry.facts
        lines.append(", ".join(self.skills))
        return "\n".join(line for line in lines if line)
