"""
DABOOK CLI — built with Typer + Rich.

Quick start: ``dabook run book.pdf``  ·  Headless: ``dabook ingest book.pdf -w ws --json``

Output discipline: ``ingest --json`` writes exactly one JSON document to stdout; everything
human-readable (progress, errors, logs) goes to stderr.
"""

from __future__ import annotations

import json
import os
import socket
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

try:  # newer Typer vendors its own click; older Typer depends on the real one
    from typer._click import exceptions as click_exc
except ImportError:  # pragma: no cover - depends on the installed Typer
    from click import exceptions as click_exc

import dabook
from dabook.config.models import DabookConfig
from dabook.core.report import (
    EXIT_BAD_ARGS,
    EXIT_FAILED,
    EXIT_LOCK_HELD,
    SCHEMA_ID,
    build_ingest_report,
    exit_code_for,
)

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

console = Console(legacy_windows=False)
err_console = Console(stderr=True, legacy_windows=False)
app = typer.Typer(
    name="dabook",
    help="📚 DABOOK — compile books into ML-ready datasets",
    add_completion=False,
    rich_markup_mode="rich",
)


def main(argv: list[str] | None = None) -> None:
    """Console entry point. ``ingest`` reports argument errors as exit code 5 (not click's 2)."""
    args = list(sys.argv[1:] if argv is None else argv)
    # Drive the underlying click command directly: Typer's own wrapper would turn a UsageError
    # into a crash report, and in non-standalone mode click *returns* typer.Exit codes.
    command = typer.main.get_command(app)
    try:
        code = command.main(args=args, standalone_mode=False, prog_name="dabook")
    except click_exc.UsageError as exc:
        exc.show()
        sys.exit(EXIT_BAD_ARGS if args[:1] == ["ingest"] else exc.exit_code)
    except click_exc.ClickException as exc:
        exc.show()
        sys.exit(exc.exit_code)
    except click_exc.Abort:
        sys.exit(130)
    sys.exit(code if isinstance(code, int) else 0)


# ─────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────
def _load_cfg(overrides: dict[str, Any], workspace: Path | None, *, fail_code: int) -> DabookConfig:
    from pydantic import ValidationError

    from dabook.config.loader import load_config
    from dabook.config.models import PROFILES

    profile = overrides.get("profile")
    if profile not in PROFILES:
        err_console.print(f"[red]✗ unknown profile {profile!r}; choose from {sorted(PROFILES)}[/red]")
        raise typer.Exit(fail_code)
    try:
        cfg = load_config(workspace_or_toml=workspace, overrides=overrides)
        if cfg.assist.enabled and cfg.workers.llm < 1:
            cfg.workers.llm = 1  # assisted generation runs on the llm lane
        return cfg
    except ValidationError as exc:
        for err in exc.errors():
            where = ".".join(str(p) for p in err["loc"])
            err_console.print(f"[red]✗ config {where}: {err['msg']}[/red]")
        raise typer.Exit(fail_code) from None


def _overrides(
    workspace: Path | None,
    profile: str,
    modes: list[str],
    formats: list[str],
    workers_cpu: int | None,
    workers_gpu: int | None,
    book_concurrency: int | None,
    port: int,
) -> dict[str, Any]:
    overrides: dict[str, Any] = {"profile": profile}
    if workspace:
        overrides["workspace"] = str(workspace)
    workers: dict[str, int] = {}
    if workers_cpu is not None:
        workers["cpu"] = workers_cpu
    if workers_gpu is not None:
        workers["gpu"] = workers_gpu
    if book_concurrency is not None:
        workers["book_concurrency"] = book_concurrency
    if workers:
        overrides["workers"] = workers
    overrides["server"] = {"port": port}
    overrides["dataset"] = {"modes": modes, "formats": formats}
    return overrides


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


# ─────────────────────────────────────────────────────────
# run
# ─────────────────────────────────────────────────────────
@app.command()
def run(
    paths: list[Path] = typer.Argument(..., help="PDFs, directories, or globs"),
    workspace: Path | None = typer.Option(None, "--workspace", "-w", help="Workspace directory"),
    profile: str = typer.Option(
        "balanced", "--profile", "-p", help="Profile: fast|balanced|accurate|lowram"
    ),
    modes: str = typer.Option("raw,rag", "--modes", help="Dataset modes (comma-separated)"),
    formats: str = typer.Option("jsonl", "--formats", help="Export formats"),
    workers_cpu: int | None = typer.Option(None, "--workers-cpu"),
    workers_gpu: int | None = typer.Option(None, "--workers-gpu"),
    book_concurrency: int | None = typer.Option(None, "--book-concurrency"),
    port: int = typer.Option(8765, "--port"),
    no_ui: bool = typer.Option(False, "--no-ui", help="Don't start the dashboard"),
    no_open: bool = typer.Option(False, "--no-open", help="Don't open browser"),
    watch: bool = typer.Option(
        False, "--watch", help="Keep running; pick up new PDFs from inbox/ and the given directories"
    ),
    autotune: bool = typer.Option(False, "--autotune"),
    assist: str | None = typer.Option(
        None, "--assist", help="LLM provider for assisted SFT pairs: ollama:<model> | openai:<model>"
    ),
) -> None:
    """Process one or more PDF books. Exits when done unless the dashboard or --watch keeps it up."""
    _run_impl(
        paths=paths,
        workspace=workspace,
        profile=profile,
        modes=_split(modes),
        formats=_split(formats),
        workers_cpu=workers_cpu,
        workers_gpu=workers_gpu,
        book_concurrency=book_concurrency,
        port=port,
        start_ui=not no_ui,
        open_browser=not no_open,
        watch=watch,
        assist=assist,
    )


