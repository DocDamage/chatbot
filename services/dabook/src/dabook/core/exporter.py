"""
Governed training-data export.

``export_training_bundle`` is the only code path that moves training records out of a workspace, and it
enforces governance itself, regardless of which client (CLI, Chatbot, a script) asked:

* every book must have a training-eligible license (owned / permissive / public_domain);
* every book must be reviewed, or score at/above ``quality.verified``;
* template ("heuristic") SFT pairs are excluded unless explicitly allowed;
* the license written into each exported record is read from the database *now*, not copied from a
  per-book file that might predate a ``dabook license`` change.

Naming specific books that are not eligible is an error (nothing is exported). Exporting "everything"
exports the eligible books and reports the rest with reasons.
"""

from __future__ import annotations

import json
import sqlite3
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import dabook
from dabook.core.atomic import write_json
from dabook.core.datasets import DedupSettings
from dabook.core.dedup import Deduplicator
from dabook.core.formats import read_jsonl, write_hf_layout, write_jsonl, write_parquet
from dabook.core.governance import (
    GovernanceError,
    export_decision,
    find_book,
)
from dabook.core.splits import SPLIT_NAMES
from dabook.core.store.settings import load_settings

TRAINING_MODES = ("sft", "pretrain", "code")
EXPORT_FORMATS = ("jsonl", "parquet", "hf")


class ExportBlocked(GovernanceError):
    """Governance refused the export. ``details`` maps book -> reasons."""

    def __init__(self, message: str, details: dict[str, list[str]]) -> None:
        super().__init__(message)
        self.details = details


def _record_text(mode: str, record: dict[str, Any]) -> str:
    if mode == "sft":
        if "instruction" in record:
            return f"{record['instruction']} {record.get('input', '')} {record.get('output', '')}"
        return " ".join(m.get("content", "") for m in record.get("messages", []) if m.get("role") != "system")
    return record.get("text") or record.get("code") or ""


@dataclass
class _BookData:
    row: sqlite3.Row
    datasets_dir: Path
    manifest: dict[str, Any]

    @property
    def title(self) -> str:
        return self.row["title"] or self.row["sha256"][:12]


def _load_book(workspace: Path, row: sqlite3.Row) -> _BookData:
    datasets_dir = workspace / "books" / row["sha256"][:12] / "datasets"
    manifest_path = datasets_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else {}
    return _BookData(row, datasets_dir, manifest)


def _book_records(book: _BookData, mode: str, *, with_splits: bool) -> dict[str, list[dict[str, Any]]]:
    """A book's records for *mode*, per split (everything is ``train`` when it has no splits)."""
    out: dict[str, list[dict[str, Any]]] = {s: [] for s in SPLIT_NAMES}
    split_files = (book.manifest.get("splits") or {}).get(mode) or {}
    if with_splits and split_files:
        for split in SPLIT_NAMES:
            info = split_files.get(split)
            if info:
                out[split] = read_jsonl(book.datasets_dir.parent.parent.parent / info["path"])
    else:
        out["train"] = read_jsonl(book.datasets_dir / f"{mode}.jsonl")
    return out


