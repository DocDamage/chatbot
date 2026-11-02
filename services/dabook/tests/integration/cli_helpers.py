"""Helpers for tests that drive the real CLI in a subprocess."""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

import psutil


@dataclass
class CliResult:
    returncode: int
    stdout: str
    stderr: str
    elapsed: float
    seen_pids: set[int] = field(default_factory=set)


def _watch_children(proc: subprocess.Popen, seen: set[int], stop: threading.Event) -> None:
    try:
        parent = psutil.Process(proc.pid)
    except psutil.NoSuchProcess:
        return
    while not stop.is_set():
        try:
            seen.update(c.pid for c in parent.children(recursive=True))
        except psutil.Error:
            pass
        time.sleep(0.05)


def dabook_env(**extra: str) -> dict[str, str]:
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env.update(extra)
    return env


def run_cli(*args: str, timeout: float = 120.0, env: dict[str, str] | None = None) -> CliResult:
    """Run ``python -m dabook ...`` to completion, recording every descendant process seen."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "dabook", *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env=env or dabook_env(),
    )
    seen: set[int] = set()
    stop = threading.Event()
    watcher = threading.Thread(target=_watch_children, args=(proc, seen, stop), daemon=True)
    watcher.start()
    t0 = time.time()
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, err = proc.communicate()
        raise AssertionError(f"dabook {' '.join(args)} did not exit within {timeout}s\n{err[-2000:]}") from None
    finally:
        stop.set()
        watcher.join(timeout=1)
    return CliResult(proc.returncode, out, err, time.time() - t0, seen)


def live_pids(pids: set[int]) -> list[int]:
    alive = []
    for pid in pids:
        try:
            if psutil.Process(pid).is_running() and psutil.Process(pid).status() != psutil.STATUS_ZOMBIE:
                alive.append(pid)
        except psutil.Error:
            pass
    return alive


def wait_for(predicate, timeout: float, interval: float = 0.25, what: str = "condition"):
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(interval)
    raise AssertionError(f"timed out after {timeout}s waiting for {what}")


def book_states(ws: Path) -> dict[str, str]:
    from dabook.core.store.db import connect

    db = ws / "state.db"
    if not db.is_file():
        return {}
    con = connect(db)
    try:
        return {r["path"]: r["state"] for r in con.execute("SELECT path, state FROM books")}
    finally:
        con.close()