def _run_impl(
    paths: list[Path],
    workspace: Path | None,
    profile: str,
    modes: list[str],
    formats: list[str],
    workers_cpu: int | None,
    workers_gpu: int | None,
    book_concurrency: int | None,
    port: int,
    start_ui: bool,
    open_browser: bool,
    watch: bool,
    resume: bool = False,
    assist: str | None = None,
) -> None:
    from dabook.core.ingest import enqueue_pdf
    from dabook.core.lock import LockError, WorkspaceLock
    from dabook.core.logging import setup_logging
    from dabook.core.runtime.supervisor import Supervisor
    from dabook.core.scheduler.planner import plan_book
    from dabook.core.store.db import connect
    from dabook.core.watch import InboxWatcher
    from dabook.core.workspace import get_db_path, init_workspace
    from dabook.stages.runner import load_params

    overrides = _overrides(
        workspace, profile, modes, formats, workers_cpu, workers_gpu, book_concurrency, port
    )
    if assist:
        overrides["assist"] = {"provider": assist}
    cfg = _load_cfg(overrides, workspace, fail_code=1)
    ws = init_workspace(cfg)
    db_path = get_db_path(ws)

    try:
        lock = WorkspaceLock(ws, port=port)
        lock.acquire()
    except LockError as e:
        err_console.print(f"[red]✗ {e}[/red]")
        raise typer.Exit(1) from None

    try:
        setup_logging(ws / "logs", "supervisor")
        con = connect(db_path)
        _sync_settings(con, cfg, port)

        pdfs = _collect_pdfs(paths)
        existing_books = con.execute("SELECT COUNT(*) FROM books WHERE state != 'removed'").fetchone()[0]
        if not pdfs and existing_books == 0 and not watch:
            console.print("[yellow]⚠ No PDF files found and no books in workspace.[/yellow]")
            con.close()
            return

        label = f"{len(pdfs)} book(s)" if pdfs else f"{existing_books} existing book(s)"
        console.print(
            Panel.fit(
                f"[bold]DABOOK[/bold] · {label} · profile=[cyan]{profile}[/cyan] · workspace=[dim]{ws}[/dim]",
                border_style="blue",
            )
        )

        params = cfg.to_params_dict()
        book_ids: list[int] = []
        if pdfs:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                transient=True,
                console=err_console,
            ) as prog:
                task = prog.add_task("Registering books…", total=len(pdfs))
                for pdf in pdfs:
                    try:
                        res = enqueue_pdf(
                            ws,
                            con,
                            pdf,
                            params,
                            shard_pages=cfg.limits.shard_pages,
                            profile=profile,
                            license_status=cfg.license.default_status,
                        )
                        book_ids.append(res.book_id)
                        if res.error:
                            err_console.print(f"[red]✗ {pdf.name}: {res.error}[/red]")
                    except Exception as e:
                        err_console.print(f"[red]✗ {pdf.name}: {e}[/red]")
                    prog.advance(task)
        elif resume:
            # Re-plan every known book with the parameters it was originally keyed by.
            for row in con.execute(
                "SELECT id, sha256, pages FROM books WHERE state != 'removed'"
            ).fetchall():
                book_dir = ws / "books" / row["sha256"][:12]
                plan_book(
                    con,
                    row["id"],
                    row["sha256"],
                    row["pages"] or 0,
                    ws,
                    load_params(book_dir),
                    shard_pages=cfg.limits.shard_pages,
                    retry_failed=False,
                )
                book_ids.append(row["id"])
        con.close()

        watcher = None
        if watch:
            watch_dirs = [p.resolve() for p in paths if p.is_dir()]
            watcher = InboxWatcher(
                ws,
                watch_dirs,
                params,
                shard_pages=cfg.limits.shard_pages,
                profile=profile,
                license_status=cfg.license.default_status,
                interval=float(os.environ.get("DABOOK_WATCH_INTERVAL_S", "5")),
            )
            err_console.print(
                f"[green]▸[/green] Watching {', '.join(str(d) for d in [ws / 'inbox', *watch_dirs])}"
            )

        if start_ui:
            from dabook.server.app import dashboard_url

            console.print(f"[green]▸[/green] Dashboard: {dashboard_url(port)}")

        sup = Supervisor(
            workspace=ws,
            db_path=db_path,
            port=port,
            open_browser=open_browser and start_ui,
            start_ui=start_ui,
            watcher=watcher,
            cors_origins=cfg.server.cors_origins,
        )
        sup.start()
    finally:
        lock.release()

    if book_ids and sup.exit_when_idle:
        con = connect(db_path)
        try:
            report = build_ingest_report(con, ws, list(dict.fromkeys(book_ids)))
        finally:
            con.close()
        _print_book_table(report["books"])
        code = exit_code_for(report["books"])
        if code:
            raise typer.Exit(code)


def _print_book_table(books: list[dict[str, Any]]) -> None:
    table = Table(title="DABOOK Results", border_style="blue")
    for col in ("Book", "State", "Pages", "Quality", "Notes"):
        table.add_column(col)
    for b in books:
        table.add_row(
            str(b["title"] or Path(b["source_path"]).stem),
            b["state"],
            str(b["pages"] or ""),
            "" if b["quality_score"] is None else f"{b['quality_score']:.2f}",
            "; ".join(b["warnings"]) or (b["error"] or ""),
        )
    console.print(table)


