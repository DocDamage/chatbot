"""
Book outcomes — turn stage artifacts into book rows and decide a book's terminal state.

S01 (inspect) and S11 (validate) produce facts the rest of the system needs on the ``books``
table: title, page count, document type, quality score (defect D8). Reading them back from the
committed artifacts, rather than from worker memory, means a fully cached re-run reaches the
same state as a fresh one.

Terminal states decided here:

* ``needs_input``  scanned PDF, no text layer: OCR is not implemented, so finishing "done"
                   with empty datasets would be a lie (1.9).
* ``review``       ``quality.review_gate`` is on and the score is below ``quality.review``.
* ``done``         everything else once every task is done or skipped.
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dabook.core.atomic import is_valid_commit
from dabook.core.store.db import write_txn
from dabook.core.store.tasks import log_event

SCANNED_MESSAGE = (
    "Scanned PDF: no usable text layer was found. OCR is not implemented yet (planned: "
    "Phase 5), so no datasets were produced."
)


@dataclass
class BookSnapshot:
    doc_type: str | None = None
    quality_score: float | None = None


def read_artifact(
    workspace: Path, sha256: str, stage: str, key: str, filename: str
) -> dict[str, Any] | None:
    directory = workspace / "books" / sha256[:12] / "stages" / stage / key
    if not is_valid_commit(directory):
        return None
    try:
        return json.loads((directory / filename).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _complete_task_key(con: sqlite3.Connection, book_id: int, stage: str) -> str | None:
    row = con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage=? AND state IN ('done','skipped') "
        "ORDER BY shard_idx LIMIT 1",
        (book_id, stage),
    ).fetchone()
    return row["stage_key"] if row else None


def sync_book_from_artifacts(
    con: sqlite3.Connection, book_id: int, workspace: Path
) -> BookSnapshot:
    """Copy title / pages / doc_type (from S01) and quality_score (from S11) onto the book row."""
    book = con.execute("SELECT sha256, path, title FROM books WHERE id=?", (book_id,)).fetchone()
    if book is None:
        return BookSnapshot()
    snap = BookSnapshot()

    key = _complete_task_key(con, book_id, "s01_inspect")
    inspection = read_artifact(workspace, book["sha256"], "s01_inspect", key, "inspection.json") if key else None
    if inspection:
        snap.doc_type = inspection.get("doc_type")
        title = inspection.get("title") or book["title"] or Path(book["path"]).stem
        with write_txn(con):
            con.execute(
                "UPDATE books SET title=?, pages=?, doc_type=? WHERE id=?",
                (title, inspection.get("page_count"), snap.doc_type, book_id),
            )

    key = _complete_task_key(con, book_id, "s11_validate")
    validation = read_artifact(workspace, book["sha256"], "s11_validate", key, "validation.json") if key else None
    if validation and validation.get("quality_score") is not None:
        snap.quality_score = float(validation["quality_score"])
        with write_txn(con):
            con.execute("UPDATE books SET quality_score=? WHERE id=?", (snap.quality_score, book_id))
    return snap


def _book_params(workspace: Path, sha256: str) -> dict[str, Any]:
    try:
        return json.loads((workspace / "books" / sha256[:12] / "params.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def settle_book(con: sqlite3.Connection, book_id: int, workspace: Path) -> str | None:
    """Sync artifacts onto the book row and move it to its terminal state if it has one."""
    snap = sync_book_from_artifacts(con, book_id, workspace)
    book = con.execute(
        "SELECT sha256, state, quality_score FROM books WHERE id=?", (book_id,)
    ).fetchone()
    if book is None or book["state"] == "removed":
        return None
    now = time.time()

    if snap.doc_type == "scanned":
        with write_txn(con):
            con.execute(
                "UPDATE tasks SET state='cancelled' WHERE book_id=? AND state='pending'", (book_id,)
            )
            con.execute(
                "UPDATE books SET state='needs_input', error=?, finished_at=? WHERE id=?",
                (SCANNED_MESSAGE, now, book_id),
            )
        if book["state"] != "needs_input":
            log_event(con, "WARNING", "ocr_required", SCANNED_MESSAGE, book_id=book_id)
        return "needs_input"

    states = {
        r["state"]
        for r in con.execute("SELECT DISTINCT state FROM tasks WHERE book_id=?", (book_id,))
    }
    if not states or states - {"done", "skipped"}:
        return book["state"]  # work remains, or a task failed (mark_failed owns that transition)

    params = _book_params(workspace, book["sha256"])
    score = snap.quality_score if snap.quality_score is not None else book["quality_score"]
    gated = (
        bool(params.get("review_gate"))
        and score is not None
        and score < float(params.get("quality_review", 0.70))
    )
    new_state = "review" if gated else "done"
    with write_txn(con):
        con.execute(
            "UPDATE books SET state=?, finished_at=COALESCE(finished_at, ?), error=NULL WHERE id=?",
            (new_state, now, book_id),
        )
    if gated and book["state"] != "review":
        log_event(
            con,
            "WARNING",
            "needs_review",
            f"Quality {score:.2f} is below the review threshold {params.get('quality_review')}",
            book_id=book_id,
        )
    return new_state


def settle_all(con: sqlite3.Connection, workspace: Path) -> int:
    """Settle every non-terminal book (crash recovery: a worker may have died after mark_done)."""
    ids = [
        r["id"]
        for r in con.execute("SELECT id FROM books WHERE state IN ('queued','active','done')")
    ]
    for book_id in ids:
        settle_book(con, book_id, workspace)
    return len(ids)
