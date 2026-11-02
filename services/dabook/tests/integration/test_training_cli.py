"""The governance loop through the real CLI: ingest -> license -> review -> recompile -> export."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from tests.integration.cli_helpers import dabook_env, live_pids, run_cli

pytestmark = pytest.mark.slow

SCHEMA = json.loads((Path(__file__).parents[2] / "schemas" / "dabook.ingest.v1.schema.json").read_text(encoding="utf-8"))
ENV = dabook_env(DABOOK_ENABLE_FAKE_PROVIDER="1", DABOOK_ASSIST_BACKOFF_S="0")


def cli(*args: str, timeout: float = 180):
    return run_cli(*args, timeout=timeout, env=ENV)


def js(result) -> dict:
    return json.loads(result.stdout)


@pytest.fixture()
def lab(pdf_dir: Path, tmp_path: Path):
    """A workspace with one assisted, training-ready book."""
    ws = tmp_path / "ws"
    result = cli("ingest", str(pdf_dir / "technical.pdf"), "-w", str(ws), "--json",
                 "--assist", "fake:grounded", "--modes", "rag,sft,pretrain,code")
    assert result.returncode == 0, result.stderr[-3000:]
    assert live_pids(result.seen_pids) == []
    doc = js(result)
    jsonschema.validate(doc, SCHEMA)
    return ws, doc["books"][0], tmp_path


def test_ingest_with_assist_reports_splits_and_review_state(lab) -> None:
    ws, book, _ = lab
    assert book["state"] == "done" and book["review_status"] == "unreviewed" and book["license_status"] == "unknown"
    assert book["counts"]["sft"] > 0 and set(book["splits"]) == {"sft", "pretrain", "code"}
    for mode, by_split in book["splits"].items():
        for rel in by_split.values():
            assert (ws / rel).is_file() and not Path(rel).is_absolute()
    rows = [json.loads(line) for line in (ws / book["datasets"]["sft"]).read_text(encoding="utf-8").splitlines()]
    assert all(r["generator"] == "assist:fake:grounded" for r in rows)


def test_books_lists_the_governance_view(lab) -> None:
    ws, book, _ = lab
    result = cli("books", "-w", str(ws), "--json", timeout=60)
    doc = js(result)
    assert result.returncode == 0 and doc["schema"] == "dabook.books.v1"
    assert [b["sha256"] for b in doc["books"]] == [book["sha256"]]
    jsonschema.validate({"schema": "dabook.ingest.v1", "dabook_version": doc["dabook_version"], "books": doc["books"]}, SCHEMA)


def test_export_is_blocked_until_the_license_allows_training(lab) -> None:
    ws, book, tmp = lab
    for status in ("unknown", "copyrighted"):
        if status != "unknown":
            assert cli("license", book["sha256"][:10], status, "-w", str(ws), "--json", timeout=60).returncode == 0
        blocked = cli("export", "--out", str(tmp / f"out-{status}"), "-w", str(ws), "--book", book["sha256"][:10], "--json", timeout=60)
        assert blocked.returncode == 6
        error = js(blocked)["error"]
        assert error["code"] == "export_blocked" and status in json.dumps(error["details"])
        assert not (tmp / f"out-{status}" / "manifest.json").exists()

    # "export everything" is blocked too when nothing is eligible, and writes nothing
    everything = cli("export", "--out", str(tmp / "out-all"), "-w", str(ws), "--json", timeout=60)
    assert everything.returncode == 6 and not (tmp / "out-all" / "sft").exists()


def test_license_then_export_produces_a_governed_bundle(lab) -> None:
    ws, book, tmp = lab
    licensed = cli("license", str(book["book_id"]), "owned", "-w", str(ws), "--json", timeout=60)
    assert js(licensed)["license_status"] == "owned"

    out = tmp / "bundle"
    result = cli("export", "--out", str(out), "-w", str(ws), "--book", str(book["book_id"]),
                 "--modes", "sft,code", "--format", "jsonl,parquet,hf", "--json", timeout=120)
    assert result.returncode == 0, result.stderr[-2000:]
    manifest = js(result)
    assert manifest["schema"] == "dabook.export.v1" and manifest["books"][0]["license_status"] == "owned"
    assert manifest["excluded_heuristic_records"] == 0 and sum(manifest["counts"]["sft"].values()) == book["counts"]["sft"]
    names = set(manifest["files"])
    assert any(n.startswith("sft/") and n.endswith(".jsonl") for n in names)
    assert any(n.endswith(".parquet") for n in names) and "hf/sft/README.md" in names
    rows = [json.loads(line) for line in (out / "sft" / "train.jsonl").read_text(encoding="utf-8").splitlines()]
    assert rows and all(r["license_status"] == "owned" and r["book_sha256"] == book["sha256"] and r["split"] == "train" for r in rows)
    assert json.loads((out / "manifest.json").read_text(encoding="utf-8"))["counts"] == manifest["counts"]


def test_review_loop_through_the_cli(lab) -> None:
    ws, book, tmp = lab
    sample = js(cli("review", "sample", book["sha256"][:10], "-w", str(ws), "-n", "3", "--json", timeout=60))
    assert sample["total_pairs"] >= 3 and len(sample["sample"]) == 3 and sample["book"]["review_status"] == "unreviewed"
    first = sample["sample"][0]
    assert first["source_excerpt"] and first["evidence"] and first["pages"][0] >= 1 and first["decision"] is None
    # the same seed shows the same sample
    again = js(cli("review", "sample", book["sha256"][:10], "-w", str(ws), "-n", "3", "--json", timeout=60))
    assert [s["pair_id"] for s in again["sample"]] == [s["pair_id"] for s in sample["sample"]]

    # the sample draws from every generated pair, some of which dedup already dropped from the dataset;
    # reject one that is actually shipped so the count must fall
    shipped = (ws / book["datasets"]["sft"]).read_text(encoding="utf-8")
    everything = js(cli("review", "sample", book["sha256"][:10], "-w", str(ws), "-n", "200", "--json", timeout=60))["sample"]
    first = next(p for p in everything if p["pair_id"] in shipped)
    decided = cli("review", "decide", book["sha256"][:10], first["pair_id"], "reject", "--reason", "wrong", "-w", str(ws), "--json", timeout=60)
    assert decided.returncode == 0 and js(decided)["action"] == "reject"
    assert cli("review", "decide", book["sha256"][:10], "nosuchpair", "reject", "-w", str(ws), "--json", timeout=60).returncode == 5
    assert cli("review", "decide", book["sha256"][:10], first["pair_id"], "maybe", "-w", str(ws), "--json", timeout=60).returncode == 5

    recompiled = cli("recompile", book["sha256"][:10], "-w", str(ws), "--json", timeout=180)
    assert recompiled.returncode == 0, recompiled.stderr[-2000:]
    report = js(recompiled)
    assert report["replanned"]["pending"] == 1  # only the compile stage re-ran
    # rejecting the surviving copy of a near-duplicate group lets its twin take its place, so the count
    # falls by one or stays; the rejected pair itself must never ship
    assert book["counts"]["sft"] - 1 <= report["book"]["counts"]["sft"] <= book["counts"]["sft"]
    rows = (ws / report["book"]["datasets"]["sft"]).read_text(encoding="utf-8")
    assert first["pair_id"] not in rows

    reviewed = cli("review", "book", book["sha256"][:10], "approved", "-w", str(ws), "--json", timeout=60)
    assert js(reviewed)["review_status"] == "approved"
    assert js(cli("review", "sample", book["sha256"][:10], "-w", str(ws), "-n", "200", "--json", timeout=60))["decided"] == 1


def test_a_rejected_book_cannot_be_exported_even_when_licensed(lab) -> None:
    ws, book, tmp = lab
    cli("license", book["sha256"][:10], "public_domain", "-w", str(ws), "--json", timeout=60)
    cli("review", "book", book["sha256"][:10], "rejected", "-w", str(ws), "--json", timeout=60)
    blocked = cli("export", "--out", str(tmp / "o"), "-w", str(ws), "--book", book["sha256"][:10], "--json", timeout=60)
    assert blocked.returncode == 6 and "rejected in review" in json.dumps(js(blocked)["error"]["details"])


@pytest.mark.parametrize(
    "args",
    [
        ("license", "{sha}", "stolen"),
        ("license", "doesnotexist", "owned"),
        ("export", "--out", "{out}", "--modes", "rag"),
        ("export", "--out", "{out}", "--format", "csv"),
        ("review", "book", "{sha}", "maybe"),
    ],
)
def test_governance_commands_reject_bad_arguments_with_exit_5(lab, args) -> None:
    ws, book, tmp = lab
    argv = [a.format(sha=book["sha256"][:10], out=str(tmp / "out")) for a in args]
    result = cli(*argv, "-w", str(ws), "--json", timeout=60)
    assert result.returncode == 5, (result.stdout, result.stderr[-500:])
    assert js(result)["error"]["code"] == "bad_args"


def test_assist_configuration_errors_are_bad_args_for_ingest(pdf_dir: Path, tmp_path: Path) -> None:
    result = cli("ingest", str(pdf_dir / "technical.pdf"), "-w", str(tmp_path / "ws"), "--json", "--assist", "gpt-4", timeout=60)
    assert result.returncode == 5 and js(result)["error"]["code"] == "bad_args"
    assert "assist.provider" in result.stderr
    paid = cli("ingest", str(pdf_dir / "technical.pdf"), "-w", str(tmp_path / "ws2"), "--json", "--assist", "openai:gpt-x", timeout=60)
    assert paid.returncode == 5 and "price_per_1k" in paid.stderr


def test_fake_providers_are_refused_without_the_test_flag(pdf_dir: Path, tmp_path: Path) -> None:
    env = dabook_env()
    env.pop("DABOOK_ENABLE_FAKE_PROVIDER", None)
    result = run_cli("ingest", str(pdf_dir / "technical.pdf"), "-w", str(tmp_path / "ws"), "--json",
                     "--assist", "fake:grounded", timeout=120, env=env)
    book = js(result)["books"][0]
    # the assist stage refuses to start; the book is not finished and nothing was generated
    assert result.returncode == 3 and book["state"] != "done" and "sft" not in book["datasets"]
