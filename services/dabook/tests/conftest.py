"""Shared fixtures: generated PDFs and an in-process pipeline driver."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import pytest

from dabook.config.models import DabookConfig
from dabook.core.runtime.worker import StopFlags, execute_task
from dabook.core.scheduler.eta import EtaEngine
from dabook.core.store.db import connect
from dabook.core.store.settings import load_settings
from dabook.core.store.tasks import claim_task, register_worker
from dabook.core.workspace import get_db_path, init_workspace
from tests.fixtures import make_scanned_pdf, make_technical_pdf, make_two_column_pdf


@pytest.fixture(scope="session")
def pdf_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    d = tmp_path_factory.mktemp("pdfs")
    make_technical_pdf(d / "technical.pdf")
    make_technical_pdf(d / "no_outline.pdf", chapters=2, with_outline=False)
    make_two_column_pdf(d / "twocol.pdf")
    make_scanned_pdf(d / "scanned.pdf")
    return d


@pytest.fixture()
def tech_pdf(pdf_dir: Path, tmp_path: Path) -> Path:
    """A private copy, so a test may delete or move it."""
    dest = tmp_path / "technical.pdf"
    dest.write_bytes((pdf_dir / "technical.pdf").read_bytes())
    return dest


class Pipeline:
    """A throwaway workspace plus a synchronous, in-process task runner."""

    def __init__(self, workspace_dir: Path, **cfg_overrides: Any) -> None:
        self.cfg = DabookConfig(workspace=workspace_dir, **cfg_overrides)
        self.ws = init_workspace(self.cfg)
        self.db_path = get_db_path(self.ws)
        self.con = connect(self.db_path)
        self.params = self.cfg.to_params_dict()
        self.logger = logging.getLogger("dabook.test")
        register_worker(self.con, "test-worker", 1, "cpu")

    def enqueue(self, pdf: Path, params: dict[str, Any] | None = None):
        from dabook.core.ingest import enqueue_pdf

        return enqueue_pdf(
            self.ws, self.con, pdf, params or self.params, shard_pages=self.cfg.limits.shard_pages
        )

    def drain(self, limit: int = 1000) -> int:
        """Run every claimable task to completion in this process. Returns tasks executed."""
        settings = load_settings(self.con)
        executed = 0
        while executed < limit:
            task = None
            for lane in ("io", "cpu", "llm"):
                task = claim_task(self.con, "test-worker", lane, time.time(), 90.0, free_slots=10)
                if task:
                    break
            if task is None:
                break
            execute_task(
                self.con,
                self.db_path,
                self.ws,
                "test-worker",
                task,
                settings,
                StopFlags(),
                EtaEngine(),
                self.logger,
            )
            executed += 1
        return executed

    def book(self, book_id: int) -> Any:
        return self.con.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()

    def states(self, book_id: int) -> dict[str, int]:
        rows = self.con.execute(
            "SELECT state, COUNT(*) n FROM tasks WHERE book_id=? GROUP BY state", (book_id,)
        )
        return {r["state"]: r["n"] for r in rows}

    def dataset(self, book_id: int, name: str) -> list[dict[str, Any]]:
        import json

        sha = self.book(book_id)["sha256"][:12]
        path = self.ws / "books" / sha / "datasets" / f"{name}.jsonl"
        if not path.is_file():
            return []
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]

    def close(self) -> None:
        self.con.close()


@pytest.fixture()
def pipeline(tmp_path: Path):
    p = Pipeline(tmp_path / "ws")
    yield p
    p.close()
