"""Check that a bullet only says what the user's facts support.

This is a rule-based guard for the proposal's "only supplied facts" promise:
it flags numbers and named things (tools, companies, acronyms) that appear in
a bullet but not in the source facts.

Known gap: it cannot see invented claims made of ordinary words ("improving
team efficiency").
TODO: add an LLM-as-judge pass for those and compare it with manual review.
"""

from __future__ import annotations

import re

_NUMBER_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
_TERM_RE = re.compile(r"[A-Za-z][\w+#.\-/]*")
_NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "fifteen": "15", "twenty": "20",
    "thirty": "30", "forty": "40", "fifty": "50", "hundred": "100",
    "thousand": "1000",
}  # fmt: skip


def _numbers(text: str) -> set[str]:
    found = {match.replace(",", "").rstrip(".") for match in _NUMBER_RE.findall(text)}
    words = set(re.findall(r"[a-z]+", text.lower()))
    found |= {digits for word, digits in _NUMBER_WORDS.items() if word in words}
    return found


def _looks_named(term: str, is_first_word: bool) -> bool:
    """Proper nouns, acronyms, and tool names like C++ or Node.js."""
    if any(char.isdigit() or char in "+#" for char in term):
        return True
    if is_first_word:  # sentence-case capital, not a name
        return any(char.isupper() for char in term[1:])
    return any(char.isupper() for char in term)


def unsupported_claims(bullet: str, facts: list[str], context: str = "") -> list[str]:
    """Numbers and named terms in `bullet` that are not in `facts`.

    `context` is extra text that counts as supplied (title, organization).
    """
    source = " ".join(facts) + " " + context
    source_lower = source.lower()
    source_numbers = _numbers(source)

    flagged: list[str] = []
    for number in _NUMBER_RE.findall(bullet):
        if number.replace(",", "").rstrip(".") not in source_numbers:
            flagged.append(number.rstrip("."))

    for index, match in enumerate(_TERM_RE.finditer(bullet)):
        term = match.group().rstrip(".,-/")
        if _looks_named(term, is_first_word=index == 0) and term.lower() not in source_lower:
            flagged.append(term)

    return list(dict.fromkeys(flagged))


def supported_share(bullets: list[str], facts: list[str], context: str = "") -> float:
    """Share of bullets with nothing flagged, 0.0 to 1.0."""
    if not bullets:
        return 1.0
    clean = sum(1 for bullet in bullets if not unsupported_claims(bullet, facts, context))
    return clean / len(bullets)