def export_training_bundle(
    con: sqlite3.Connection,
    workspace: Path,
    out_dir: Path,
    *,
    book_refs: list[str] | None = None,
    modes: list[str] | None = None,
    formats: list[str] | None = None,
    with_splits: bool = True,
    allow_heuristic: bool = False,
    dedup: DedupSettings | None = None,
) -> dict[str, Any]:
    modes = modes or ["sft"]
    formats = formats or ["jsonl"]
    bad_modes = [m for m in modes if m not in TRAINING_MODES]
    bad_formats = [f for f in formats if f not in EXPORT_FORMATS]
    if bad_modes or bad_formats:
        raise GovernanceError(f"Invalid modes {bad_modes} or formats {bad_formats}")
    dedup = dedup or DedupSettings()
    verified = load_settings(con).quality_verified

    if book_refs:
        candidates = [find_book(con, ref) for ref in book_refs]
    else:
        candidates = con.execute("SELECT * FROM books WHERE state IN ('done','review') ORDER BY sha256").fetchall()

    eligible: list[sqlite3.Row] = []
    skipped: dict[str, list[str]] = {}
    for row in candidates:
        decision = export_decision(row, verified)
        label = row["title"] or row["sha256"][:12]
        if decision.eligible:
            eligible.append(row)
        else:
            skipped[label] = decision.reasons
    if book_refs and skipped:
        raise ExportBlocked(
            "Export refused: " + "; ".join(f"{name}: {', '.join(r)}" for name, r in skipped.items()), skipped
        )
    if not eligible:
        raise ExportBlocked("No book is eligible for training export", skipped)

    books = [_load_book(workspace, row) for row in sorted(eligible, key=lambda r: r["sha256"])]
    out_dir.mkdir(parents=True, exist_ok=True)

    counts: dict[str, dict[str, int]] = {}
    dedup_stats: dict[str, dict[str, int]] = {}
    generators: Counter[str] = Counter()
    excluded_heuristic = 0
    files: list[str] = []
    per_book: dict[str, dict[str, dict[str, int]]] = {b.row["sha256"]: {} for b in books}

    for mode in modes:
        merged: dict[str, list[dict[str, Any]]] = {s: [] for s in SPLIT_NAMES}
        dd = Deduplicator(exact=dedup.exact, near=dedup.near, jaccard_threshold=dedup.jaccard)
        for book in books:
            license_now = book.row["license_status"]  # authoritative: the database, not the per-book file
            for split, records in _book_records(book, mode, with_splits=with_splits).items():
                for rec in records:
                    if rec.get("generator") == "heuristic" and not allow_heuristic:
                        excluded_heuristic += 1
                        continue
                    text = _record_text(mode, rec)
                    if text and dd.is_duplicate(text):
                        continue
                    merged[split].append({**rec, "license_status": license_now, "split": split})
                    generators[rec.get("generator", "unknown")] += 1
                    per_book[book.row["sha256"]].setdefault(mode, {}).setdefault(split, 0)
                    per_book[book.row["sha256"]][mode][split] += 1
        counts[mode] = {s: len(rows) for s, rows in merged.items()}
        dedup_stats[mode] = dd.stats.as_dict()

        for split, rows in merged.items():
            if not rows:
                continue
            if "jsonl" in formats:
                write_jsonl(out_dir / mode / f"{split}.jsonl", rows)
                files.append(f"{mode}/{split}.jsonl")
            if "parquet" in formats and write_parquet(out_dir / mode / f"{split}.parquet", rows):
                files.append(f"{mode}/{split}.parquet")
        if "hf" in formats and any(merged.values()):
            write_hf_layout(
                out_dir / "hf" / mode,
                f"training export ({mode})",
                merged,
                {
                    "books": [
                        {"title": b.title, "sha256": b.row["sha256"], "license_status": b.row["license_status"],
                         "quality_score": b.row["quality_score"]}
                        for b in books
                    ],
                    "generators": dict(generators),
                    "dedup": dedup_stats[mode],
                },
            )
            files.append(f"hf/{mode}/README.md")

    manifest = {
        "schema": "dabook.export.v1",
        "created_at": time.time(),
        "dabook_version": dabook.__version__,
        "workspace": str(workspace),
        "modes": modes,
        "formats": formats,
        "splits": with_splits,
        "allow_heuristic": allow_heuristic,
        "books": [
            {
                "book_id": b.row["id"],
                "sha256": b.row["sha256"],
                "title": b.row["title"],
                "source_path": b.row["path"],
                "license_status": b.row["license_status"],
                "review_status": b.row["review_status"],
                "quality_score": b.row["quality_score"],
                "records": per_book[b.row["sha256"]],
            }
            for b in books
        ],
        "skipped_books": skipped,
        "counts": counts,
        "generators": dict(generators),
        "dedup": {"settings": {"exact": dedup.exact, "near": dedup.near, "jaccard": dedup.jaccard}, "stats": dedup_stats},
        "excluded_heuristic_records": excluded_heuristic,
        "files": sorted(files),
    }
    write_json(out_dir / "manifest.json", manifest)
    return manifest
