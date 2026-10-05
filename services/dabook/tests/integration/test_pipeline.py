"""Phase 1 regression tests: each defect (D1-D12) and each step (1.1-1.10) gets coverage here."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

import pytest

from dabook.core.scheduler.planner import STAGE_DAG, compute_stage_keys, plan_book
from dabook.stages import registry
from dabook.stages.registry import StageImpl
from tests.conftest import Pipeline

DOT_LEADER = re.compile(r"(?:\.\s?){4,}")
ALL_MODES = {"dataset": {"modes": ["raw", "rag", "pretrain", "sft", "code"]}}


@pytest.fixture()
def full(tmp_path: Path):
    p = Pipeline(tmp_path / "ws", **ALL_MODES)
    yield p
    p.close()


# --------------------------------------------------------------------------- D8 / 1.5
def test_run_completes_and_publishes_book_metadata(full: Pipeline, tech_pdf: Path) -> None:
    res = full.enqueue(tech_pdf)
    full.drain()
    book = full.book(res.book_id)
    assert book["state"] == "done"
    assert book["title"] == "Disk Recovery Handbook"  # from PDF metadata (D8)
    assert book["pages"] == 8
    assert book["doc_type"] == "native"
    assert book["quality_score"] is not None and book["quality_score"] >= 0.9  # D8
    assert full.states(res.book_id) == {"done": sum(full.states(res.book_id).values())}


def test_review_gate_routes_low_quality_books_to_review(tmp_path: Path, tech_pdf: Path) -> None:
    p = Pipeline(tmp_path / "ws")
    try:
        params = {**p.params, "review_gate": True, "quality_review": 1.5}  # unreachable bar
        res = p.enqueue(tech_pdf, params)
        p.drain()
        assert p.book(res.book_id)["state"] == "review"
        events = [r["kind"] for r in p.con.execute("SELECT kind FROM events")]
        assert "needs_review" in events
    finally:
        p.close()


def test_without_the_gate_a_low_score_still_finishes_done(pipeline: Pipeline, tech_pdf: Path) -> None:
    params = {**pipeline.params, "review_gate": False, "quality_review": 1.5}
    res = pipeline.enqueue(tech_pdf, params)
    pipeline.drain()
    assert pipeline.book(res.book_id)["state"] == "done"


# --------------------------------------------------------------------------- 1.9
def test_scanned_pdf_ends_in_needs_input_not_an_empty_done(pipeline: Pipeline, pdf_dir: Path) -> None:
    res = pipeline.enqueue(pdf_dir / "scanned.pdf")
    pipeline.drain()
    book = pipeline.book(res.book_id)
    assert book["state"] == "needs_input"
    assert book["doc_type"] == "scanned"
    assert "OCR" in book["error"]
    assert not (pipeline.ws / "books" / book["sha256"][:12] / "datasets").exists()
    assert "ocr_required" in [r["kind"] for r in pipeline.con.execute("SELECT kind FROM events")]
    # downstream tasks were cancelled, not left pending to spin forever
    assert pipeline.states(res.book_id).get("pending", 0) == 0


def test_replanning_a_scanned_book_stays_needs_input(pipeline: Pipeline, pdf_dir: Path) -> None:
    res = pipeline.enqueue(pdf_dir / "scanned.pdf")
    pipeline.drain()
    again = pipeline.enqueue(pdf_dir / "scanned.pdf")
    pipeline.drain()
    assert again.book_id == res.book_id
    assert pipeline.book(res.book_id)["state"] == "needs_input"


# --------------------------------------------------------------------------- D4 / D5
def test_changed_extract_params_do_not_duplicate_or_mix_pages(
    pipeline: Pipeline, tech_pdf: Path
) -> None:
    first = pipeline.enqueue(tech_pdf, {**pipeline.params, "ocr_dpi": 300})
    pipeline.drain()
    assert pipeline.book(first.book_id)["state"] == "done"

    # Different ocr_dpi -> different s02 keys. The old s02 outputs remain on disk.
    second = pipeline.enqueue(tech_pdf, {**pipeline.params, "ocr_dpi": 150})
    assert second.book_id == first.book_id
    pipeline.drain()

    sha12 = pipeline.book(first.book_id)["sha256"][:12]
    s02_dirs = [d for d in (pipeline.ws / "books" / sha12 / "stages" / "s02_extract").iterdir() if d.is_dir()]
    assert len(s02_dirs) == 2  # both generations exist, the old one is just not read

    key = pipeline.con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage='s03_merge'", (first.book_id,)
    ).fetchone()["stage_key"]
    merged = json.loads(
        (pipeline.ws / "books" / sha12 / "stages" / "s03_merge" / key / "merged_pages.json").read_text(
            encoding="utf-8"
        )
    )
    indices = [p["page_idx"] for p in merged["pages"]]
    assert indices == list(range(8))  # every page exactly once (D5)
    assert pipeline.book(first.book_id)["state"] == "done"


def test_upstream_change_invalidates_exactly_the_downstream_stages() -> None:
    sha = "cd" * 32
    base = {"render_dpi_assets": 170}
    a = compute_stage_keys(sha, 8, base)
    b = compute_stage_keys(sha, 8, {"render_dpi_assets": 200})
    unchanged = [s for s in a if a[s] == b[s]]
    assert unchanged == ["s00_register", "s01_inspect"]  # s02 and everything after it moved
    assert all(a[s] != b[s] for s in a if s not in unchanged)


def test_each_stage_key_depends_on_its_upstream_keys() -> None:
    keys = compute_stage_keys("ef" * 32, 45, {}, shard_pages=20)
    assert len(keys["s02_extract"]) == 3  # 45 pages / 20 per shard
    assert len(set(keys["s02_extract"])) == 3


def test_stage_inputs_come_from_planned_keys_not_newest_directory(
    pipeline: Pipeline, tech_pdf: Path
) -> None:
    """A newer-looking directory on disk must never be preferred over the planned key (D4)."""
    res = pipeline.enqueue(tech_pdf)
    pipeline.drain()
    sha12 = pipeline.book(res.book_id)["sha256"][:12]
    s03_root = pipeline.ws / "books" / sha12 / "stages" / "s03_merge"
    planned = pipeline.con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage='s03_merge'", (res.book_id,)
    ).fetchone()["stage_key"]
    # plant a committed-looking decoy with a hex key that sorts higher than the planned one
    decoy = s03_root / "ffffffffffffffff"
    shutil.copytree(s03_root / planned, decoy)
    (decoy / "merged_pages.json").write_text(json.dumps({"pages": [], "total_pages": 0}), encoding="utf-8")

    # force s04 to re-run: drop its output and mark the task pending
    s04_key = pipeline.con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage='s04_furniture'", (res.book_id,)
    ).fetchone()["stage_key"]
    shutil.rmtree(pipeline.ws / "books" / sha12 / "stages" / "s04_furniture" / s04_key)
    plan_book(pipeline.con, res.book_id, pipeline.book(res.book_id)["sha256"], 8, pipeline.ws, pipeline.params)
    pipeline.drain()

    cleaned = json.loads(
        (pipeline.ws / "books" / sha12 / "stages" / "s04_furniture" / s04_key / "clean_pages.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(cleaned["pages"]) == 8  # read the planned s03, not the empty decoy


# --------------------------------------------------------------------------- D7 / 1.4
def test_bumping_a_stage_version_replans_it_and_everything_after(
    pipeline: Pipeline, tech_pdf: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    res = pipeline.enqueue(tech_pdf)
    pipeline.drain()
    book = pipeline.book(res.book_id)
    before = {
        r["stage"]: r["stage_key"]
        for r in pipeline.con.execute("SELECT stage, stage_key FROM tasks WHERE book_id=?", (res.book_id,))
    }

    old = registry.STAGE_IMPLS["s08_typed_content"]
    monkeypatch.setitem(
        registry.STAGE_IMPLS, "s08_typed_content", StageImpl(old.name, "9.9.9", old.fn)
    )
    counts = plan_book(pipeline.con, res.book_id, book["sha256"], 8, pipeline.ws, pipeline.params)

    after = {
        r["stage"]: (r["stage_key"], r["state"])
        for r in pipeline.con.execute("SELECT stage, stage_key, state FROM tasks WHERE book_id=?", (res.book_id,))
    }
    order = [s.name for s in STAGE_DAG]
    first_changed = order.index("s08_typed_content")
    for name in order[:first_changed]:
        assert after[name][0] == before[name]
    for name in order[first_changed:]:
        assert after[name][0] != before[name], name
        assert after[name][1] == "pending", name
    assert counts["pending"] == len(order) - first_changed
    assert pipeline.book(res.book_id)["state"] == "queued"  # re-queued, claimable again

    pipeline.drain()
    assert pipeline.book(res.book_id)["state"] == "done"


def test_planner_versions_come_from_the_registry() -> None:
    for spec in STAGE_DAG:
        assert spec.impl_version == registry.STAGE_IMPLS[spec.name].version
    assert all(s.impl_version for s in STAGE_DAG)  # every stage declares a version


# --------------------------------------------------------------------------- D10 / 1.6
def test_missing_source_pdf_fails_the_task_instead_of_faking_success(
    pipeline: Pipeline, tech_pdf: Path
) -> None:
    res = pipeline.enqueue(tech_pdf)
    tech_pdf.unlink()  # source vanishes between planning and execution
    pipeline.drain()

    book = pipeline.book(res.book_id)
    assert book["state"] == "failed"
    assert "not found" in book["error"]
    dead = pipeline.con.execute(
        "SELECT stage, state, error_class, attempts FROM tasks WHERE book_id=? AND state='dead'",
        (res.book_id,),
    ).fetchall()
    assert [(d["stage"], d["error_class"], d["attempts"]) for d in dead] == [
        ("s00_register", "missing_source", 1)  # non-retryable: no wasted attempts
    ]
    assert not any(
        r["state"] == "done" for r in pipeline.con.execute("SELECT state FROM tasks WHERE book_id=?", (res.book_id,))
    )


def test_fake_stages_are_only_available_behind_the_env_flag(
    pipeline: Pipeline, tech_pdf: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DABOOK_FAKE_STAGES", "1")
    res = pipeline.enqueue(tech_pdf)
    tech_pdf.unlink()
    monkeypatch.setattr("dabook.core.runtime.worker._run_fake_stage", lambda *a, **k: {"output_path": "x"})
    pipeline.drain(limit=1)
    assert pipeline.states(res.book_id).get("done", 0) == 1


# --------------------------------------------------------------------------- self-healing
def test_replan_rebuilds_a_vanished_artifact(pipeline: Pipeline, tech_pdf: Path) -> None:
    res = pipeline.enqueue(tech_pdf)
    pipeline.drain()
    sha12 = pipeline.book(res.book_id)["sha256"][:12]
    key = pipeline.con.execute(
        "SELECT stage_key FROM tasks WHERE book_id=? AND stage='s10_clean'", (res.book_id,)
    ).fetchone()["stage_key"]
    shutil.rmtree(pipeline.ws / "books" / sha12 / "stages" / "s10_clean" / key)

    pipeline.enqueue(tech_pdf)
    assert pipeline.book(res.book_id)["state"] == "queued"
    assert pipeline.drain() >= 1
    assert pipeline.book(res.book_id)["state"] == "done"


def test_fully_cached_replan_settles_immediately_with_no_work(pipeline: Pipeline, tech_pdf: Path) -> None:
    res = pipeline.enqueue(tech_pdf)
    pipeline.drain()
    again = pipeline.enqueue(tech_pdf)
    assert again.counts["pending"] == 0
    assert again.state == "done"
    assert pipeline.drain() == 0


def test_cached_stages_are_marked_skipped_in_a_fresh_workspace_db(
    pipeline: Pipeline, tech_pdf: Path
) -> None:
    """Re-registering in a new DB over an existing artifact tree reuses the cache."""
    res = pipeline.enqueue(tech_pdf)
    pipeline.drain()
    pipeline.con.execute("DELETE FROM books")  # cascades to tasks and deps
    again = pipeline.enqueue(tech_pdf)
    assert again.counts["skipped"] == sum(again.counts.values())
    assert again.state == "done"
    assert res.sha256 == again.sha256


def test_moved_pdf_is_found_again_on_reregistration(pipeline: Pipeline, tech_pdf: Path, tmp_path: Path) -> None:
    res = pipeline.enqueue(tech_pdf)
    moved = tmp_path / "moved" / "renamed.pdf"
    moved.parent.mkdir()
    shutil.move(str(tech_pdf), moved)
    again = pipeline.enqueue(moved)
    assert again.book_id == res.book_id
    assert pipeline.book(res.book_id)["path"] == str(moved.resolve())
    pipeline.drain()
    assert pipeline.book(res.book_id)["state"] == "done"


def test_unreadable_pdf_is_recorded_as_a_failed_book_without_raising(pipeline: Pipeline, tmp_path: Path) -> None:
    junk = tmp_path / "junk.pdf"
    junk.write_bytes(b"this is not a pdf")
    res = pipeline.enqueue(junk)
    assert res.state == "failed" and "corrupt_pdf" in res.error
    assert pipeline.book(res.book_id)["state"] == "failed"


# --------------------------------------------------------------------------- 1.8 / 1.10
def test_only_requested_modes_are_written_and_stale_files_removed(tmp_path: Path, tech_pdf: Path) -> None:
    p = Pipeline(tmp_path / "ws", **ALL_MODES)
    try:
        res = p.enqueue(tech_pdf)
        p.drain()
        # sft.jsonl holds only assisted pairs (none without a provider); templates stay separate
        assert p.dataset(res.book_id, "sft") == []
        assert p.dataset(res.book_id, "sft_heuristic") and p.dataset(res.book_id, "code")

        narrow = Pipeline(tmp_path / "ws", dataset={"modes": ["rag"]})
        try:
            narrow.enqueue(tech_pdf, narrow.params)
            narrow.drain()
        finally:
            narrow.close()
        sha12 = p.book(res.book_id)["sha256"][:12]
        names = sorted(f.name for f in (p.ws / "books" / sha12 / "datasets").glob("*.jsonl"))
        assert names == ["rag.jsonl"]
    finally:
        p.close()


def test_chunk_token_settings_change_the_chunking(tmp_path: Path, tech_pdf: Path) -> None:
    coarse = Pipeline(tmp_path / "a", dataset={"modes": ["rag"], "chunk_target_tokens": 900, "chunk_max_tokens": 1000})
    fine = Pipeline(tmp_path / "b", dataset={"modes": ["rag"], "chunk_target_tokens": 50, "chunk_max_tokens": 100})
    try:
        r1, r2 = coarse.enqueue(tech_pdf), fine.enqueue(tech_pdf)
        coarse.drain()
        fine.drain()
        n_coarse, n_fine = len(coarse.dataset(r1.book_id, "rag")), len(fine.dataset(r2.book_id, "rag"))
        assert n_fine > n_coarse
        assert all(c["token_count"] <= 100 for c in fine.dataset(r2.book_id, "rag"))
    finally:
        coarse.close()
        fine.close()


def test_golden_technical_fixture_has_no_toc_noise_and_has_shell_code(full: Pipeline, tech_pdf: Path) -> None:
    res = full.enqueue(tech_pdf)
    full.drain()

    for name in ("rag", "sft", "pretrain", "code"):
        for record in full.dataset(res.book_id, name):
            blob = json.dumps(record)
            assert not DOT_LEADER.search(blob), f"dot-leader text leaked into {name}"
    raw_types = [r["type"] for r in full.dataset(res.book_id, "raw")]
    assert "toc" in raw_types  # raw is a faithful dump and keeps it, typed as toc

    code = full.dataset(res.book_id, "code")
    assert any(c["language"] == "bash" for c in code)  # shell blocks were found
    assert any(c["language"] == "c" for c in code)
    # furniture (running header + page numbers) is gone from every dataset
    assert not any("Disk Recovery Handbook" in c["content"] for c in full.dataset(res.book_id, "rag"))


def test_prose_is_not_misread_as_code(full: Pipeline, tech_pdf: Path) -> None:
    res = full.enqueue(tech_pdf)
    full.drain()
    for c in full.dataset(res.book_id, "code"):
        assert "Select the partition type" not in c["code"]


def test_rag_records_carry_citation_fields(full: Pipeline, tech_pdf: Path) -> None:
    res = full.enqueue(tech_pdf)
    full.drain()
    rows = full.dataset(res.book_id, "rag")
    assert rows
    sha = full.book(res.book_id)["sha256"]
    for r in rows:
        assert r["book_sha256"] == sha and r["book_title"] == "Disk Recovery Handbook"
        assert 1 <= r["page_start"] <= r["page_end"] <= 8
        assert r["node_ids"] and r["node_types"] and r["token_count"] > 0
        assert isinstance(r["has_code"], bool) and r["quality"] is not None
    with_outline = [r for r in rows if r["breadcrumbs"]]
    assert len(with_outline) / len(rows) > 0.9  # >90% carry breadcrumbs when an outline exists
    assert len({r["chunk_id"] for r in rows}) == len(rows)


def test_headings_without_an_outline_still_give_structure(pipeline: Pipeline, pdf_dir: Path) -> None:
    res = pipeline.enqueue(pdf_dir / "no_outline.pdf")
    pipeline.drain()
    assert pipeline.book(res.book_id)["state"] == "done"
    rows = pipeline.dataset(res.book_id, "rag")
    # bold-typography headings are found even though the PDF has no bookmarks
    assert any(r["breadcrumbs"] for r in rows)


def test_two_column_pdf_runs_to_done_with_all_text(pipeline: Pipeline, pdf_dir: Path) -> None:
    res = pipeline.enqueue(pdf_dir / "twocol.pdf")
    pipeline.drain()
    assert pipeline.book(res.book_id)["state"] == "done"
    rows = pipeline.dataset(res.book_id, "rag")
    text = " ".join(r["content"] for r in rows)
    assert "Large volumes take longer" in text and "recovery tool scans" in text


def test_settings_command_initialises_a_workspace(tmp_path: Path) -> None:
    """The old `settings` command called init_workspace with the wrong arguments."""
    from dabook.config.models import DabookConfig
    from dabook.core.workspace import get_db_path, init_workspace

    ws = init_workspace(DabookConfig(workspace=tmp_path / "fresh"))
    assert get_db_path(ws).is_file()
