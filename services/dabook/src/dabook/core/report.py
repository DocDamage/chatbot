"""
Machine-readable book reports — the ``dabook.ingest.v1`` contract.

The Chatbot (and any other client) consumes ``dabook ingest --json``; this module builds the
per-book entries from the workspace so the CLI, tests and the JSON Schema share one definition.
All paths are relative to the workspace root and use forward slashes.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import dabook
from dabook.core.scheduler.outcomes import read_artifact

SCHEMA_ID = "dabook.ingest.v1"

# Process exit codes of ``dabook ingest``
EXIT_OK = 0
EXIT_NEEDS_INPUT = 2
EXIT_FAILED = 3
EXIT_LOCK_HELD = 4
EXIT_BAD_ARGS = 5

DATASET_KEYS = ("rag", "raw", "sft", "pretrain", "code")


def _task_key(con: sqlite3.Connection, book_id: int, stage: str) -> str | None:
    row = con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage=? AND state IN ('done','skipped') "
        "ORDER BY shard_idx LIMIT 1",
        (book_id, stage),
    ).fetchone()
    return row["stage_key"] if row else None


def build_book_report(con: sqlite3.Connection, workspace: Path, book_id: int) -> dict[str, Any]:
    book = con.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()
    sha = book["sha256"]
    warnings: list[str] = []

    validation = None
    key = _task_key(con, book_id, "s11_validate")
    if key:
        validation = read_artifact(workspace, sha, "s11_validate", key, "validation.json")
    if validation:
        warnings += [f"quality: {r}" for r in validation.get("quality_reasons", [])]

    state = book["state"]
    if state == "needs_input":
        warnings.append("ocr_required")
    elif state == "review":
        warnings.append("needs_review")
    elif state in ("queued", "active"):
        warnings.append("incomplete")
    if book["doc_type"] == "mixed":
        warnings.append("partial_text_layer")

    datasets: dict[str, str] = {}
    counts: dict[str, int] = {}
    splits: dict[str, dict[str, str]] = {}
    manifest_path = workspace / "books" / sha[:12] / "datasets" / "manifest.json"
    if state in ("done", "review") and manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for mode, info in manifest.get("files", {}).items():
                datasets[mode] = info["path"]
                counts[mode] = int(info["records"])
            for mode, by_split in (manifest.get("splits") or {}).items():
                splits[mode] = {split: info["path"] for split, info in by_split.items()}
        except (OSError, ValueError, KeyError):
            warnings.append("manifest_unreadable")

    return {
        "book_id": book["id"],
        "sha256": sha,
        "source_path": book["path"],
        "title": book["title"],
        "pages": book["pages"],
        "doc_type": book["doc_type"],
        "state": state,
        "quality_score": book["quality_score"],
        "license_status": book["license_status"],
        "review_status": book["review_status"],
        "warnings": warnings,
        "error": book["error"],
        "datasets": datasets,
        "counts": counts,
        "splits": splits,
    }


def build_ingest_report(
    con: sqlite3.Connection, workspace: Path, book_ids: list[int]
) -> dict[str, Any]:
    return {
        "schema": SCHEMA_ID,
        "dabook_version": dabook.__version__,
        "workspace": str(workspace),
        "books": [build_book_report(con, workspace, b) for b in book_ids],
    }


def exit_code_for(books: list[dict[str, Any]]) -> int:
    """failed (3) outranks needs_input (2) outranks ok (0); an unfinished book counts as failed."""
    states = {b["state"] for b in books}
    if states & {"failed", "queued", "active", "paused"}:
        return EXIT_FAILED
    if "needs_input" in states:
        return EXIT_NEEDS_INPUT
    return EXIT_OK
