"""
Directory watcher behind ``dabook run --watch`` and the dashboard's upload inbox.

Polls the workspace ``inbox/`` plus any watched directories and enqueues every new or changed
PDF. A file is only picked up once its size and mtime are unchanged across two consecutive
polls, so a PDF that is still being copied or uploaded is never read half-written.
"""

from __future__ import annotations

import logging
import sqlite3
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from dabook.core.ingest import EnqueueResult, enqueue_pdf
from dabook.core.store.tasks import log_event

log = logging.getLogger("dabook.watch")

Signature = tuple[int, int]  # (size, mtime_ns)


class InboxWatcher:
    def __init__(
        self,
        workspace: Path,
        directories: Iterable[Path],
        params: dict[str, Any],
        *,
        shard_pages: int = 20,
        profile: str | None = None,
        license_status: str | None = None,
        interval: float = 5.0,
    ) -> None:
        self.workspace = workspace
        self.directories = [workspace / "inbox", *directories]
        self.params = params
        self.shard_pages = shard_pages
        self.profile = profile
        self.license_status = license_status
        self.interval = interval
        self._next_poll = 0.0
        self._seen_once: dict[Path, Signature] = {}
        self._enqueued: dict[Path, Signature] = {}

    def _scan(self) -> Iterable[Path]:
        for i, directory in enumerate(self.directories):
            if not directory.is_dir():
                continue
            # inbox is flat (uploads); user-watched directories are searched recursively
            pattern = "*.pdf" if i == 0 else "**/*.pdf"
            yield from (p for p in directory.glob(pattern) if p.is_file())

    @staticmethod
    def _signature(path: Path) -> Signature | None:
        try:
            st = path.stat()
        except OSError:
            return None
        return (st.st_size, st.st_mtime_ns)

    def poll(self, con: sqlite3.Connection, *, force: bool = False) -> list[EnqueueResult]:
        """Enqueue stable new/changed PDFs. Cheap no-op between intervals."""
        now = time.time()
        if not force and now < self._next_poll:
            return []
        self._next_poll = now + self.interval

        results: list[EnqueueResult] = []
        current: dict[Path, Signature] = {}
        for path in self._scan():
            sig = self._signature(path)
            if sig is None or sig[0] == 0:
                continue
            current[path] = sig
            if self._enqueued.get(path) == sig:
                continue
            if self._seen_once.get(path) != sig:
                self._seen_once[path] = sig  # first sighting: wait one more poll for stability
                continue
            self._enqueued[path] = sig
            try:
                result = enqueue_pdf(
                    self.workspace,
                    con,
                    path,
                    self.params,
                    shard_pages=self.shard_pages,
                    profile=self.profile,
                    license_status=self.license_status,
                )
                results.append(result)
                log.info("Watch: enqueued %s (book %d, %s)", path.name, result.book_id, result.state)
            except Exception as exc:
                log.exception("Watch: failed to enqueue %s", path)
                log_event(con, "ERROR", "watch_enqueue_failed", f"{path.name}: {exc}")
        # forget files that disappeared so a re-added file with the same signature re-enqueues
        for gone in set(self._seen_once) - set(current):
            self._seen_once.pop(gone, None)
            self._enqueued.pop(gone, None)
        return results