# ─────────────────────────────────────────────────────────
# ingest (headless contract, Phase 2)
# ─────────────────────────────────────────────────────────
@app.command()
def ingest(
    paths: list[Path] = typer.Argument(None, help="PDF files or directories"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json", help="Write the dabook.ingest.v1 report to stdout"),
    profile: str = typer.Option("balanced", "--profile", "-p"),
    modes: str = typer.Option("rag,raw", "--modes", help="Dataset modes (comma-separated)"),
    timeout_s: float | None = typer.Option(None, "--timeout-s", help="Stop after this many seconds"),
    lock_wait_s: float = typer.Option(
        30.0, "--lock-wait-s", help="Wait this long for a busy workspace before exiting 4"
    ),
    license_status: str | None = typer.Option(
        None, "--license", help="License status recorded for new books"
    ),
    assist: str | None = typer.Option(
        None, "--assist", help="LLM provider for assisted SFT pairs: ollama:<model> | openai:<model>"
    ),
    formats: str = typer.Option("jsonl", "--formats", help="jsonl,parquet,hf (comma-separated)"),
) -> None:
    """
    Ingest PDFs one-shot and exit: register, plan, process, report. No UI, no browser.

    Exit codes: 0 ok · 2 needs_input (scanned PDF) · 3 failed · 4 workspace locked · 5 bad args.
    """
    from dabook.core.ingest import enqueue_pdf
    from dabook.core.lock import LockError, WorkspaceLock
    from dabook.core.logging import setup_logging
    from dabook.core.runtime.supervisor import Supervisor
    from dabook.core.store.db import connect
    from dabook.core.workspace import get_db_path, init_workspace

    def bail(code: str, message: str, exit_code: int) -> typer.Exit:
        err_console.print(f"[red]✗ {message}[/red]")
        if json_out:
            print(
                json.dumps(
                    {"schema": SCHEMA_ID, "dabook_version": dabook.__version__, "books": [],
                     "error": {"code": code, "message": message}},
                    ensure_ascii=False,
                ),
                flush=True,
            )
        return typer.Exit(exit_code)

    if not paths:
        raise bail("bad_args", "No PDF paths given.", EXIT_BAD_ARGS)
    missing = [p for p in paths if not p.exists()]
    if missing:
        raise bail("bad_args", f"Not found: {', '.join(str(p) for p in missing)}", EXIT_BAD_ARGS)
    pdfs = _collect_pdfs(paths)
    if not pdfs:
        raise bail("bad_args", "No .pdf files in the given paths.", EXIT_BAD_ARGS)

    try:
        overrides = _overrides(workspace, profile, _split(modes), _split(formats), None, None, None, 8765)
        if assist:
            overrides["assist"] = {"provider": assist}
        cfg = _load_cfg(overrides, workspace, fail_code=EXIT_BAD_ARGS)
    except typer.Exit as exc:
        raise bail("bad_args", "Invalid configuration (see stderr).", exc.exit_code) from None
    if license_status is not None and license_status not in (
        "unknown", "owned", "permissive", "copyrighted", "public_domain"
    ):
        raise bail("bad_args", f"Unknown license status {license_status!r}.", EXIT_BAD_ARGS)

    # One-shot: no GPU lane, a single IO worker, CPU capped to the machine; one LLM worker only
    # when assisted generation is on.
    cfg.workers.gpu, cfg.workers.io = 0, 1
    cfg.workers.llm = 1 if cfg.assist.enabled else 0
    cfg.workers.cpu = min(cfg.workers.cpu, max(1, os.cpu_count() or 2))

    ws = init_workspace(cfg)
    db_path = get_db_path(ws)
    lock = WorkspaceLock(ws, port=cfg.server.port)
    deadline = time.time() + max(0.0, lock_wait_s)
    while True:
        try:
            lock.acquire()
            break
        except LockError as exc:
            if time.time() >= deadline:
                raise bail("lock_held", str(exc), EXIT_LOCK_HELD) from None
            time.sleep(0.5)

    timed_out = False
    try:
        setup_logging(ws / "logs", "supervisor")
        con = connect(db_path)
        _sync_settings(con, cfg, cfg.server.port)
        params = cfg.to_params_dict()
        book_ids: list[int] = []
        for pdf in pdfs:
            try:
                res = enqueue_pdf(
                    ws,
                    con,
                    pdf,
                    params,
                    shard_pages=cfg.limits.shard_pages,
                    profile=profile,
                    license_status=license_status or cfg.license.default_status,
                )
                book_ids.append(res.book_id)
            except Exception as exc:
                raise bail("enqueue_failed", f"{pdf.name}: {exc}", EXIT_FAILED) from None
        con.close()

        sup = Supervisor(
            workspace=ws,
            db_path=db_path,
            port=cfg.server.port,
            open_browser=False,
            start_ui=False,
            exit_when_idle=True,
            timeout_s=timeout_s,
        )
        sup.start()
        timed_out = sup.timed_out

        con = connect(db_path)
        try:
            report = build_ingest_report(con, ws, list(dict.fromkeys(book_ids)))
        finally:
            con.close()
    finally:
        lock.release()

    if timed_out:
        for b in report["books"]:
            if b["state"] in ("queued", "active"):
                b["warnings"].append("timeout")
    if json_out:
        print(json.dumps(report, ensure_ascii=False), flush=True)
    else:
        _print_book_table(report["books"])
    code = exit_code_for(report["books"])
    if code:
        raise typer.Exit(code)


# ─────────────────────────────────────────────────────────
# resume
# ─────────────────────────────────────────────────────────
@app.command()
def resume(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    port: int = typer.Option(8765, "--port"),
    no_ui: bool = typer.Option(False, "--no-ui"),
    no_open: bool = typer.Option(False, "--no-open"),
) -> None:
    """Resume all unfinished work in the workspace."""
    _run_impl(
        paths=[],
        workspace=workspace,
        profile="balanced",
        modes=["raw", "rag"],
        formats=["jsonl"],
        workers_cpu=None,
        workers_gpu=None,
        book_concurrency=None,
        port=port,
        start_ui=not no_ui,
        open_browser=not no_open,
        watch=False,
        resume=True,
    )


# ─────────────────────────────────────────────────────────
# ui
# ─────────────────────────────────────────────────────────
@app.command()
def ui(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    port: int = typer.Option(8765, "--port"),
) -> None:
    """Open the dashboard for an existing workspace (browse only: no supervisor runs here)."""
    from dabook.core.workspace import get_db_path
    from dabook.server.app import create_app, dashboard_url

    db_path = get_db_path(workspace)
    if not db_path.exists():
        console.print(f"[red]✗ No workspace at {workspace}[/red]")
        raise typer.Exit(1)

    import uvicorn

    console.print(f"[green]▸[/green] Dashboard: {dashboard_url(port)}")
    uvicorn.run(create_app(db_path, workspace, port=port), host="127.0.0.1", port=port, log_level="warning")


# ─────────────────────────────────────────────────────────
# settings
# ─────────────────────────────────────────────────────────
@app.command()
def settings(
    workspace: Path = typer.Option(
        Path("./dabook_workspace"), "--workspace", "-w", help="Workspace directory"
    ),
    port: int = typer.Option(8766, "--port", help="Port for the settings UI (default 8766)"),
    no_open: bool = typer.Option(False, "--no-open", help="Don't auto-open browser"),
) -> None:
    """Open the full Control Room UI — change settings, set directories, and launch runs."""
    import webbrowser

    import uvicorn

    from dabook.core.workspace import get_db_path, init_workspace
    from dabook.server.app import create_app, dashboard_url

    ws = init_workspace(DabookConfig(workspace=workspace.resolve()))
    url = dashboard_url(port, fragment="settings")
    console.print(
        Panel(
            f"[bold cyan]DABOOK Settings & Control Room[/bold cyan]\n\n"
            f"  URL:        [link={url}]{url}[/link]\n"
            f"  Workspace:  {ws}\n\n"
            "[dim]Change workers, limits and directories from the UI. Books launched here are "
            "queued; run `dabook resume` to process them.\nPress Ctrl+C to stop.[/dim]",
            border_style="cyan",
            title="⚙ Settings",
        )
    )
    if not no_open:
        webbrowser.open(url)
    uvicorn.run(create_app(get_db_path(ws), ws, port=port), host="127.0.0.1", port=port, log_level="warning")


# ─────────────────────────────────────────────────────────
# status
# ─────────────────────────────────────────────────────────
@app.command()
def status(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Print processing status snapshot."""
    from dabook.core.store.db import connect
    from dabook.core.workspace import get_db_path

    db_path = get_db_path(workspace)
    if not db_path.exists():
        console.print("[yellow]No workspace found.[/yellow]")
        raise typer.Exit(1)

    con = connect(db_path, readonly=False)
    try:
        if json_out:
            print(json.dumps(_build_status_dict(con), indent=2, default=str))
            return

        table = Table(title="DABOOK Status", border_style="blue")
        table.add_column("Entity")
        table.add_column("State")
        table.add_column("Count", justify="right")
        for r in con.execute("SELECT state, COUNT(*) n FROM books GROUP BY state").fetchall():
            table.add_row("Books", r["state"], str(r["n"]))
        for r in con.execute("SELECT state, COUNT(*) n FROM tasks GROUP BY state").fetchall():
            table.add_row("Tasks", r["state"], str(r["n"]))
        console.print(table)
    finally:
        con.close()


# ─────────────────────────────────────────────────────────
# pause / continue / stop
# ─────────────────────────────────────────────────────────
@app.command(name="pause")
def pause_cmd(workspace: Path = typer.Option(Path("./dabook_workspace"), "-w")) -> None:
    """Pause the processing queue."""
    _set_setting(workspace, "queue.paused", "1")
    console.print("[yellow]⏸ Queue paused.[/yellow]")


@app.command(name="continue")
def continue_cmd(workspace: Path = typer.Option(Path("./dabook_workspace"), "-w")) -> None:
    """Resume the processing queue."""
    _set_setting(workspace, "queue.paused", "0")
    console.print("[green]▶ Queue resumed.[/green]")


@app.command()
def stop(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "-w"),
    now: bool = typer.Option(False, "--now", help="Hard stop (don't finish current task)"),
) -> None:
    """Signal supervisor to stop."""
    _set_setting(workspace, "stopping", "1")
    console.print("[yellow]🛑 Stop signal sent.[/yellow]")


# ─────────────────────────────────────────────────────────
# retry
# ─────────────────────────────────────────────────────────
@app.command()
def retry(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "-w"),
    dead: bool = typer.Option(False, "--dead"),
    failed: bool = typer.Option(False, "--failed"),
    book: str | None = typer.Option(None, "--book"),
) -> None:
    """Retry failed or dead tasks (and put their books back in the queue)."""
    from dabook.core.store.db import connect, write_txn
    from dabook.core.workspace import get_db_path

    con = connect(get_db_path(workspace))
    states = []
    if dead or (not dead and not failed):
        states.append("dead")
    if failed or (not dead and not failed):
        states.append("failed")

    where = f"state IN ({','.join('?' * len(states))})"
    args: list[Any] = list(states)
    if book:
        where += " AND book_id=(SELECT id FROM books WHERE sha256 LIKE ? LIMIT 1)"
        args.append(f"{book}%")

    with write_txn(con):
        book_ids = [r["book_id"] for r in con.execute(f"SELECT DISTINCT book_id FROM tasks WHERE {where}", args)]
        n = con.execute(
            f"UPDATE tasks SET state='pending', attempts=0, not_before=0 WHERE {where}", args
        ).rowcount
        # A book whose task died is 'failed' and unclaimable until it is queued again.
        for book_id in book_ids:
            con.execute(
                "UPDATE books SET state='queued', error=NULL, finished_at=NULL "
                "WHERE id=? AND state='failed'",
                (book_id,),
            )
    con.close()
    console.print(f"[green]↺ Retrying {n} task(s).[/green]")


# ─────────────────────────────────────────────────────────
# doctor
# ─────────────────────────────────────────────────────────
@app.command()
def doctor(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "-w"),
    json_out: bool = typer.Option(False, "--json", help="Machine-readable report on stdout"),
) -> None:
    """Check environment, dependencies, and workspace health."""
    checks = _run_doctor_checks(workspace, workspace / "state.db")
    all_ok = all(c.get("ok", False) for c in checks if c.get("required", True))

    if json_out:
        print(
            json.dumps(
                {
                    "ok": all_ok,
                    "dabook_version": dabook.__version__,
                    "python": sys.version.split()[0],
                    "executable": sys.executable,
                    "checks": checks,
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
        if not all_ok:
            raise typer.Exit(1)
        return

    table = Table(title="DABOOK Doctor", border_style="blue")
    table.add_column("Check")
    table.add_column("Status")
    table.add_column("Details")
    for c in checks:
        ok = c.get("ok", False)
        mark = "[green]✓[/green]" if ok else ("[red]✗[/red]" if c.get("required", True) else "[yellow]![/yellow]")
        table.add_row(c["name"], mark, c.get("detail", ""))
    console.print(table)
    if all_ok:
        console.print("[green bold]All checks passed.[/green bold]")
    else:
        console.print("[red]Some checks failed — see details above.[/red]")
        raise typer.Exit(1)


def _run_doctor_checks(workspace: Path, db_path: Path) -> list[dict]:
    checks: list[dict] = []

    pv = sys.version_info
    checks.append(
        {
            "name": "Python version",
            "ok": pv >= (3, 11),
            "detail": f"{pv.major}.{pv.minor}.{pv.micro} (need ≥ 3.11)",
        }
    )

    sv = sqlite3.sqlite_version_info
    checks.append(
        {
            "name": "SQLite version",
            "ok": sv >= (3, 35, 0),
            "detail": f"{sqlite3.sqlite_version} (need ≥ 3.35 for RETURNING)",
        }
    )

    # Workspace writable (or parent writable if workspace does not exist yet)
    if workspace.exists():
        ws_ok = workspace.is_dir() and os.access(workspace, os.W_OK)
        detail = str(workspace)
    else:
        parent = workspace.parent if workspace.parent != Path("") else Path(".")
        ws_ok = parent.exists() and os.access(parent, os.W_OK)
        detail = f"{workspace} (ready to create)"
    checks.append({"name": "Workspace writable", "ok": ws_ok, "detail": detail})

    checks.append(
        {"name": "DB on local filesystem", "ok": True, "detail": "WAL requires local disk"}
    )

    import shutil

    if workspace.is_dir():
        free_gb = shutil.disk_usage(workspace).free / 1024**3
        checks.append(
            {
                "name": "Disk free",
                "ok": free_gb >= 5.0,
                "required": False,
                "detail": f"{free_gb:.1f} GB free (≥ 5 GB recommended)",
            }
        )

    for label, module, hint, why in (
        ("psutil", "psutil", "pip install psutil", "system monitoring available"),
        ("FastAPI", "fastapi", "pip install fastapi", "dashboard available"),
        ("pypdfium2", "pypdfium2", "pip install pypdfium2", "PDF parsing available"),
        ("ftfy", "ftfy", "pip install ftfy", "text repair available"),
    ):
        try:
            __import__(module)
            checks.append({"name": label, "ok": True, "detail": why})
        except ImportError:
            checks.append({"name": label, "ok": False, "detail": hint})

    try:
        import tiktoken  # noqa: F401

        checks.append(
            {"name": "tiktoken", "ok": True, "required": False, "detail": "exact token counts"}
        )
    except ImportError:
        checks.append(
            {
                "name": "tiktoken",
                "ok": True,
                "required": False,
                "detail": "not installed (token counts are estimates)",
            }
        )

    try:
        import pynvml

        pynvml.nvmlInit()
        count = pynvml.nvmlDeviceGetCount()
        checks.append(
            {"name": "GPU (NVIDIA)", "ok": True, "required": False, "detail": f"{count} GPU(s) detected"}
        )
    except Exception:
        checks.append(
            {
                "name": "GPU (NVIDIA)",
                "ok": True,
                "required": False,
                "detail": "No NVIDIA GPU (CPU-only mode ok)",
            }
        )

    # The dashboard port only matters when the dashboard is used.
    port = 8765
    try:
        s = socket.socket()
        s.bind(("127.0.0.1", port))
        s.close()
        checks.append({"name": f"Port {port}", "ok": True, "required": False, "detail": "available"})
    except OSError:
        checks.append(
            {
                "name": f"Port {port}",
                "ok": False,
                "required": False,
                "detail": f"Port {port} already in use (only matters for the dashboard)",
            }
        )
    return checks


# ─────────────────────────────────────────────────────────
# cache
# ─────────────────────────────────────────────────────────
@app.command()
def cache(
    action: str = typer.Argument(..., help="gc|stats|verify"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "-w"),
    older_than: int | None = typer.Option(None, "--older-than", help="Days"),
) -> None:
    """Manage the stage cache."""
    if action == "stats":
        total = sum(1 for _ in (workspace / "books").rglob("_SUCCESS"))
        console.print(f"Committed stage artifacts: {total}")
    elif action == "gc":
        console.print("[dim]Cache GC not yet implemented.[/dim]")
    elif action == "verify":
        from dabook.core.atomic import is_valid_commit

        bad = 0
        for d in (workspace / "books").rglob("*/"):
            if (d / "_SUCCESS").exists() and not is_valid_commit(d, deep=True):
                console.print(f"[red]Invalid: {d}[/red]")
                bad += 1
        console.print(f"Verified. Invalid artifacts: {bad}")


# ─────────────────────────────────────────────────────────
# Governance: books / license / review / recompile / export
# ─────────────────────────────────────────────────────────
EXIT_BLOCKED = 6  # export refused by governance (license, review, nothing eligible)

review_app = typer.Typer(help="Human review of assisted SFT pairs", add_completion=False)
app.add_typer(review_app, name="review")


def _open_workspace(workspace: Path):  # type: ignore[no-untyped-def]
    from dabook.core.store.db import connect
    from dabook.core.workspace import get_db_path

    db_path = get_db_path(workspace)
    if not db_path.is_file():
        err_console.print(f"[red]✗ No workspace at {workspace}[/red]")
        raise typer.Exit(EXIT_BAD_ARGS)
    from dabook.core.store.migrations import migrate

    migrate(db_path)  # older workspaces gain new columns (e.g. review_status) on first use
    return connect(db_path)


def _emit(doc: dict[str, Any]) -> None:
    print(json.dumps(doc, ensure_ascii=False, default=str), flush=True)


def _governance_call(json_out: bool, fn):  # type: ignore[no-untyped-def]
    from dabook.core.governance import GovernanceError

    try:
        return fn()
    except GovernanceError as exc:
        err_console.print(f"[red]✗ {exc}[/red]")
        if json_out:
            _emit({"error": {"code": "bad_args", "message": str(exc)}})
        raise typer.Exit(EXIT_BAD_ARGS) from None


@app.command()
def books(
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """List books with license, review status and dataset paths (the governance view)."""
    from dabook.core.report import build_book_report

    from dabook.core.governance import REVIEW_STATUSES, TRAINING_ELIGIBLE_LICENSES
    from dabook.core.store.settings import load_settings

    con = _open_workspace(workspace)
    try:
        ws = workspace.resolve()
        ids = [r["id"] for r in con.execute("SELECT id FROM books WHERE state != 'removed' ORDER BY id")]
        reports = [build_book_report(con, ws, i) for i in ids]
        verified = load_settings(con).quality_verified
    finally:
        con.close()
    if json_out:
        _emit({
            "schema": "dabook.books.v1",
            "dabook_version": dabook.__version__,
            "workspace": str(ws),
            # The export gate's rules, so clients mirror the authoritative values instead of copying them.
            "policy": {
                "training_licenses": list(TRAINING_ELIGIBLE_LICENSES),
                "quality_verified": verified,
                "review_statuses": list(REVIEW_STATUSES),
            },
            "books": reports,
        })
        return
    _print_book_table(reports)


@app.command()
def license(  # noqa: A001 - CLI verb
    book: str = typer.Argument(..., help="Book id, sha256 prefix, or source path"),
    status: str = typer.Argument(..., help="unknown | owned | permissive | copyrighted | public_domain"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Record a book's license. Only owned/permissive/public_domain books may be exported for training."""
    from dabook.core.governance import set_license

    con = _open_workspace(workspace)
    try:
        row = _governance_call(json_out, lambda: set_license(con, book, status))
    finally:
        con.close()
    if json_out:
        _emit({"book_id": row["id"], "sha256": row["sha256"], "license_status": row["license_status"]})
    else:
        console.print(f"[green]✓ {row['title'] or row['sha256'][:12]}: license = {row['license_status']}[/green]")


def _assist_pairs(con: Any, ws: Path, row: Any) -> list[dict[str, Any]]:
    from dabook.core.atomic import is_valid_commit
    from dabook.core.formats import read_jsonl

    task = con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage='s13_assist_sft' AND state IN ('done','skipped')",
        (row["id"],),
    ).fetchone()
    if task is None:
        return []
    directory = ws / "books" / row["sha256"][:12] / "stages" / "s13_assist_sft" / task["stage_key"]
    return read_jsonl(directory / "assist_sft.jsonl") if is_valid_commit(directory) else []


@review_app.command("sample")
def review_sample(
    book: str = typer.Argument(...),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    count: int = typer.Option(10, "-n", "--count", min=1, max=200),
    seed: int = typer.Option(42, "--seed"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Sample assisted pairs with their source excerpts and any earlier decisions."""
    import hashlib

    from dabook.core.governance import find_book, read_edits

    con = _open_workspace(workspace)
    ws = workspace.resolve()
    try:
        row = _governance_call(json_out, lambda: find_book(con, book))
        pairs = _assist_pairs(con, ws, row)
        decisions = read_edits(ws, row["sha256"])
        # Deterministic spread: order by a seeded hash, so the same seed re-shows the same sample.
        pairs.sort(key=lambda p: hashlib.sha256(f"{seed}|{p['pair_id']}".encode()).hexdigest())
        sample = [
            {
                "pair_id": p["pair_id"],
                "category": p["category"],
                "question": p["instruction"],
                "answer": p["output"],
                "evidence": p.get("evidence"),
                "pages": p["pages"],
                "breadcrumbs": p.get("breadcrumbs", []),
                "source_excerpt": p.get("source_excerpt", ""),
                "generator": p["generator"],
                "grounding": p.get("grounding"),
                "decision": (decisions.get(p["pair_id"]) or {}).get("action"),
            }
            for p in pairs[:count]
        ]
        doc = {
            "book": {"book_id": row["id"], "sha256": row["sha256"], "title": row["title"],
                     "review_status": row["review_status"], "license_status": row["license_status"]},
            "total_pairs": len(pairs),
            "decided": sum(1 for p in pairs if p["pair_id"] in decisions),
            "sample": sample,
        }
    finally:
        con.close()
    if json_out:
        _emit(doc)
        return
    for item in sample:
        console.print(Panel(f"[bold]Q:[/bold] {item['question']}\n[bold]A:[/bold] {item['answer']}\n\n"
                            f"[dim]evidence: {item['evidence']}[/dim]", title=f"{item['pair_id']} · p.{item['pages'][0]}"))


@review_app.command("decide")
def review_decide(
    book: str = typer.Argument(...),
    pair_id: str = typer.Argument(...),
    decision: str = typer.Argument(..., help="accept | reject"),
    reason: str | None = typer.Option(None, "--reason"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Accept or reject one assisted pair. Rejections take effect at the next compile (`dabook recompile`)."""
    from dabook.core.governance import GovernanceError, find_book, record_edit

    con = _open_workspace(workspace)
    ws = workspace.resolve()
    try:
        row = _governance_call(json_out, lambda: find_book(con, book))
        known = {p["pair_id"] for p in _assist_pairs(con, ws, row)}
        if pair_id not in known:
            _governance_call(json_out, lambda: (_ for _ in ()).throw(GovernanceError(f"Unknown pair {pair_id!r} for this book")))
        edit = _governance_call(json_out, lambda: record_edit(ws, row["sha256"], pair_id, decision, reason))
    finally:
        con.close()
    if json_out:
        _emit({"sha256": row["sha256"], **edit})
    else:
        console.print(f"[green]✓ {decision} {pair_id}[/green]")


@review_app.command("book")
def review_book(
    book: str = typer.Argument(...),
    status: str = typer.Argument(..., help="approved | rejected | unreviewed"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Mark a whole book approved (exportable) or rejected after reviewing a sample."""
    from dabook.core.governance import set_review_status

    con = _open_workspace(workspace)
    try:
        row = _governance_call(json_out, lambda: set_review_status(con, book, status))
    finally:
        con.close()
    if json_out:
        _emit({"book_id": row["id"], "sha256": row["sha256"], "review_status": row["review_status"]})
    else:
        console.print(f"[green]✓ {row['title'] or row['sha256'][:12]}: review = {row['review_status']}[/green]")


@app.command()
def recompile(
    book: str = typer.Argument(..., help="Book id, sha256 prefix, or source path"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    json_out: bool = typer.Option(False, "--json"),
    timeout_s: float | None = typer.Option(None, "--timeout-s"),
) -> None:
    """Re-run only the stages whose inputs changed (e.g. after review decisions) for one book."""
    from dabook.core.governance import find_book
    from dabook.core.lock import LockError, WorkspaceLock
    from dabook.core.logging import setup_logging
    from dabook.core.runtime.supervisor import Supervisor
    from dabook.core.scheduler.planner import plan_book
    from dabook.core.store.db import connect
    from dabook.core.workspace import get_db_path
    from dabook.stages.runner import load_params

    ws = workspace.resolve()
    con = _open_workspace(workspace)
    try:
        row = _governance_call(json_out, lambda: find_book(con, book))
    finally:
        con.close()
    lock = WorkspaceLock(ws)
    try:
        lock.acquire()
    except LockError as exc:
        err_console.print(f"[red]✗ {exc}[/red]")
        if json_out:
            _emit({"error": {"code": "lock_held", "message": str(exc)}})
        raise typer.Exit(EXIT_LOCK_HELD) from None
    try:
        setup_logging(ws / "logs", "supervisor")
        con = connect(get_db_path(ws))
        _sync_settings(con, _load_cfg({"profile": "balanced"}, ws, fail_code=EXIT_BAD_ARGS), 8765)
        params = load_params(ws / "books" / row["sha256"][:12])
        counts = plan_book(con, row["id"], row["sha256"], row["pages"] or 0, ws, params, retry_failed=False)
        con.close()
        sup = Supervisor(workspace=ws, db_path=get_db_path(ws), start_ui=False, open_browser=False, exit_when_idle=True, timeout_s=timeout_s)
        sup.start()
    finally:
        lock.release()
    con = connect(get_db_path(ws))
    try:
        from dabook.core.report import build_book_report

        report = build_book_report(con, ws, row["id"])
    finally:
        con.close()
    if json_out:
        _emit({"replanned": counts, "book": report})
    else:
        console.print(f"[green]✓ {report['title']}: {report['state']} (replanned {counts})[/green]")
    if report["state"] in ("failed", "queued", "active"):
        raise typer.Exit(EXIT_FAILED)


@app.command()
def export(
    out: Path = typer.Option(..., "--out", "-o", help="Bundle directory to create"),
    workspace: Path = typer.Option(Path("./dabook_workspace"), "--workspace", "-w"),
    books_: list[str] | None = typer.Option(None, "--book", "-b", help="Book(s) to export (default: all eligible)"),
    modes: str = typer.Option("sft", "--modes", help="sft,pretrain,code"),
    formats: str = typer.Option("jsonl", "--format", help="jsonl,parquet,hf (comma-separated)"),
    splits: bool = typer.Option(True, "--splits/--no-splits"),
    allow_heuristic: bool = typer.Option(False, "--allow-heuristic", help="Include template SFT pairs (not recommended)"),
    dedup: bool = typer.Option(True, "--dedup/--no-dedup"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """
    Export governed training data. Refuses books that are not training-eligible (license) or not
    reviewed/verified. Exit codes: 0 ok · 5 bad args · 6 blocked by governance.
    """
    from dabook.core.datasets import DedupSettings
    from dabook.core.exporter import ExportBlocked, export_training_bundle

    con = _open_workspace(workspace)
    ws = workspace.resolve()
    try:
        try:
            manifest = export_training_bundle(
                con, ws, out.resolve(),
                book_refs=books_ or None,
                modes=_split(modes), formats=_split(formats),
                with_splits=splits, allow_heuristic=allow_heuristic,
                dedup=DedupSettings(exact=dedup, near=dedup),
            )
        except ExportBlocked as exc:
            err_console.print(f"[red]✗ {exc}[/red]")
            if json_out:
                _emit({"error": {"code": "export_blocked", "message": str(exc), "details": exc.details}})
            raise typer.Exit(EXIT_BLOCKED) from None
        except Exception as exc:
            from dabook.core.governance import GovernanceError

            if isinstance(exc, GovernanceError):
                err_console.print(f"[red]✗ {exc}[/red]")
                if json_out:
                    _emit({"error": {"code": "bad_args", "message": str(exc)}})
                raise typer.Exit(EXIT_BAD_ARGS) from None
            raise
    finally:
        con.close()
    if json_out:
        _emit(manifest)
    else:
        console.print(f"[green]✓ Exported {sum(sum(c.values()) for c in manifest['counts'].values())} records to {out}[/green]")


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────
def _collect_pdfs(paths: list[Path]) -> list[Path]:
    result: list[Path] = []
    for p in paths:
        if not p.exists():
            err_console.print(f"[yellow]⚠ Not found: {p}[/yellow]")
            continue
        if p.is_file() and p.suffix.lower() == ".pdf":
            result.append(p)
        elif p.is_dir():
            result.extend(p.rglob("*.pdf"))
    return sorted(set(result))


def _set_setting(workspace: Path, key: str, value: str) -> None:
    from dabook.core.store.db import connect
    from dabook.core.store.settings import update_setting
    from dabook.core.workspace import get_db_path

    db_path = get_db_path(workspace)
    if not db_path.exists():
        console.print("[yellow]No workspace found.[/yellow]")
        return
    con = connect(db_path)
    update_setting(con, key, value)
    con.close()


def _sync_settings(con: sqlite3.Connection, cfg: DabookConfig, port: int) -> None:
    from dabook.core.store.settings import update_setting

    s = cfg
    updates = {
        "workers.cpu": s.workers.cpu,
        "workers.gpu": s.workers.gpu,
        "workers.io": s.workers.io,
        "workers.llm": s.workers.llm,
        "book_concurrency": s.workers.book_concurrency,
        "ram_ceiling_pct": s.limits.ram_ceiling_pct,
        "vram_ceiling_pct": s.limits.vram_ceiling_pct,
        "min_free_gb": s.limits.min_free_gb,
        "shard_pages": s.limits.shard_pages,
        "retry.max_attempts": s.limits.max_attempts,
        "retry.backoff_s": s.limits.backoff_s,
        "lease_s": s.limits.lease_s,
        "heartbeat_s": s.limits.heartbeat_s,
        "quality.verified": s.quality.verified,
        "quality.good": s.quality.good,
        "quality.review": s.quality.review,
        # Always clear stopping flag so a previous Ctrl+C doesn't block a fresh run
        "stopping": "0",
        "queue.paused": "0",
        "ui.port": port,
    }
    for k, v in updates.items():
        update_setting(con, k, v)


def _build_status_dict(con: sqlite3.Connection) -> dict:
    books = con.execute("SELECT state, COUNT(*) n FROM books GROUP BY state").fetchall()
    tasks = con.execute("SELECT state, COUNT(*) n FROM tasks GROUP BY state").fetchall()
    return {
        "books": {r["state"]: r["n"] for r in books},
        "tasks": {r["state"]: r["n"] for r in tasks},
    }


if __name__ == "__main__":
    main()
