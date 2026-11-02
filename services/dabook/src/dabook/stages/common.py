"""Helpers shared by dataset-producing stages."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from dabook.core.store.db import connect
from dabook.core.store.settings import load_settings

logger = logging.getLogger("dabook.stages")


@dataclass(frozen=True)
class LiveDatasetSettings:
    filter_boilerplate: bool = True
    sft_format: str = "both"
    merge_all: bool = True
    dedup_exact: bool = True
    dedup_near: bool = True
    dedup_jaccard: float = 0.8


def read_live_dataset_settings(workspace: Path) -> LiveDatasetSettings:
    """The ``dataset.*`` rows of the settings table, or defaults when there is no database."""
    db_path = workspace / "state.db"
    if not db_path.is_file():
        return LiveDatasetSettings()
    try:
        con = connect(db_path, readonly=True)
        try:
            live = load_settings(con)
        finally:
            con.close()
        return LiveDatasetSettings(
            filter_boilerplate=live.dataset_filter_boilerplate,
            sft_format=live.dataset_sft_format,
            merge_all=live.dataset_merge_all,
        )
    except Exception as exc:  # a locked/odd database must not fail a stage
        logger.warning("Could not read live dataset settings: %s", exc)
        return LiveDatasetSettings()


def book_license_status(workspace: Path, sha256: str) -> str:
    """Current license of a book as recorded in the workspace database."""
    db_path = workspace / "state.db"
    if not db_path.is_file():
        return "unknown"
    try:
        con = connect(db_path, readonly=True)
        try:
            row = con.execute("SELECT license_status FROM books WHERE sha256=?", (sha256,)).fetchone()
        finally:
            con.close()
        return (row["license_status"] if row else None) or "unknown"
    except Exception:
        return "unknown"
