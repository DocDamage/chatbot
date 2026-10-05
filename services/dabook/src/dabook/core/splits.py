"""
Deterministic, leak-free train/val/test splitting.

Records are split by *group* (a chapter, a section, or the whole book), never individually: every
record of a group lands in the same split, so a model is never validated on text from a chapter it
trained on. Assignment is a pure function of ``(seed, group)``: re-running with the same seed and
the same grouping gives the same split, and adding a book never moves another book's groups.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable, Iterable, Sequence
from typing import Any

SPLIT_NAMES = ("train", "val", "test")
FRONT_MATTER_GROUP = "__front_matter__"


def assign_split(group: str, seed: int, ratios: Sequence[float]) -> str:
    """Map a group key to ``train``/``val``/``test`` according to *ratios* (sum to 1)."""
    if len(ratios) != len(SPLIT_NAMES):
        raise ValueError(f"ratios must have {len(SPLIT_NAMES)} entries (train, val, test)")
    digest = hashlib.sha256(f"{seed}|{group}".encode()).digest()
    point = int.from_bytes(digest[:8], "big") / 2**64
    edge = 0.0
    for name, ratio in zip(SPLIT_NAMES, ratios, strict=True):
        edge += ratio
        if point < edge:
            return name
    return SPLIT_NAMES[-1]  # float rounding at the very top of the range


def group_key(by: str, book_sha256: str, breadcrumbs: Sequence[str] | None) -> str:
    """Group identity for a record, prefixed with the book so different books never collide."""
    crumbs = [c for c in (breadcrumbs or []) if c]
    if by == "book":
        label = "*"
    elif by == "section":
        label = " > ".join(crumbs) or FRONT_MATTER_GROUP
    else:  # chapter
        label = crumbs[0] if crumbs else FRONT_MATTER_GROUP
    return f"{book_sha256}|{label}"


def split_records(
    records: Iterable[Any],
    group_of: Callable[[Any], str],
    *,
    ratios: Sequence[float],
    seed: int,
) -> dict[str, list[Any]]:
    """Partition *records* into ``{"train": [...], "val": [...], "test": [...]}``."""
    out: dict[str, list[Any]] = {name: [] for name in SPLIT_NAMES}
    for record in records:
        out[assign_split(group_of(record), seed, ratios)].append(record)
    return out
