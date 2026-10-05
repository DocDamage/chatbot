"""
Supervisor process — orchestrates workers, runs recovery, serves the dashboard.

The supervisor is the single owner of the workspace lock. It spawns worker processes (using
``multiprocessing.spawn``), reconciles them against the desired worker count in the settings
table every second, and runs the telemetry sampler + FastAPI dashboard in threads.

Lifetime:

* **Batch** (``exit_when_idle=True``, the default whenever there is no dashboard and no watch):
  once no task is pending or running, workers are drained and ``start()`` returns. This is what
  lets ``dabook run --no-ui`` and ``dabook ingest`` be used as subprocesses (defect D1).
* **Service** (dashboard or ``--watch``): runs until stopped, polling the inbox for new PDFs.
"""

from __future__ import annotations

import logging
import multiprocessing
import signal
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dabook.core.atomic import sweep_partials
from dabook.core.runtime.telemetry import TelemetrySampler
from dabook.core.scheduler.eta import EtaEngine
from dabook.core.scheduler.outcomes import settle_all
from dabook.core.scheduler.recovery import recover_leases
from dabook.core.store.db import connect, write_txn
from dabook.core.store.settings import SettingsCache, set_stopping
from dabook.core.store.tasks import log_event, release_task_unspent
from dabook.core.watch import InboxWatcher

log = logging.getLogger("dabook.supervisor")

LANES = ("cpu", "gpu", "io", "llm")

_WORK_REMAINING_SQL = """
SELECT COUNT(*)
  FROM tasks t JOIN books b ON b.id = t.book_id
 WHERE t.state = 'running'
    OR (t.state = 'pending' AND b.state IN ('queued','active') AND b.paused = 0)
"""

_LANE_DEMAND_SQL = """
SELECT t.resource_class AS lane, COUNT(*) AS n
  FROM tasks t JOIN books b ON b.id = t.book_id
 WHERE t.state IN ('pending','running')
   AND b.state IN ('queued','active') AND b.paused = 0
 GROUP BY t.resource_class
"""


@dataclass
class ManagedWorker:
    worker_id: str
    resource_class: str
    gpu_index: int | None
    process: multiprocessing.Process
    draining: bool = False
    crash_count: int = 0
    last_crash: float = 0.0


