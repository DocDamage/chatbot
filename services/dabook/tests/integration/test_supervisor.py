"""D1 / 1.1: the supervisor must exit by itself in batch mode and support --watch."""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

from tests.integration.cli_helpers import book_states, dabook_env, live_pids, run_cli, wait_for

pytestmark = pytest.mark.slow


def test_run_no_ui_exits_on_its_own_and_leaves_no_children(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    result = run_cli("run", str(pdf_dir / "technical.pdf"), "--no-ui", "--no-open", "-w", str(ws), timeout=120)

    assert result.returncode == 0, result.stderr[-2000:]
    assert list(book_states(ws).values()) == ["done"]
    assert "Spawned worker" in result.stderr
    assert len(result.seen_pids) >= 3  # workers (plus the venv launcher stub on Windows)
    time.sleep(0.5)
    assert live_pids(result.seen_pids) == []  # no orphaned python workers


def test_run_exit_code_reports_a_scanned_book(pdf_dir: Path, tmp_path: Path) -> None:
    result = run_cli("run", str(pdf_dir / "scanned.pdf"), "--no-ui", "--no-open", "-w", str(tmp_path / "ws"), timeout=120)
    assert result.returncode == 2  # needs_input
    assert live_pids(result.seen_pids) == []


def test_run_over_three_fixtures_reaches_correct_states(pdf_dir: Path, tmp_path: Path) -> None:
    """Exit criterion: technical + two-column + scanned in one batch."""
    ws = tmp_path / "ws"
    result = run_cli(
        "run",
        str(pdf_dir / "technical.pdf"),
        str(pdf_dir / "twocol.pdf"),
        str(pdf_dir / "scanned.pdf"),
        "--no-ui",
        "--no-open",
        "-w",
        str(ws),
        timeout=180,
    )
    states = {Path(p).name: s for p, s in book_states(ws).items()}
    assert states == {"technical.pdf": "done", "twocol.pdf": "done", "scanned.pdf": "needs_input"}
    assert result.returncode == 2
    assert live_pids(result.seen_pids) == []


def test_a_workspace_with_nothing_to_do_exits_immediately(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    args = ("run", str(pdf_dir / "technical.pdf"), "--no-ui", "--no-open", "-w", str(ws))
    assert run_cli(*args, timeout=120).returncode == 0
    second = run_cli(*args, timeout=60)
    assert second.returncode == 0
    assert "No work to do" in second.stderr
    assert "Spawned worker" not in second.stderr  # fully cached: no worker was ever started


def test_watch_mode_picks_up_dropped_pdfs_and_stops_on_request(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    watched = tmp_path / "library"
    watched.mkdir()
    env = dabook_env(DABOOK_WATCH_INTERVAL_S="0.5")
    log_path = tmp_path / "watch.log"
    log = log_path.open("w", encoding="utf-8")  # a file, not a PIPE: nothing drains a pipe here
    proc = subprocess.Popen(
        [sys.executable, "-m", "dabook", "run", str(watched), "--no-ui", "--no-open", "--watch", "-w", str(ws)],
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        env=env,
    )
    try:
        wait_for(lambda: (ws / "state.db").is_file() and (ws / "inbox").is_dir(), 30, what="workspace creation")
        time.sleep(1.0)
        assert proc.poll() is None  # watch mode keeps running with no work

        shutil.copy(pdf_dir / "technical.pdf", ws / "inbox" / "dropped.pdf")  # via the inbox ...
        shutil.copy(pdf_dir / "twocol.pdf", watched / "from_library.pdf")  # ... and a watched dir
        wait_for(
            lambda: sorted(book_states(ws).values()) == ["done", "done"],
            120,
            what="both dropped PDFs to finish",
        )
        assert proc.poll() is None

        stop = run_cli("stop", "-w", str(ws), timeout=30)
        assert stop.returncode == 0
        assert proc.wait(timeout=60) == 0
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        log.close()


def test_timeout_stops_a_batch_with_work_remaining(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    result = run_cli(
        "ingest", str(pdf_dir / "technical.pdf"), "-w", str(ws), "--json", "--timeout-s", "0.5", timeout=60
    )
    # 0.5 s is far too short for a cold start: the run must stop, report incomplete work, exit 3
    assert result.returncode == 3
    assert live_pids(result.seen_pids) == []
    import json

    book = json.loads(result.stdout)["books"][0]
    assert book["state"] in ("queued", "active")
    assert "timeout" in book["warnings"]

    # ... and the same command resumes where it left off and finishes
    again = run_cli("ingest", str(pdf_dir / "technical.pdf"), "-w", str(ws), "--json", timeout=120)
    assert again.returncode == 0
    assert json.loads(again.stdout)["books"][0]["state"] == "done"


def test_workers_exit_when_the_supervisor_is_killed_hard(pdf_dir: Path, tmp_path: Path) -> None:
    """kill -9 on the supervisor must not leave workers polling the database forever."""
    import psutil

    ws = tmp_path / "ws"
    log = (tmp_path / "svc.log").open("w", encoding="utf-8")
    proc = subprocess.Popen(
        [sys.executable, "-m", "dabook", "run", str(tmp_path), "--no-ui", "--no-open", "--watch", "-w", str(ws)],
        stdout=log,
        stderr=subprocess.STDOUT,
        env=dabook_env(),
    )

    def supervisor_and_workers() -> tuple[psutil.Process, list[psutil.Process]]:
        node = psutil.Process(proc.pid)
        # On Windows the venv launcher stub re-execs the real interpreter: descend to the process
        # that actually owns the workers.
        while True:
            kids = node.children()
            deeper = [k for k in kids if k.children()]
            if len(kids) == 1 and deeper:
                node = deeper[0]
            else:
                return node, kids

    try:
        sup, workers = wait_for(
            lambda: (lambda sw: sw if len(sw[1]) >= 3 else None)(supervisor_and_workers()),
            60,
            what="workers to start",
        )
        worker_pids = [w.pid for w in workers]
        sup.kill()  # kill -9 the supervisor, leaving the workers parentless
        wait_for(lambda: not live_pids(set(worker_pids)), 30, what="orphaned workers to exit")
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        log.close()
