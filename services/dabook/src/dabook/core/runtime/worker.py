"""
Worker process — the main function run in each spawned worker process.

Each worker:
1. Connects to the DB
2. Loads models once (warm for all tasks)
3. Claims tasks in a tight loop
4. Runs the stage function
5. Commits artifacts atomically
6. Heartbeats every ``heartbeat_s`` seconds

Workers are spawned by the supervisor with ``multiprocessing.spawn`` (safe for
CUDA/Torch). They communicate only via the SQLite DB and the filesystem.
"""

from __future__ import annotations

import multiprocessing
import os
import signal
import threading
import time
import traceback
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dabook.core.scheduler.eta import EtaEngine
from dabook.core.scheduler.outcomes import settle_book
from dabook.core.store.db import connect
from dabook.core.store.settings import LiveSettings, SettingsCache, read_flag
from dabook.core.store.tasks import (
    claim_task,
    deregister_worker,
    heartbeat,
    log_event,
    mark_done,
    mark_failed,
    mark_worker_models_loaded,
    register_worker,
    release_task_unspent,
    set_worker_idle,
    upstream_stage_keys,
)
from dabook.assist.providers import ProviderError
from dabook.stages.registry import MissingSourceError, MissingUpstreamError

# ---------------------------------------------------------------------------
# Stop flags (set by signal handlers)
# ---------------------------------------------------------------------------


@dataclass
class StopFlags:
    soft: bool = False  # finish current task then exit (Ctrl+C once)
    hard: bool = False  # abort current task at next checkpoint (Ctrl+C 2×)


# ---------------------------------------------------------------------------
# Heartbeat thread
# ---------------------------------------------------------------------------


class HeartbeatThread(threading.Thread):
    """Sends heartbeats to the DB every ``interval`` seconds."""

    def __init__(
        self,
        db_path: Path,
        worker_id: str,
        task_id: int,
        lease_s: float,
        interval: float = 15.0,
    ) -> None:
        super().__init__(daemon=True, name=f"hb-{worker_id}")
        self._db_path = db_path
        self._worker_id = worker_id
        self._task_id = task_id
        self._lease_s = lease_s
        self._interval = interval
        self._stop_evt = threading.Event()
        self._units_done = 0
        self._substep: str | None = None
        self._lock = threading.Lock()

    def progress(self, units_done: int, substep: str | None = None) -> None:
        with self._lock:
            self._units_done = units_done
            self._substep = substep

    def stop(self) -> None:
        self._stop_evt.set()

    def run(self) -> None:
        con = connect(self._db_path)
        try:
            while not self._stop_evt.wait(self._interval):
                with self._lock:
                    ud = self._units_done
                    ss = self._substep
                try:
                    import psutil

                    rss = psutil.Process().memory_info().rss / 1024 / 1024
                except Exception:
                    rss = 0.0
                try:
                    heartbeat(
                        con,
                        self._worker_id,
                        self._task_id,
                        self._lease_s,
                        rss_mb=rss,
                        units_done=ud,
                        substep=ss,
                    )
                except Exception:
                    pass
        finally:
            con.close()


# ---------------------------------------------------------------------------
# Fake stage runners (M1 infrastructure test)
# ---------------------------------------------------------------------------


