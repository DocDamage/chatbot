"""
Deduplication for training and retrieval records.

* **Exact**: records whose normalized text hashes equal are the same record.
* **Near**: MinHash + LSH banding finds candidate pairs, then the *true* Jaccard similarity of their
  word-shingle sets (>= ``jaccard``) confirms them, so no two distinct passages are merged on a
  hash collision.

Order is preserved and the first occurrence wins, so results are deterministic for a given input.
Records too short to shingle (fewer than ``SHINGLE_WORDS`` words) are only exact-deduplicated.
"""

from __future__ import annotations

import hashlib
import random
import re
import zlib
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass
from typing import Any

SHINGLE_WORDS = 5
NUM_PERM = 64
BANDS = 16  # 16 bands x 4 rows: candidates for Jaccard well below 0.8, confirmed exactly afterwards
ROWS = NUM_PERM // BANDS
MAX_SHINGLES = 2000  # bottom-k sample of very long documents keeps the work bounded
_PRIME = (1 << 61) - 1
_WORD = re.compile(r"[a-z0-9]+")


def normalize(text: str) -> str:
    """Lower-cased alphanumeric words separated by single spaces."""
    return " ".join(_WORD.findall(text.lower()))


def exact_key(text: str) -> str:
    return hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()


def shingles(normalized: str, k: int = SHINGLE_WORDS) -> frozenset[int]:
    words = normalized.split()
    if len(words) < k:
        return frozenset()
    hashes = {zlib.crc32(" ".join(words[i : i + k]).encode("utf-8")) for i in range(len(words) - k + 1)}
    if len(hashes) > MAX_SHINGLES:
        hashes = set(sorted(hashes)[:MAX_SHINGLES])  # bottom-k: consistent across documents
    return frozenset(hashes)


def jaccard(a: frozenset[int], b: frozenset[int]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _permutations() -> list[tuple[int, int]]:
    rng = random.Random(0x0DA800C)  # fixed seed: signatures are stable across runs and machines
    return [(rng.randrange(1, _PRIME), rng.randrange(0, _PRIME)) for _ in range(NUM_PERM)]


_PERMS = _permutations()


def minhash(shingle_set: frozenset[int]) -> tuple[int, ...]:
    return tuple(min((a * h + b) % _PRIME for h in shingle_set) for a, b in _PERMS)


@dataclass
class DedupStats:
    input: int = 0
    exact_removed: int = 0
    near_removed: int = 0
    kept: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)

    def merge(self, other: DedupStats) -> DedupStats:
        return DedupStats(
            self.input + other.input,
            self.exact_removed + other.exact_removed,
            self.near_removed + other.near_removed,
            self.kept + other.kept,
        )


class Deduplicator:
    """Streaming deduplicator; reuse one instance to dedup across several batches (e.g. books)."""

    def __init__(self, *, exact: bool = True, near: bool = True, jaccard_threshold: float = 0.8) -> None:
        self.exact = exact
        self.near = near
        self.threshold = jaccard_threshold
        self.stats = DedupStats()
        self._seen: set[str] = set()
        self._bands: list[dict[tuple[int, ...], list[int]]] = [{} for _ in range(BANDS)]
        self._kept_shingles: list[frozenset[int]] = []

    def is_duplicate(self, text: str) -> str | None:
        """Return ``'exact'``/``'near'`` if *text* duplicates something already accepted; else
        register it and return ``None``."""
        self.stats.input += 1
        norm = normalize(text)
        if not norm:
            self.stats.kept += 1
            return None

        key = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        if self.exact and key in self._seen:
            self.stats.exact_removed += 1
            return "exact"

        sh = shingles(norm) if self.near else frozenset()
        bucket_keys: list[tuple[int, ...]] = []
        if sh:
            sig = minhash(sh)
            bucket_keys = [sig[i * ROWS : (i + 1) * ROWS] for i in range(BANDS)]
            seen_candidates: set[int] = set()
            for band, bucket_key in zip(self._bands, bucket_keys, strict=True):
                for idx in band.get(bucket_key, ()):
                    if idx in seen_candidates:
                        continue
                    seen_candidates.add(idx)
                    if jaccard(sh, self._kept_shingles[idx]) >= self.threshold:
                        self.stats.near_removed += 1
                        return "near"

        self._seen.add(key)
        if sh:
            idx = len(self._kept_shingles)
            self._kept_shingles.append(sh)
            for band, bucket_key in zip(self._bands, bucket_keys, strict=True):
                band.setdefault(bucket_key, []).append(idx)
        self.stats.kept += 1
        return None


def dedup_records(
    records: Iterable[Any],
    text_of: Callable[[Any], str],
    *,
    exact: bool = True,
    near: bool = True,
    jaccard_threshold: float = 0.8,
    deduplicator: Deduplicator | None = None,
) -> tuple[list[Any], DedupStats]:
    """Keep the first occurrence of each distinct record. Returns ``(kept, stats)``."""
    dd = deduplicator or Deduplicator(exact=exact, near=near, jaccard_threshold=jaccard_threshold)
    before = DedupStats(**dd.stats.as_dict())
    kept = [r for r in records if dd.is_duplicate(text_of(r)) is None]
    after = dd.stats
    return kept, DedupStats(
        after.input - before.input,
        after.exact_removed - before.exact_removed,
        after.near_removed - before.near_removed,
        after.kept - before.kept,
    )
