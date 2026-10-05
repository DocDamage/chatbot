"""
Training-data governance: book licenses, human review, and the export gate.

Book content is usually copyrighted. A book may feed *training* data only when its license is
``owned``, ``permissive`` or ``public_domain``; ``unknown`` and ``copyrighted`` books stay RAG-only.
That rule lives here and is enforced by the exporter itself, so there is no path that exports a
disallowed book, whichever client asked.

Review: assisted SFT pairs are model output. A book's pairs are exportable once a human approved
the book, or when its quality score reaches ``quality.verified``. Rejected pairs are recorded in the
book's ``edits.jsonl`` (keyed by stable pair id) and dropped at the next compile.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dabook.core.atomic import write_file
from dabook.core.store.db import write_txn

LICENSE_STATUSES = ("unknown", "owned", "permissive", "copyrighted", "public_domain")
TRAINING_ELIGIBLE_LICENSES = ("owned", "permissive", "public_domain")
REVIEW_STATUSES = ("unreviewed", "approved", "rejected")
EDITS_FILE = "edits.jsonl"


class GovernanceError(ValueError):
    """A request that governance refuses (bad status, ambiguous book, ineligible license...)."""


@dataclass(frozen=True)
class ExportDecision:
    eligible: bool
    reasons: list[str]


def find_book(con: sqlite3.Connection, ref: str) -> sqlite3.Row:
    """Resolve a book by id, sha256 prefix (>= 6 chars) or source path. Ambiguity is an error."""
    ref = ref.strip()
    rows: list[sqlite3.Row] = []
    if ref.isdigit():
        rows = con.execute("SELECT * FROM books WHERE id=?", (int(ref),)).fetchall()
    if not rows and len(ref) >= 6 and all(c in "0123456789abcdefABCDEF" for c in ref):
        rows = con.execute("SELECT * FROM books WHERE sha256 LIKE ?", (ref.lower() + "%",)).fetchall()
    if not rows:
        rows = con.execute("SELECT * FROM books WHERE path=?", (ref,)).fetchall()
    if not rows:
        raise GovernanceError(f"No book matches {ref!r}")
    if len(rows) > 1:
        raise GovernanceError(f"{ref!r} is ambiguous: matches {len(rows)} books")
    return rows[0]


def set_license(con: sqlite3.Connection, ref: str, status: str) -> sqlite3.Row:
    if status not in LICENSE_STATUSES:
        raise GovernanceError(f"Unknown license status {status!r}; choose from {list(LICENSE_STATUSES)}")
    book = find_book(con, ref)
    with write_txn(con):
        con.execute("UPDATE books SET license_status=? WHERE id=?", (status, book["id"]))
    return find_book(con, str(book["id"]))


def set_review_status(con: sqlite3.Connection, ref: str, status: str) -> sqlite3.Row:
    if status not in REVIEW_STATUSES:
        raise GovernanceError(f"Unknown review status {status!r}; choose from {list(REVIEW_STATUSES)}")
    book = find_book(con, ref)
    with write_txn(con):
        con.execute("UPDATE books SET review_status=? WHERE id=?", (status, book["id"]))
    return find_book(con, str(book["id"]))


def export_decision(book: sqlite3.Row, quality_verified: float) -> ExportDecision:
    """May this book's *training* data leave the workspace?"""
    reasons: list[str] = []
    if book["state"] not in ("done", "review"):
        reasons.append(f"book state is {book['state']!r}, not done")
    license_status = book["license_status"] or "unknown"
    if license_status not in TRAINING_ELIGIBLE_LICENSES:
        reasons.append(
            f"license is {license_status!r}: only {list(TRAINING_ELIGIBLE_LICENSES)} may be used for "
            "training (the book remains available for RAG)"
        )
    score = book["quality_score"]
    reviewed = book["review_status"] == "approved"
    if book["review_status"] == "rejected":
        reasons.append("the book was rejected in review")
    elif not reviewed and (score is None or score < quality_verified):
        reasons.append(
            f"not reviewed and quality {score if score is not None else 'n/a'} is below the "
            f"verified threshold {quality_verified}: review it first"
        )
    return ExportDecision(eligible=not reasons, reasons=reasons)


# --------------------------------------------------------------------------- edits.jsonl
def edits_path(workspace: Path, sha256: str) -> Path:
    return workspace / "books" / sha256[:12] / EDITS_FILE


def read_edits(workspace: Path, sha256: str) -> dict[str, dict[str, Any]]:
    """Latest decision per pair id."""
    path = edits_path(workspace, sha256)
    latest: dict[str, dict[str, Any]] = {}
    if not path.is_file():
        return latest
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            edit = json.loads(line)
        except ValueError:
            continue  # a torn final line from a crash; the earlier decisions still stand
        if edit.get("pair_id") and edit.get("action") in ("accept", "reject"):
            latest[edit["pair_id"]] = edit
    return latest


def rejected_pair_ids(workspace: Path, sha256: str) -> set[str]:
    return {pid for pid, e in read_edits(workspace, sha256).items() if e["action"] == "reject"}


def edits_digest(workspace: Path, sha256: str) -> str:
    """Digest of the effective decisions; part of the compile stage key so edits re-compile."""
    decisions = sorted((pid, e["action"]) for pid, e in read_edits(workspace, sha256).items())
    return hashlib.sha256(json.dumps(decisions).encode()).hexdigest()[:16] if decisions else "none"


def record_edit(
    workspace: Path, sha256: str, pair_id: str, action: str, reason: str | None = None
) -> dict[str, Any]:
    if action not in ("accept", "reject"):
        raise GovernanceError(f"Unknown review action {action!r}")
    path = edits_path(workspace, sha256)
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_bytes() if path.is_file() else b""
    edit = {"pair_id": pair_id, "action": action, "reason": reason, "at": time.time()}
    # Rewrite atomically (append-then-replace) so a crash never leaves a torn line.
    write_file(path, existing + (json.dumps(edit, ensure_ascii=False) + "\n").encode("utf-8"))
    return edit
