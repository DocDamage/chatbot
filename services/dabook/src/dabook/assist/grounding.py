"""
Grounding checks for LLM-generated training pairs.

An assisted pair is only trusted if it can be traced back to the source text. A pair is rejected
when its evidence quote is not in the excerpt, when its answer shares too little vocabulary with the
excerpt, or when it introduces code the excerpt does not contain. Every rejection has a stable
reason code so rejection rates can be tracked and filtered.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from dabook.core.dedup import normalize

MIN_ANSWER_WORDS = 15
MIN_QUESTION_WORDS = 3
MIN_EVIDENCE_CHARS = 20
CATEGORIES = ("qa", "explain", "code_walkthrough")

_TOKEN = re.compile(r"[a-z0-9_]{4,}")
_FENCE = re.compile(r"```[^\n`]*\n(.*?)```", re.DOTALL)
_INLINE = re.compile(r"`([^`\n]{3,})`")


@dataclass(frozen=True)
class GroundingResult:
    ok: bool
    reason: str | None = None
    overlap: float = 0.0
    code_ok: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {"overlap": round(self.overlap, 3), "code_ok": self.code_ok}


def content_tokens(text: str) -> set[str]:
    return set(_TOKEN.findall(text.lower()))


def token_overlap(answer: str, source: str) -> float:
    """Share of the answer's content words (4+ chars) that also appear in the source."""
    answer_tokens = content_tokens(answer)
    if not answer_tokens:
        return 0.0
    return len(answer_tokens & content_tokens(source)) / len(answer_tokens)


def evidence_in_source(evidence: str, source: str) -> bool:
    norm = normalize(evidence)
    return len(evidence) >= MIN_EVIDENCE_CHARS and bool(norm) and norm in normalize(source)


def _squash(text: str) -> str:
    return " ".join(text.split())


def code_snippets(text: str) -> list[str]:
    """Fenced-block lines and inline `code` spans, whitespace-squashed."""
    snippets: list[str] = []
    for block in _FENCE.findall(text):
        snippets += [_squash(line) for line in block.splitlines() if line.strip()]
    snippets += [_squash(m) for m in _INLINE.findall(_FENCE.sub("", text))]
    return [s for s in snippets if s]


def invented_code(answer: str, source: str, question: str = "") -> list[str]:
    """Code in *answer* that appears in neither the source nor the question."""
    haystack = _squash(source) + "\n" + _squash(question)
    return [snippet for snippet in code_snippets(answer) if snippet not in haystack]


def check_pair(pair: Mapping[str, Any], source: str, threshold: float) -> GroundingResult:
    """Validate the shape of a pair and verify it against *source* (the excerpt it came from)."""
    question = pair.get("question")
    answer = pair.get("answer")
    evidence = pair.get("evidence")
    if pair.get("category") not in CATEGORIES or not isinstance(question, str) or not isinstance(answer, str):
        return GroundingResult(False, "invalid_shape")
    if len(question.split()) < MIN_QUESTION_WORDS:
        return GroundingResult(False, "short_question")
    if len(answer.split()) < MIN_ANSWER_WORDS:
        return GroundingResult(False, "short_answer")
    if normalize(question) == normalize(answer):
        return GroundingResult(False, "question_equals_answer")
    if not isinstance(evidence, str) or not evidence.strip():
        return GroundingResult(False, "evidence_missing")
    if not evidence_in_source(evidence, source):
        return GroundingResult(False, "evidence_not_in_source")

    overlap = token_overlap(answer, source)
    if overlap < threshold:
        return GroundingResult(False, "low_overlap", overlap)
    if invented_code(answer, source, question):
        return GroundingResult(False, "invented_code", overlap, code_ok=False)
    return GroundingResult(True, None, overlap)