class Supervisor:
    """
    The main supervisor object.

    Usage::

        sup = Supervisor(workspace, db_path, start_ui=False)
        sup.start()         # batch mode: returns when all work is done
    """

    RECOVERY_INTERVAL = 30.0
    RECONCILE_INTERVAL = 0.5
    CRASH_LOOP_WINDOW = 300.0  # 5 min
    CRASH_LOOP_LIMIT = 3
    IDLE_TICKS_BEFORE_EXIT = 2  # consecutive "no work" observations (avoids exiting mid-handoff)

    def __init__(
        self,
        workspace: Path,
        db_path: Path,
        port: int = 8765,
        open_browser: bool = True,
        start_ui: bool = True,
        *,
        exit_when_idle: bool | None = None,
        watcher: InboxWatcher | None = None,
        timeout_s: float | None = None,
        cors_origins: list[str] | None = None,
    ) -> None:
        self.workspace = workspace
        self.db_path = db_path
        self.port = port
        self.open_browser = open_browser
        self.start_ui = start_ui
        self.watcher = watcher
        self.cors_origins = cors_origins
        self.timeout_s = timeout_s
        # Batch by default; a dashboard or a watcher makes the supervisor a long-lived service.
        self.exit_when_idle = (
            exit_when_idle if exit_when_idle is not None else not (start_ui or watcher)
        )
        self.timed_out = False

        self._con = connect(db_path)
        self._settings = SettingsCache(self._con)
        self._eta = EtaEngine()
        self._pool: dict[str, list[ManagedWorker]] = {lane: [] for lane in LANES}
        self._death_history: dict[str, list[float]] = {lane: [] for lane in LANES}
        self._spawn_cooldown: dict[str, float] = dict.fromkeys(LANES, 0.0)
        self._stop_evt = threading.Event()
        self._telemetry: TelemetrySampler | None = None
        self._next_recovery = time.time()
        self._worker_seq: dict[str, int] = {}
        self._lane_cap: dict[str, int] | None = None
        self._deadline: float | None = None
        self._hard = False  # second Ctrl+C: stop waiting for running tasks

    # ------------------------------------------------------------------
    def start(self) -> None:
        log.info("Supervisor starting (workspace=%s, batch=%s)", self.workspace, self.exit_when_idle)

        set_stopping(self._con, False)  # clear a stale flag from a previous run
        self._settings.invalidate()
        self._startup_recovery()

        # A fully cached batch needs no workers, no sampler and no process spawns at all.
        if self.exit_when_idle and not self._work_remaining():
            log.info("No work to do; exiting without starting workers")
            self._finish()
            return

        if self.timeout_s:
            self._deadline = time.time() + self.timeout_s
        if self.exit_when_idle:
            self._lane_cap = self._lane_demand()

        self._telemetry = TelemetrySampler(self.db_path, self.workspace)
        self._telemetry.start()

        if self.start_ui:
            self._start_dashboard()

        try:
            signal.signal(signal.SIGTERM, self._handle_sigterm)
            signal.signal(signal.SIGINT, self._handle_sigint)
        except (OSError, ValueError):
            pass  # not the main thread (tests, embedded use)

        log.info("Supervisor running.%s", f" Dashboard: http://127.0.0.1:{self.port}" if self.start_ui else "")
        self._run_loop()

    def request_stop(self) -> None:
        """Thread-safe: ask the loop to drain and return."""
        set_stopping(self._con, True)
        self._stop_evt.set()

    # ------------------------------------------------------------------
    def _work_remaining(self) -> bool:
        return bool(self._con.execute(_WORK_REMAINING_SQL).fetchone()[0])

    def _lane_demand(self) -> dict[str, int]:
        demand = dict.fromkeys(LANES, 0)
        for row in self._con.execute(_LANE_DEMAND_SQL):
            demand[row["lane"]] = int(row["n"])
        return demand

    def _run_loop(self) -> None:
        idle_ticks = 0
        while not self._stop_evt.is_set():
            try:
                self._settings.invalidate()
                s = self._settings.get()

                if s.stopping:  # `dabook stop` (or the dashboard's drain) from another process
                    log.info("Stop flag set; shutting down")
                    break

                if self.watcher is not None:
                    self.watcher.poll(self._con)

                self._reconcile(s)

                if time.time() >= self._next_recovery:
                    n = recover_leases(self._con)
                    if n:
                        log.info("Recovered %d stale tasks", n)
                    self._next_recovery = time.time() + self.RECOVERY_INTERVAL

                if self._deadline is not None and time.time() >= self._deadline:
                    log.warning("Timeout after %.0fs; stopping with work remaining", self.timeout_s)
                    self.timed_out = True
                    break

                if self.exit_when_idle:
                    idle_ticks = 0 if self._work_remaining() else idle_ticks + 1
                    if idle_ticks >= self.IDLE_TICKS_BEFORE_EXIT:
                        log.info("All work done; shutting down")
                        break

                time.sleep(self.RECONCILE_INTERVAL)

            except KeyboardInterrupt:
                break
            except Exception as exc:
                log.exception("Supervisor loop error: %s", exc)
                time.sleep(2)

        self._shutdown()

    def _reconcile(self, s: Any) -> None:
        """Spawn / drain workers to match the desired counts."""
        if s.stopping or self._stop_evt.is_set():
            # Stopping: never spawn; mark everything draining.
            for lane, workers in self._pool.items():
                for w in [w for w in workers if not w.process.is_alive()]:
                    self._handle_worker_death(w)
                self._pool[lane] = [w for w in workers if w.process.is_alive()]
                for w in self._pool[lane]:
                    if not w.draining:
                        self._mark_draining(w)
            return

        want = {
            "cpu": s.workers_cpu,
            "gpu": s.workers_gpu,
            "io": s.workers_io,
            "llm": s.workers_llm,
        }
        if self._lane_cap is not None:  # batch mode: never more workers than there are tasks
            want = {lane: min(n, self._lane_cap.get(lane, 0)) for lane, n in want.items()}

        for lane, desired in want.items():
            workers = self._pool[lane]
            for w in [w for w in workers if not w.process.is_alive()]:
                self._handle_worker_death(w)
            self._pool[lane] = [w for w in workers if w.process.is_alive()]
            alive = [w for w in self._pool[lane] if not w.draining]

            if len(alive) < desired:
                for _ in range(desired - len(alive)):
                    if self._crash_loop_breaker(lane):
                        break
                    self._spawn(lane)
                    time.sleep(0.1)  # stagger process spawns to avoid a storm
            elif len(alive) > desired:
                excess = len(alive) - desired
                for w in sorted(alive, key=lambda w: w.last_crash or 0, reverse=True)[:excess]:
                    self._mark_draining(w)

    def _spawn(self, lane: str, gpu_index: int | None = None) -> None:
        seq = self._worker_seq.get(lane, 0) + 1
        self._worker_seq[lane] = seq
        worker_id = f"worker-{lane}-{seq}"

        from dabook.core.runtime.worker import worker_main

        p = multiprocessing.Process(
            target=worker_main,
            args=(self.db_path, self.workspace, worker_id, lane),
            kwargs={"gpu_index": gpu_index, "log_dir": self.workspace / "logs" / "workers"},
            daemon=True,
            name=worker_id,
        )
        p.start()
        self._pool[lane].append(ManagedWorker(worker_id, lane, gpu_index, p))
        log.info("Spawned %s (pid=%d)", worker_id, p.pid)

    def _mark_draining(self, w: ManagedWorker) -> None:
        w.draining = True
        with write_txn(self._con):
            self._con.execute("UPDATE workers SET state='draining' WHERE id=?", (w.worker_id,))

    def _handle_worker_death(self, w: ManagedWorker) -> None:
        code = w.process.exitcode
        log.warning("Worker %s died (exitcode=%s)", w.worker_id, code)
        # A worker that was asked to drain/stop and exited cleanly is not a crash.
        if not (w.draining and code == 0):
            self._death_history[w.resource_class].append(time.time())

        try:
            w.process.join(timeout=0.1)
            w.process.close()
        except Exception:
            pass

        # Mark worker dead and immediately release any uncompleted task it held
        try:
            with write_txn(self._con):
                self._con.execute("UPDATE workers SET state='dead' WHERE id=?", (w.worker_id,))
                row = self._con.execute(
                    "SELECT id FROM tasks WHERE worker_id=? AND state='running'", (w.worker_id,)
                ).fetchone()
                if row:
                    release_task_unspent(self._con, row["id"])
                    log.info(
                        "Released task %d back to pending from dead worker %s",
                        row["id"],
                        w.worker_id,
                    )
        except Exception as exc:
            log.warning("Error releasing task for dead worker %s: %s", w.worker_id, exc)

        if code == -9:
            log_event(
                self._con,
                "WARNING",
                "worker_oom",
                f"Worker {w.worker_id} killed (exitcode={code})",
                worker_id=w.worker_id,
            )

    def _crash_loop_breaker(self, lane: str) -> bool:
        """Return True if spawning this lane should be suppressed."""
        now = time.time()
        if now < self._spawn_cooldown.get(lane, 0.0):
            return True
        self._death_history[lane] = [
            t for t in self._death_history[lane] if (now - t) < self.CRASH_LOOP_WINDOW
        ]
        if len(self._death_history[lane]) >= self.CRASH_LOOP_LIMIT:
            log.error(
                "Crash loop detected in %s lane (%d exits in %ds) — backing off for 30s",
                lane,
                len(self._death_history[lane]),
                int(self.CRASH_LOOP_WINDOW),
            )
            self._spawn_cooldown[lane] = now + 30.0
            self._death_history[lane].clear()
            return True
        return False

    def _startup_recovery(self) -> None:
        log.info("Running startup recovery…")
        swept = sweep_partials(self.workspace)
        if swept:
            log.info("Swept %d partial dirs", len(swept))
        n = recover_leases(self._con)
        if n:
            log.info("Recovered %d stale tasks at startup", n)

    def _start_dashboard(self) -> None:
        def _run() -> None:
            import uvicorn

            from dabook.server.app import create_app, dashboard_url

            app = create_app(
                self.db_path,
                self.workspace,
                self._telemetry,
                self._eta,
                port=self.port,
                cors_origins=self.cors_origins,
                watcher=self.watcher,
            )
            server = uvicorn.Server(
                uvicorn.Config(
                    app, host="127.0.0.1", port=self.port, log_level="warning", access_log=False
                )
            )
            if self.open_browser:
                threading.Timer(1.5, _open_browser, args=(dashboard_url(self.port),)).start()
            server.run()

        threading.Thread(target=_run, daemon=True, name="dashboard").start()

    # ------------------------------------------------------------------
    def _shutdown(self) -> None:
        log.info("Supervisor shutting down…")
        set_stopping(self._con, True)

        # Workers re-read the stop flag every poll (<= ~1 s); only a running task needs longer.
        running = self._con.execute("SELECT COUNT(*) FROM tasks WHERE state='running'").fetchone()[0]
        deadline = time.time() + (30 if running else 5)
        while time.time() < deadline:
            if self._hard or not any(
                w.process.is_alive() for lane in self._pool.values() for w in lane
            ):
                break
            time.sleep(0.2)

        for lane_workers in self._pool.values():
            for w in lane_workers:
                if w.process.is_alive():
                    w.process.terminate()
                    w.process.join(timeout=3)
                try:
                    w.process.close()
                except Exception:
                    pass  # still alive after terminate; nothing more we can do

        # Anything a killed worker still held goes back to pending; the next run resumes it.
        with write_txn(self._con):
            self._con.execute(
                "UPDATE workers SET state='dead' WHERE state != 'dead'"
            )
        recover_leases(self._con)

        if self._telemetry:
            self._telemetry.stop()
            self._telemetry.join(timeout=3)
        self._finish()

    def _finish(self) -> None:
        try:
            settle_all(self._con, self.workspace)
        finally:
            self._con.close()
        log.info("Supervisor exited cleanly")

    def _handle_sigterm(self, sig: int, frame: object) -> None:
        log.info("SIGTERM received: draining…")
        set_stopping(self._con, True)
        self._stop_evt.set()

    def _handle_sigint(self, sig: int, frame: object) -> None:
        if self._stop_evt.is_set():
            log.warning("Hard stop: terminating workers immediately")
            self._hard = True
        else:
            log.info("Ctrl+C: finishing current tasks then stopping (Ctrl+C again to force)…")
            set_stopping(self._con, True)
            self._stop_evt.set()


def _open_browser(url: str) -> None:
    import webbrowser

    webbrowser.open(url)