def _run_fake_stage(
    task: dict[str, Any],
    work_dir: Path,
    progress_fn: Callable[[int, str | None], None],
    should_abort: Callable[[], bool],
    eta: EtaEngine,
) -> dict[str, Any]:
    """
    Fake stage: sleeps proportionally to shard size, emits progress,
    writes a stub output file.  Used in M0/M1 before real stages exist.
    """
    import random

    from dabook.core.atomic import StageCommit, write_json

    stage = task["stage"]
    units = task.get("units_total") or 1
    ms_per_unit = eta.ms_per_unit(stage)
    sleep_total = (ms_per_unit * units / 1000) * random.uniform(0.5, 1.5)
    sleep_total = min(sleep_total, 30.0)  # cap for sanity in tests

    step = max(1, units // 10)
    done = 0
    t0 = time.time()

    while done < units:
        if should_abort():
            raise RuntimeError("Aborted")
        batch = min(step, units - done)
        time.sleep(sleep_total / max(1, units / batch))
        done += batch
        progress_fn(done, f"{stage} page {done}/{units}")

    elapsed_ms = int((time.time() - t0) * 1000)
    eta.record(stage, units, elapsed_ms)

    # Write stub artifact
    meta = {"stage": stage, "task_id": task["id"], "units": units, "impl_version": "0.1.0-fake"}
    stage_dir = work_dir / "stages" / stage
    key = task["stage_key"]

    try:
        with StageCommit(stage_dir, key, meta) as out_dir:
            write_json(out_dir / "output.json", {"status": "ok", **meta})
    except FileExistsError:
        pass  # concurrent worker already committed; fine

    return {
        "output_path": str(stage_dir / key),
        "duration_ms": elapsed_ms,
    }


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------


# Failure classes where another attempt cannot succeed.
NON_RETRYABLE = frozenset({"missing_source", "corrupt_pdf"})


def classify_error(exc: BaseException) -> str:
    if isinstance(exc, MissingSourceError):
        return "missing_source"
    if isinstance(exc, MissingUpstreamError):
        return "missing_upstream"
    if isinstance(exc, ProviderError):
        return "model_error"
    msg = str(exc).lower()
    if "cuda out of memory" in msg or "oom" in msg:
        return "oom"
    if "timeout" in msg:
        return "timeout"
    if "no space left" in msg or "enospc" in msg:
        return "disk_full"
    if ("pdf" in msg or "pdfium" in msg) and (
        "corrupt" in msg or "invalid" in msg or "failed to load" in msg or "format error" in msg
    ):
        return "corrupt_pdf"
    if isinstance(exc, MemoryError):
        return "oom"
    return "bug"


def fake_stages_enabled() -> bool:
    """The synthetic sleep-and-stub stage exists for infrastructure tests only."""
    return os.environ.get("DABOOK_FAKE_STAGES") == "1"


def execute_task(
    con: Any,
    db_path: Path,
    workspace: Path,
    worker_id: str,
    task: dict[str, Any],
    s: LiveSettings,
    stop: StopFlags,
    eta: EtaEngine,
    logger: Any,
) -> str:
    """
    Run one claimed task to completion and record the outcome.

    Returns the task's resulting state (``done``, ``pending`` for a retry or graceful release,
    ``dead``). A missing source PDF fails the task as ``missing_source`` instead of producing
    fake output (defect D10).
    """
    book_id = task["book_id"]
    logger.info("Claimed task %d: %s shard=%d", task["id"], task["stage"], task["shard_idx"])

    hb_thread = HeartbeatThread(
        db_path, worker_id, task["id"], lease_s=s.lease_s, interval=s.heartbeat_s
    )
    hb_thread.start()
    t0 = time.time()
    try:
        book = con.execute("SELECT sha256, path FROM books WHERE id=?", (book_id,)).fetchone()
        if book is None:
            raise RuntimeError(f"book {book_id} no longer exists")
        book_work_dir = workspace / "books" / book["sha256"][:12]
        pdf_path = Path(book["path"])

        if not pdf_path.is_file() and fake_stages_enabled():
            result = _run_fake_stage(
                task, book_work_dir, hb_thread.progress, lambda: stop.hard, eta
            )
        else:
            from dabook.stages.runner import load_params, run_stage

            result = run_stage(
                task,
                work_dir=book_work_dir,
                pdf_path=pdf_path,
                progress_fn=hb_thread.progress,
                should_abort=lambda: stop.hard,
                upstream=upstream_stage_keys(con, task["id"]),
                params=load_params(book_work_dir),
            )

        duration_ms = int((time.time() - t0) * 1000)
        mark_done(
            con,
            task["id"],
            output_path=result.get("output_path"),
            duration_ms=result.get("duration_ms", duration_ms),
        )
        con.execute(
            "INSERT INTO stage_stats (stage, units, ms, ts) VALUES (?,?,?,?)",
            (task["stage"], task.get("units_total") or 1, duration_ms, time.time()),
        )
        # Publish facts from S01/S11 onto the book row and decide terminal states (done,
        # review, needs_input) immediately, not at the next supervisor tick.
        settle_book(con, book_id, workspace)

        logger.info("Task %d done in %.1fs: %s", task["id"], time.time() - t0, task["stage"])
        log_event(
            con,
            "INFO",
            "task_done",
            f"Stage {task['stage']} shard {task['shard_idx']} done",
            book_id=book_id,
            task_id=task["id"],
            worker_id=worker_id,
        )
        return "done"

    except (KeyboardInterrupt, SystemExit):
        release_task_unspent(con, task["id"])  # graceful: don't burn the attempt
        stop.soft = True
        logger.info("Task %d released (graceful stop)", task["id"])
        return "pending"

    except Exception as exc:
        err_class = classify_error(exc)
        retryable = err_class not in NON_RETRYABLE
        # A missing file needs a clean message, not a traceback.
        err_msg = str(exc) if not retryable else traceback.format_exc()[-2000:]
        logger.error("Task %d failed (%s): %s", task["id"], err_class, exc)
        new_state = mark_failed(
            con,
            task["id"],
            err_class,
            err_msg,
            max_attempts=s.max_attempts,
            backoff_s=s.backoff_s,
            retryable=retryable,
        )
        log_event(
            con,
            "ERROR",
            f"task_{new_state}",
            f"{err_class}: {exc}",
            book_id=book_id,
            task_id=task["id"],
            worker_id=worker_id,
            data={"error_class": err_class},
        )
        return new_state

    finally:
        hb_thread.stop()
        hb_thread.join(timeout=2.0)


# ---------------------------------------------------------------------------
# Worker main loop
# ---------------------------------------------------------------------------


def worker_main(
    db_path: Path,
    workspace: Path,
    worker_id: str,
    resource_class: str,
    gpu_index: int | None = None,
    log_dir: Path | None = None,
) -> None:
    """Entry point for each spawned worker process."""
    from dabook.core.logging import setup_logging

    log_dir = log_dir or workspace / "logs" / "workers"
    logger = setup_logging(log_dir, worker_id)
    logger.info("Worker starting: %s class=%s gpu=%s", worker_id, resource_class, gpu_index)

    con = connect(db_path)
    settings_cache = SettingsCache(con)
    eta = EtaEngine()

    # Signal handling
    stop = StopFlags()

    def _soft_stop(sig: int, frame: object) -> None:
        logger.info("SIGTERM/SIGINT: finishing current task…")
        stop.soft = True

    def _hard_stop(sig: int, frame: object) -> None:
        logger.warning("Second interrupt: aborting current task")
        stop.hard = True

    signal.signal(signal.SIGTERM, _soft_stop)
    try:
        signal.signal(signal.SIGINT, _soft_stop)
    except (OSError, ValueError):
        pass  # non-main thread on some platforms

    # Register in DB
    register_worker(con, worker_id, os.getpid(), resource_class, gpu_index)

    # No model backends yet (OCR / layout models arrive with Phase 5); the pdfium route is CPU-only.
    mark_worker_models_loaded(con, worker_id)

    consecutive_errors = 0
    parent = multiprocessing.parent_process()

    try:
        while not stop.hard:
            # An orphaned worker (supervisor killed hard) would poll the DB forever.
            if parent is not None and not parent.is_alive():
                logger.warning("Supervisor process is gone; exiting")
                break

            s = settings_cache.get()

            # `stopping` and `draining` are read uncached so a worker reacts within one poll.
            if s.stopping or stop.soft or read_flag(con, "stopping") or _is_draining(con, worker_id):
                logger.info("Stop/drain flag set; exiting")
                break

            if s.queue_paused:
                try:
                    set_worker_idle(con, worker_id)
                except Exception:
                    pass
                time.sleep(0.5)
                continue

            # A transient DB error (locked, busy) must not kill the worker.
            try:
                active_count = con.execute(
                    "SELECT COUNT(*) FROM books WHERE state='active'"
                ).fetchone()[0]
                task = claim_task(
                    con,
                    worker_id,
                    resource_class,
                    now=time.time(),
                    lease_s=s.lease_s,
                    free_slots=s.free_book_slots(active_count),
                )
                consecutive_errors = 0
            except Exception as claim_exc:
                consecutive_errors += 1
                backoff = min(30.0, 0.5 * (2 ** min(consecutive_errors, 6)))
                logger.warning(
                    "DB error in claim loop (attempt %d, retry in %.1fs): %s",
                    consecutive_errors,
                    backoff,
                    claim_exc,
                )
                time.sleep(backoff)
                continue

            if task is None:
                try:
                    set_worker_idle(con, worker_id)
                except Exception:
                    pass
                time.sleep(0.5)
                continue

            execute_task(con, db_path, workspace, worker_id, task, s, stop, eta, logger)

    except Exception as exc:
        logger.exception("Worker crashed: %s", exc)
    finally:
        deregister_worker(con, worker_id)
        con.close()
        logger.info("Worker exiting: %s", worker_id)


def _is_draining(con: Any, worker_id: str) -> bool:
    try:
        row = con.execute("SELECT state FROM workers WHERE id=?", (worker_id,)).fetchone()
    except Exception:
        return False
    return row is not None and row["state"] == "draining"
