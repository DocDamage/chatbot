"""
Assisted SFT generation: split a Book Graph into prompt-sized units, ask a model for grounded Q&A
pairs per unit, and keep only the pairs that survive the grounding checks.

Everything here is a pure function of its inputs plus the injected provider/cache/budget, so it is
testable without a model or a PDF. Model responses are cached by prompt hash, so re-running (after a
crash, a budget top-up, or a stage re-plan) costs nothing for units already answered.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from dabook.assist.cache import LLMCache
from dabook.assist.grounding import check_pair
from dabook.assist.providers import EXCERPT_END, EXCERPT_START, LLMProvider, ProviderError
from dabook.core.dedup import normalize

NON_CONTENT_TYPES = ("book", "toc", "furniture")
SOURCE_EXCERPT_CHARS = 1200
MAX_CONSECUTIVE_FAILURES = 5

SYSTEM_PROMPT = (
    "You write training data from an excerpt of a book. Use ONLY the excerpt: never add facts, "
    "commands or code that are not in it. Reply with JSON and nothing else."
)


@dataclass
class Unit:
    unit_id: str
    node_ids: list[str]
    page_start: int
    page_end: int
    breadcrumbs: list[str]
    text: str
    words: int


@dataclass
class Budget:
    """Spend tracker. ``paid`` providers are capped at ``max_usd``; free ones are never stopped."""

    max_usd: float
    price_prompt: float = 0.0  # USD per 1k prompt tokens
    price_completion: float = 0.0
    paid: bool = False
    spent: float = 0.0

    def exhausted(self) -> bool:
        return self.paid and self.spent >= self.max_usd

    def charge(self, prompt_tokens: int, completion_tokens: int) -> float:
        cost = prompt_tokens / 1000 * self.price_prompt + completion_tokens / 1000 * self.price_completion
        self.spent += cost
        return cost


@dataclass
class AssistParams:
    max_pairs: int = 3
    min_words: int = 60
    max_words: int = 900
    grounding_threshold: float = 0.6
    temperature: float = 0.2
    max_tokens: int = 1024
    timeout_s: float = 120.0


@dataclass
class UnitResult:
    pairs: list[dict[str, Any]] = field(default_factory=list)
    rejections: list[dict[str, Any]] = field(default_factory=list)
    called: bool = False
    cache_hit: bool = False
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0


# --------------------------------------------------------------------------- units
def build_units(
    nodes: list[dict[str, Any]],
    *,
    min_words: int,
    max_words: int,
    skip_node: Callable[[dict[str, Any]], bool] = lambda n: False,
) -> tuple[list[Unit], int]:
    """Group consecutive body nodes under their heading. Returns ``(units, skipped_small)``."""
    units: list[Unit] = []
    skipped = 0
    crumbs: list[str] = []
    segments: list[str] = []
    node_ids: list[str] = []
    pages: list[int] = []
    words = 0

    def close() -> None:
        nonlocal segments, node_ids, pages, words, skipped
        if segments:
            if words >= min_words:
                digest = hashlib.sha256(f"{node_ids[0]}|{node_ids[-1]}|{len(node_ids)}".encode()).hexdigest()[:12]
                units.append(Unit(digest, node_ids, min(pages) + 1, max(pages) + 1, list(crumbs), "\n\n".join(segments), words))
            else:
                skipped += 1
        segments, node_ids, pages, words = [], [], [], 0

    for node in nodes:
        ntype = node["node_type"]
        if ntype in NON_CONTENT_TYPES:
            continue
        if ntype in ("chapter", "section"):
            close()
            crumbs = [*node.get("breadcrumbs", []), node.get("title") or node["text"].strip()]
            continue
        if skip_node(node):
            continue
        text = node["text"].strip()
        if not text:
            continue
        if ntype == "code":
            lang = (node.get("metadata") or {}).get("language") or ""
            text = f"```{'' if lang == 'text' else lang}\n{text}\n```"
        w = len(text.split())
        if w > max_words:  # one enormous node: keep its head so the prompt stays bounded
            text = " ".join(text.split()[:max_words])
            w = max_words
        if node_ids and words + w > max_words:
            close()
        segments.append(text)
        node_ids.append(node["node_id"])
        pages.append(node.get("page_idx", 0))
        words += w
    close()
    return units, skipped


# --------------------------------------------------------------------------- prompts
def build_user_prompt(unit: Unit, max_pairs: int) -> str:
    where = " > ".join(unit.breadcrumbs) or "front matter"
    return (
        f"Book section: {where} (pages {unit.page_start}-{unit.page_end})\n"
        f"{EXCERPT_START}\n{unit.text}\n{EXCERPT_END}\n\n"
        f"Write up to {max_pairs} question-and-answer pairs that a reader could answer from the excerpt "
        "alone. Respond with JSON only, in exactly this shape:\n"
        '{"pairs":[{"category":"qa|explain|code_walkthrough","question":"...","answer":"...",'
        '"evidence":"one sentence copied exactly from the excerpt that supports the answer"}]}\n'
        "Rules: each answer is complete and at least 15 words; copy code and commands exactly as they "
        "appear in the excerpt; use code_walkthrough only for code or commands; never invent details."
    )


_FENCED_JSON = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def parse_response(text: str) -> list[dict[str, Any]]:
    """Extract the list of pair dicts from a model reply; ``ValueError`` if there is none."""
    body = text.strip()
    fenced = _FENCED_JSON.match(body)
    if fenced:
        body = fenced.group(1)
    try:
        data = json.loads(body)
    except ValueError:
        start, end = body.find("{"), body.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("response contains no JSON object") from None
        data = json.loads(body[start : end + 1])
    pairs = data.get("pairs") if isinstance(data, dict) else data
    if not isinstance(pairs, list) or not all(isinstance(p, dict) for p in pairs):
        raise ValueError("response JSON has no list of pairs")
    return pairs


def pair_id(book_sha256: str, node_ids: list[str], question: str) -> str:
    raw = f"{book_sha256}|{'|'.join(sorted(node_ids))}|{normalize(question)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# --------------------------------------------------------------------------- one unit
def run_unit(
    unit: Unit,
    *,
    provider: LLMProvider,
    cache: LLMCache,
    params: AssistParams,
    budget: Budget,
    book_sha256: str,
    sleep: Callable[[float], None] = time.sleep,
) -> UnitResult:
    """Generate and verify pairs for one unit. Raises ``ProviderError`` after retries are spent."""
    result = UnitResult()
    user = build_user_prompt(unit, params.max_pairs)
    key = cache.key(provider.name, SYSTEM_PROMPT, user, params.temperature, params.max_tokens)

    cached = cache.get(key)
    if cached is not None:
        result.cache_hit = True
        text = cached["text"]
    else:
        last: ProviderError | None = None
        text = ""
        for attempt in range(3):
            try:
                reply = provider.complete(
                    SYSTEM_PROMPT, user,
                    temperature=params.temperature, max_tokens=params.max_tokens, timeout_s=params.timeout_s,
                )
                text = reply.text
                result.called = True
                result.prompt_tokens, result.completion_tokens = reply.prompt_tokens, reply.completion_tokens
                result.cost_usd = budget.charge(reply.prompt_tokens, reply.completion_tokens)
                break
            except ProviderError as exc:
                last = exc
                if attempt < 2:
                    # linear backoff; DABOOK_ASSIST_BACKOFF_S scales it (tests set it to 0)
                    sleep(float(os.environ.get("DABOOK_ASSIST_BACKOFF_S", "2.0")) * (attempt + 1))
        else:
            raise last if last else ProviderError("provider failed")

    try:
        raw_pairs = parse_response(text)
    except ValueError as exc:
        result.rejections.append({"unit_id": unit.unit_id, "reason": "unparseable_response", "detail": str(exc)})
        return result
    if cached is None:  # only well-formed replies are worth caching
        cache.put(key, {"text": text, "provider": provider.name, "unit_id": unit.unit_id})

    for raw in raw_pairs[: params.max_pairs]:
        check = check_pair(raw, unit.text, params.grounding_threshold)
        if not check.ok:
            result.rejections.append({
                "unit_id": unit.unit_id,
                "reason": check.reason,
                "question": str(raw.get("question", ""))[:200],
                "overlap": round(check.overlap, 3),
            })
            continue
        question = raw["question"].strip()
        code_in_answer = "```" in raw["answer"]
        result.pairs.append({
            "pair_id": pair_id(book_sha256, unit.node_ids, question),
            "category": raw["category"],
            "instruction": question,
            "input": "",
            "output": raw["answer"].strip(),
            "evidence": raw["evidence"].strip(),
            "source_node_ids": unit.node_ids,
            "pages": [unit.page_start, unit.page_end],
            "breadcrumbs": unit.breadcrumbs,
            "generator": f"assist:{provider.name}",
            "source_excerpt": unit.text[:SOURCE_EXCERPT_CHARS],
            "grounding": {**check.as_dict(), "has_code": code_in_answer},
        })
    return result
