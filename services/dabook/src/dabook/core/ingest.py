"""
Enqueue PDFs into a workspace: register, count pages, plan.

One code path for the CLI (``run`` / ``ingest``), watch mode and the dashboard (launch/upload),
so every entry point registers and plans a book identically.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dabook.core.scheduler.planner import plan_book
from dabook.core.store.db import write_txn
from dabook.core.workspace import register_pdf

log = logging.getLogger("dabook.ingest")


@dataclass
class EnqueueResult:
    book_id: int
    sha256: str
    path: str
    pages: int
    state: str
    counts: dict[str, int] = field(default_factory=dict)
    error: str | None = None


def count_pages(pdf_path: Path) -> int | None:
    """Page count, or ``None`` when the file cannot be opened as a PDF."""
    try:
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(str(pdf_path))
        try:
            return len(doc)
        finally:
            doc.close()
    except Exception as exc:
        log.warning("Cannot open %s: %s", pdf_path, exc)
        return None


def enqueue_pdf(
    workspace: Path,
    con: sqlite3.Connection,
    pdf_path: Path,
    params: dict[str, Any],
    *,
    shard_pages: int = 20,
    profile: str | None = None,
    priority: int = 0,
    license_status: str | None = None,
) -> EnqueueResult:
    """
    Register *pdf_path* and plan its tasks. Idempotent: the same content registers once, a
    fully cached book plans to all-``skipped`` and settles immediately.

    An unreadable or empty PDF is recorded as a ``failed`` book (with the reason) instead of
    raising, so one bad file never aborts a batch.
    """
    pdf_path = pdf_path.resolve()
    book_id, sha = register_pdf(
        workspace, pdf_path, priority=priority, profile=profile, license_status=license_status
    )
    pages = count_pages(pdf_path)
    if not pages:
        error = "corrupt_pdf: the file is not a readable PDF or has no pages"
        with write_txn(con):
            con.execute(
                "UPDATE books SET state='failed', error=?, pages=0 WHERE id=?", (error, book_id)
            )
        return EnqueueResult(book_id, sha, str(pdf_path), 0, "failed", error=error)

    with write_txn(con):
        con.execute("UPDATE books SET pages=? WHERE id=?", (pages, book_id))
    counts = plan_book(con, book_id, sha, pages, workspace, params, shard_pages=shard_pages)
    state = con.execute("SELECT state FROM books WHERE id=?", (book_id,)).fetchone()["state"]
    return EnqueueResult(book_id, sha, str(pdf_path), pages, state, counts)
