"""Phase 2: the `dabook ingest --json` contract (dabook.ingest.v1)."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from dabook.config.models import DabookConfig
from dabook.core.lock import WorkspaceLock
from dabook.core.workspace import init_workspace
from tests.integration.cli_helpers import live_pids, run_cli

pytestmark = pytest.mark.slow

SCHEMA_PATH = Path(__file__).parents[2] / "schemas" / "dabook.ingest.v1.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def ingest(ws: Path, *pdfs: Path, extra: tuple[str, ...] = (), timeout: float = 120):
    return run_cli("ingest", *map(str, pdfs), "-w", str(ws), "--json", *extra, timeout=timeout)


def document(result) -> dict:
    """stdout must be exactly one JSON document and nothing else."""
    doc = json.loads(result.stdout)
    jsonschema.validate(doc, SCHEMA)
    return doc


def test_success_report_validates_against_the_schema(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    result = ingest(ws, pdf_dir / "technical.pdf")
    assert result.returncode == 0, result.stderr[-2000:]
    doc = document(result)

    assert doc["schema"] == "dabook.ingest.v1"
    assert Path(doc["workspace"]) == ws.resolve()
    (book,) = doc["books"]
    assert book["state"] == "done" and book["doc_type"] == "native"
    assert book["title"] == "Disk Recovery Handbook" and book["pages"] == 8
    assert 0.9 <= book["quality_score"] <= 1.0
    assert book["warnings"] == [] and book["error"] is None
    assert book["license_status"] == "unknown"
    assert set(book["datasets"]) == {"rag", "raw"} == set(book["counts"])

    # paths are relative to the workspace, forward-slashed, and exist
    for rel in book["datasets"].values():
        assert not Path(rel).is_absolute() and "\\" not in rel
        assert (ws / rel).is_file()
    assert book["counts"]["rag"] == sum(1 for _ in (ws / book["datasets"]["rag"]).open(encoding="utf-8"))
    assert live_pids(result.seen_pids) == []


def test_stdout_is_only_the_json_document(pdf_dir: Path, tmp_path: Path) -> None:
    result = ingest(tmp_path / "ws", pdf_dir / "technical.pdf")
    assert result.stdout.strip().startswith("{") and result.stdout.strip().endswith("}")
    assert result.stdout.count("\n") == 1  # one line, one document
    assert "Supervisor" in result.stderr  # human/log output went to stderr


def test_rag_records_have_the_citation_fields_the_chatbot_needs(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    doc = document(ingest(ws, pdf_dir / "technical.pdf"))
    book = doc["books"][0]
    rows = [json.loads(line) for line in (ws / book["datasets"]["rag"]).read_text(encoding="utf-8").splitlines()]
    required = {
        "chunk_id", "book_sha256", "book_title", "page_start", "page_end", "breadcrumbs",
        "node_ids", "node_types", "has_code", "token_count", "quality", "content",
    }
    assert rows and all(required <= set(r) for r in rows)
    assert all(r["book_sha256"] == book["sha256"] for r in rows)


def test_second_run_is_an_idempotent_cache_hit_with_identical_chunk_ids(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    first = ingest(ws, pdf_dir / "technical.pdf")
    ids1 = _chunk_ids(ws, document(first))

    second = ingest(ws, pdf_dir / "technical.pdf")
    doc2 = document(second)
    assert second.returncode == 0 and doc2["books"][0]["state"] == "done"
    assert "No work to do" in second.stderr and "Spawned worker" not in second.stderr
    assert second.elapsed < 5.0  # plan target is ~2 s; leave headroom for slow CI
    assert _chunk_ids(ws, doc2) == ids1


def _chunk_ids(ws: Path, doc: dict) -> list[str]:
    rel = doc["books"][0]["datasets"]["rag"]
    return [json.loads(line)["chunk_id"] for line in (ws / rel).read_text(encoding="utf-8").splitlines()]


def test_same_content_at_a_new_path_is_the_same_book(pdf_dir: Path, tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    document(ingest(ws, pdf_dir / "technical.pdf"))
    copy = tmp_path / "elsewhere" / "copy.pdf"
    copy.parent.mkdir()
    copy.write_bytes((pdf_dir / "technical.pdf").read_bytes())
    doc = document(ingest(ws, copy))
    assert doc["books"][0]["book_id"] == 1
    assert doc["books"][0]["source_path"] == str(copy.resolve())


def test_modes_flag_limits_which_datasets_are_written(pdf_dir: Path, tmp_path: Path) -> None:
    doc = document(ingest(tmp_path / "ws", pdf_dir / "technical.pdf", extra=("--modes", "rag,sft,code")))
    assert set(doc["books"][0]["datasets"]) == {"rag", "sft", "code"}


def test_several_pdfs_in_one_call(pdf_dir: Path, tmp_path: Path) -> None:
    result = ingest(tmp_path / "ws", pdf_dir / "technical.pdf", pdf_dir / "twocol.pdf")
    doc = document(result)
    assert result.returncode == 0
    assert sorted(b["title"] for b in doc["books"]) == ["A Study of Sector Recovery", "Disk Recovery Handbook"]


def test_license_status_is_recorded(pdf_dir: Path, tmp_path: Path) -> None:
    doc = document(ingest(tmp_path / "ws", pdf_dir / "technical.pdf", extra=("--license", "owned")))
    assert doc["books"][0]["license_status"] == "owned"


# --------------------------------------------------------------------------- exit codes
def test_exit_2_for_a_scanned_pdf(pdf_dir: Path, tmp_path: Path) -> None:
    result = ingest(tmp_path / "ws", pdf_dir / "scanned.pdf")
    assert result.returncode == 2
    (book,) = document(result)["books"]
    assert book["state"] == "needs_input" and book["doc_type"] == "scanned"
    assert "ocr_required" in book["warnings"] and book["datasets"] == {} and book["counts"] == {}


def test_exit_3_for_a_corrupt_pdf(tmp_path: Path) -> None:
    junk = tmp_path / "junk.pdf"
    junk.write_bytes(b"%PDF-1.4 definitely not a pdf")
    result = ingest(tmp_path / "ws", junk)
    assert result.returncode == 3
    (book,) = document(result)["books"]
    assert book["state"] == "failed" and "corrupt_pdf" in book["error"]


def test_failed_outranks_needs_input(pdf_dir: Path, tmp_path: Path) -> None:
    junk = tmp_path / "junk.pdf"
    junk.write_bytes(b"nope")
    assert ingest(tmp_path / "ws", pdf_dir / "scanned.pdf", junk).returncode == 3


def test_exit_4_when_the_workspace_is_locked(tmp_path: Path) -> None:
    ws = init_workspace(DabookConfig(workspace=tmp_path / "ws"))
    lock = WorkspaceLock(ws)
    lock.acquire()
    try:
        pdf = tmp_path / "x.pdf"
        pdf.write_bytes(b"%PDF-1.4")
        result = ingest(ws, pdf, extra=("--lock-wait-s", "0.5"), timeout=30)
    finally:
        lock.release()
    assert result.returncode == 4
    doc = document(result)
    assert doc["error"]["code"] == "lock_held" and doc["books"] == []


def test_ingest_waits_for_a_lock_that_is_released_in_time(pdf_dir: Path, tmp_path: Path) -> None:
    import threading
    import time

    ws = init_workspace(DabookConfig(workspace=tmp_path / "ws"))
    lock = WorkspaceLock(ws)
    lock.acquire()
    threading.Timer(2.0, lock.release).start()
    t0 = time.time()
    result = ingest(ws, pdf_dir / "technical.pdf", extra=("--lock-wait-s", "30"))
    assert result.returncode == 0 and time.time() - t0 >= 2.0


@pytest.mark.parametrize(
    ("args", "needle"),
    [
        (("ingest", "-w", "{ws}", "--json"), "No PDF paths"),
        (("ingest", "{missing}", "-w", "{ws}", "--json"), "Not found"),
        (("ingest", "{pdf}", "-w", "{ws}", "--json", "--profile", "turbo"), "unknown profile"),
        (("ingest", "{pdf}", "-w", "{ws}", "--json", "--modes", "rag,instruct"), "Invalid configuration"),
        (("ingest", "{pdf}", "-w", "{ws}", "--json", "--license", "stolen"), "license"),
    ],
)
def test_exit_5_for_bad_arguments(pdf_dir: Path, tmp_path: Path, args: tuple, needle: str) -> None:
    fmt = {"ws": str(tmp_path / "ws"), "missing": str(tmp_path / "nope.pdf"), "pdf": str(pdf_dir / "technical.pdf")}
    result = run_cli(*(a.format(**fmt) for a in args), timeout=30)
    assert result.returncode == 5
    assert needle.lower() in (result.stderr + result.stdout).lower()
    doc = json.loads(result.stdout)  # still a valid contract document, with an error
    jsonschema.validate(doc, SCHEMA)
    assert doc["error"]["code"] == "bad_args" and doc["books"] == []


def test_unknown_cli_option_to_ingest_is_exit_5_not_clicks_2(pdf_dir: Path, tmp_path: Path) -> None:
    assert run_cli("ingest", str(pdf_dir / "technical.pdf"), "--no-such-flag", timeout=30).returncode == 5
    assert run_cli("status", "--no-such-flag", timeout=30).returncode == 2  # other commands keep click's code


# --------------------------------------------------------------------------- doctor
def test_doctor_json_is_machine_readable(tmp_path: Path) -> None:
    result = run_cli("doctor", "--json", "-w", str(tmp_path / "ws"), timeout=30)
    doc = json.loads(result.stdout)
    assert result.returncode == 0 and doc["ok"] is True
    names = {c["name"] for c in doc["checks"]}
    assert {"Python version", "SQLite version", "pypdfium2", "ftfy"} <= names
    assert doc["dabook_version"] and doc["executable"]
    # the dashboard port is advisory: a busy port must not make `ingest` look unhealthy
    assert next(c for c in doc["checks"] if c["name"].startswith("Port"))["required"] is False


def test_the_schema_itself_is_valid_and_rejects_bad_documents() -> None:
    jsonschema.Draft202012Validator.check_schema(SCHEMA)
    bad = {"schema": "dabook.ingest.v1", "dabook_version": "1", "books": [{"book_id": 1}]}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, SCHEMA)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({"schema": "other", "dabook_version": "1", "books": []}, SCHEMA)
