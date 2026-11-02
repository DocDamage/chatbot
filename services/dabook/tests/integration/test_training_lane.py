"""Phase 4A end to end: assisted SFT, dedup, splits, formats, provenance, review, governed export."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from dabook.assist.providers import FakeProvider, LLMResult, register_provider
from dabook.config.models import DabookConfig
from dabook.core.datasets import DedupSettings
from dabook.core.exporter import ExportBlocked, export_training_bundle
from dabook.core.formats import read_jsonl, read_parquet
from dabook.core.governance import (
    GovernanceError,
    edits_digest,
    export_decision,
    find_book,
    read_edits,
    record_edit,
    rejected_pair_ids,
    set_license,
    set_review_status,
)
from dabook.core.scheduler.planner import STAGE_DAG, plan_book
from tests.conftest import Pipeline
from tests.fixtures import make_technical_pdf

pytestmark = pytest.mark.usefixtures("fake_provider_enabled")

TRAINING = {"modes": ["raw", "rag", "pretrain", "sft", "code"]}


@pytest.fixture()
def fake_provider_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DABOOK_ENABLE_FAKE_PROVIDER", "1")


def pipe(tmp_path: Path, name: str = "ws", provider: str = "fake:grounded", **dataset: Any) -> Pipeline:
    return Pipeline(
        tmp_path / name,
        dataset={**TRAINING, **dataset},
        assist={"provider": provider, "min_section_words": 40},
    )


def stage_stats(p: Pipeline, book_id: int, stage: str = "s13_assist_sft") -> dict[str, Any]:
    key = p.con.execute("SELECT stage_key FROM tasks WHERE book_id=? AND stage=?", (book_id, stage)).fetchone()["stage_key"]
    sha12 = p.book(book_id)["sha256"][:12]
    return json.loads((p.ws / "books" / sha12 / "stages" / stage / key / "stats.json").read_text(encoding="utf-8"))


def events(p: Pipeline, kind: str) -> list[Any]:
    return p.con.execute("SELECT * FROM events WHERE kind=?", (kind,)).fetchall()


@pytest.fixture()
def assisted(tmp_path: Path, tech_pdf: Path):
    p = pipe(tmp_path)
    res = p.enqueue(tech_pdf)
    p.drain()
    yield p, res.book_id
    p.close()


# --------------------------------------------------------------------------- assisted sft
class TestAssistedSft:
    def test_the_stage_graph_orders_assist_before_compile(self) -> None:
        names = [s.name for s in STAGE_DAG]
        assert names[-2:] == ["s13_assist_sft", "s14_compile"]
        spec = {s.name: s for s in STAGE_DAG}["s13_assist_sft"]
        assert spec.resource_for({"assist_provider": "ollama:x"}) == "llm"
        assert spec.resource_for({"assist_provider": "none"}) == "cpu"  # no llm worker needed when off

    def test_exports_only_grounded_assisted_pairs_with_full_provenance(self, assisted) -> None:
        p, book_id = assisted
        book = p.book(book_id)
        assert book["state"] == "done"
        sft = p.dataset(book_id, "sft")
        assert sft and all(r["generator"] == "assist:fake:grounded" for r in sft)
        for r in sft:
            assert r["book_sha256"] == book["sha256"] and r["license_status"] == "unknown"
            assert r["source_node_ids"] and r["pages"][0] >= 1 and r["dabook_version"]
            assert r["pair_id"] and r["category"] in ("qa", "explain", "code_walkthrough") and r["evidence"]
            assert "instruction" in r and "messages" in r  # alpaca and chatml
            assert "source_excerpt" not in r  # lean training record; the excerpt stays in the stage artifact
        assert not any(r.get("generator") == "heuristic" for r in sft)

    def test_template_pairs_are_kept_apart_and_never_in_the_export_file(self, assisted) -> None:
        p, book_id = assisted
        heuristic = p.dataset(book_id, "sft_heuristic")
        assert heuristic and all(r["generator"] == "heuristic" for r in heuristic)
        sft_ids = {r["id"] for r in p.dataset(book_id, "sft")}
        assert sft_ids.isdisjoint({r["id"] for r in heuristic})

    def test_the_stage_reports_its_work_and_logs_to_events(self, assisted) -> None:
        p, book_id = assisted
        stats = stage_stats(p, book_id)
        manifest = json.loads((p.ws / "books" / p.book(book_id)["sha256"][:12] / "datasets" / "manifest.json").read_text(encoding="utf-8"))
        assert stats["provider"] == "fake:grounded"
        # accepted pairs feed compile, which then removes duplicates: the numbers reconcile exactly
        assert manifest["dedup"]["sft"]["input"] == stats["accepted"]
        assert len(p.dataset(book_id, "sft")) == manifest["dedup"]["sft"]["kept"] <= stats["accepted"]
        assert stats["calls"] == stats["units_processed"] > 0 and stats["cache_hits"] == 0 and not stats["budget_exhausted"]
        assert events(p, "assist_summary")

    def test_default_without_a_provider_exports_no_sft_and_says_why(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = Pipeline(tmp_path / "ws", dataset=TRAINING)
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            assert p.dataset(res.book_id, "sft") == [] and p.dataset(res.book_id, "sft_heuristic")
            manifest = json.loads((p.ws / "books" / p.book(res.book_id)["sha256"][:12] / "datasets" / "manifest.json").read_text(encoding="utf-8"))
            assert any("assist.provider is none" in w for w in manifest["warnings"])
            assert stage_stats(p, res.book_id)["skipped"] == "assist.provider is none"
        finally:
            p.close()

    def test_heuristic_pairs_can_be_included_explicitly(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = Pipeline(tmp_path / "ws", dataset={**TRAINING, "include_heuristic_sft": True})
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            assert {r["generator"] for r in p.dataset(res.book_id, "sft")} == {"heuristic"}
        finally:
            p.close()

    def test_hallucinated_pairs_are_all_rejected_and_logged(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = pipe(tmp_path, provider="fake:hallucinate")
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            assert p.book(res.book_id)["state"] == "done"  # rejections are not failures
            assert p.dataset(res.book_id, "sft") == []
            stats = stage_stats(p, res.book_id)
            assert stats["accepted"] == 0 and stats["rejected"] == stats["units_processed"] > 0
            assert set(stats["rejected_by_reason"]) <= {"evidence_not_in_source", "low_overlap"}
            logged = events(p, "assist_rejected")
            assert logged and all(e["level"] == "WARNING" and e["book_id"] == res.book_id for e in logged)
        finally:
            p.close()

    def test_malformed_model_output_is_rejected_not_fatal(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = pipe(tmp_path, provider="fake:garbage")
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            assert p.book(res.book_id)["state"] == "done"
            assert stage_stats(p, res.book_id)["rejected_by_reason"] == {"unparseable_response": stage_stats(p, res.book_id)["units_processed"]}
        finally:
            p.close()

    def test_a_provider_outage_fails_the_stage_as_a_retryable_model_error(self, tmp_path: Path, tech_pdf: Path, monkeypatch) -> None:
        """Every unit errors: after 5 in a row the task fails and is rescheduled; the book is not finished."""
        monkeypatch.setenv("DABOOK_ASSIST_BACKOFF_S", "0")
        p = Pipeline(tmp_path / "ws", dataset=TRAINING, assist={"provider": "fake:error", "min_section_words": 10, "max_section_words": 100})
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            task = p.con.execute("SELECT error_class, state, attempts, not_before FROM tasks WHERE book_id=? AND stage='s13_assist_sft'", (res.book_id,)).fetchone()
            assert task["error_class"] == "model_error" and task["state"] == "pending" and task["attempts"] == 1
            assert task["not_before"] > 0  # backoff: it is retried later, not hammered
            assert p.book(res.book_id)["state"] != "done"
            assert p.dataset(res.book_id, "sft") == []  # nothing half-written is published
        finally:
            p.close()


class TestCacheAndBudget:
    def test_replanned_stage_replays_answers_from_the_cache(self, assisted) -> None:
        p, book_id = assisted
        first = stage_stats(p, book_id)
        book = p.book(book_id)
        # A changed budget re-keys the assist stage (so a topped-up run can continue) ...
        params = {**p.params, "assist_max_cost_usd": 99.0}
        plan_book(p.con, book_id, book["sha256"], 8, p.ws, params)
        p.drain()
        second = stage_stats(p, book_id)
        # ... and every answer is replayed from the prompt-hash cache: no model calls at all.
        assert second["calls"] == 0 and second["cache_hits"] == first["units_processed"]
        assert second["accepted"] == first["accepted"]
        assert list((p.ws / "cache" / "llm").rglob("*.json"))

    def test_paid_provider_stops_cleanly_when_the_budget_is_spent(self, tmp_path: Path, tech_pdf: Path) -> None:
        class Paid(FakeProvider):
            is_paid = True

            def __init__(self) -> None:
                super().__init__("grounded")
                self.name = "paid:grounded"

            def complete(self, *a: Any, **k: Any) -> LLMResult:
                r = super().complete(*a, **k)
                return LLMResult(r.text, 1000, 200, r.model)

        register_provider("paid", lambda settings: Paid())
        p = Pipeline(tmp_path / "ws", dataset=TRAINING)
        try:
            params = {**p.params, "assist_provider": "paid:grounded", "assist_min_words": 40,
                      "assist_prices": [0.5, 0.5], "assist_max_cost_usd": 0.6}  # one call costs $0.60
            res = p.enqueue(tech_pdf, params)
            p.drain()
            assert p.book(res.book_id)["state"] == "done"
            stats = stage_stats(p, res.book_id)
            assert stats["budget_exhausted"] is True and stats["calls"] == 1 < stats["units"]
            assert stats["cost_usd"] == pytest.approx(0.6) and stats["budget_usd"] == 0.6
            assert p.dataset(res.book_id, "sft")  # what was generated before the stop is kept
            assert any("budget exhausted" in e["msg"] for e in events(p, "assist_summary"))
        finally:
            p.close()


# --------------------------------------------------------------------------- dedup, splits, formats
class TestDedupSplitsFormats:
    def test_dedup_stats_are_recorded_per_mode(self, assisted) -> None:
        p, book_id = assisted
        manifest = json.loads((p.ws / "books" / p.book(book_id)["sha256"][:12] / "datasets" / "manifest.json").read_text(encoding="utf-8"))
        for mode in ("sft", "pretrain", "code", "rag"):
            stats = manifest["dedup"][mode]
            assert stats["input"] == stats["exact_removed"] + stats["near_removed"] + stats["kept"]

    def test_repeated_chapters_are_deduplicated(self, tmp_path: Path) -> None:
        """Three identical chapters collapse to one set of sft pairs (the fixture repeats its text)."""
        p = pipe(tmp_path)
        try:
            pdf = make_technical_pdf(tmp_path / "t.pdf")
            res = p.enqueue(pdf)
            p.drain()
            sft = p.dataset(res.book_id, "sft")
            texts = [(r["instruction"], r["output"]) for r in sft]
            assert len(texts) == len(set(texts))
        finally:
            p.close()

    def test_splits_are_written_per_training_mode_and_never_split_a_chapter(self, assisted) -> None:
        p, book_id = assisted
        sha12 = p.book(book_id)["sha256"][:12]
        root = p.ws / "books" / sha12 / "datasets" / "splits"
        seen: dict[str, str] = {}
        total = 0
        for split_dir in root.iterdir():
            for f in split_dir.glob("sft.jsonl"):
                for r in read_jsonl(f):
                    assert r["split"] == split_dir.name
                    chapter = (r["breadcrumbs"] or ["__front__"])[0]
                    assert seen.setdefault(chapter, split_dir.name) == split_dir.name, "a chapter leaked across splits"
                    total += 1
        assert total == len(p.dataset(book_id, "sft"))
        assert not (root / "train" / "rag.jsonl").exists()  # retrieval data is not split

    def test_splits_follow_the_seed(self, tmp_path: Path, tech_pdf: Path) -> None:
        def run_with(seed: int, name: str) -> dict[str, list[str]]:
            p = Pipeline(tmp_path / name, dataset={**TRAINING, "split": {"seed": seed}}, assist={"provider": "fake:grounded", "min_section_words": 40})
            try:
                res = p.enqueue(tech_pdf)
                p.drain()
                manifest = json.loads((p.ws / "books" / p.book(res.book_id)["sha256"][:12] / "datasets" / "manifest.json").read_text(encoding="utf-8"))
                return {s: sorted(r["id"] for r in read_jsonl(p.ws / info["path"])) for s, info in manifest["splits"]["sft"].items()}
            finally:
                p.close()

        assert run_with(42, "a") == run_with(42, "b")  # same seed -> same split

    def test_splits_can_be_switched_off(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = Pipeline(tmp_path / "ws", dataset={**TRAINING, "split": None}, assist={"provider": "fake:grounded"})
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            assert not (p.ws / "books" / p.book(res.book_id)["sha256"][:12] / "datasets" / "splits").exists()
        finally:
            p.close()

    def test_parquet_and_hf_outputs_round_trip(self, tmp_path: Path, tech_pdf: Path) -> None:
        pytest.importorskip("pyarrow")
        p = Pipeline(tmp_path / "ws", dataset={**TRAINING, "formats": ["jsonl", "parquet", "hf"]}, assist={"provider": "fake:grounded", "min_section_words": 40})
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            assert p.book(res.book_id)["state"] == "done"
            datasets = p.ws / "books" / p.book(res.book_id)["sha256"][:12] / "datasets"
            sft = p.dataset(res.book_id, "sft")
            parquet = read_parquet(datasets / "parquet" / "sft.parquet")
            assert [r["id"] for r in parquet] == [r["id"] for r in sft]
            assert parquet[0]["messages"][-1]["role"] == "assistant" and parquet[0]["pages"] == sft[0]["pages"]
            hf = datasets / "hf" / "sft"
            assert (hf / "README.md").read_text(encoding="utf-8").startswith("---\nconfigs:")
            assert any((hf / "data").glob("train-*.parquet"))
        finally:
            p.close()

    def test_stale_derived_outputs_are_removed_when_formats_change(self, tmp_path: Path, tech_pdf: Path) -> None:
        pytest.importorskip("pyarrow")
        wide = Pipeline(tmp_path / "ws", dataset={**TRAINING, "formats": ["jsonl", "parquet"]}, assist={"provider": "fake:grounded"})
        try:
            res = wide.enqueue(tech_pdf)
            wide.drain()
        finally:
            wide.close()
        narrow = Pipeline(tmp_path / "ws", dataset=TRAINING, assist={"provider": "fake:grounded"})
        try:
            narrow.enqueue(tech_pdf, narrow.params)
            narrow.drain()
            assert not (narrow.ws / "books" / narrow.book(res.book_id)["sha256"][:12] / "datasets" / "parquet").exists()
        finally:
            narrow.close()

    def test_cross_book_dedup_in_the_consolidated_masters(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = pipe(tmp_path)
        try:
            a = p.enqueue(tech_pdf)
            variant = tmp_path / "variant.pdf"
            make_technical_pdf(variant, chapters=3)  # identical text, different bytes (metadata timestamp)
            variant.write_bytes(variant.read_bytes().replace(b"Disk Recovery Handbook", b"Disk Recovery Handbooks"))
            b = p.enqueue(variant)
            assert a.sha256 != b.sha256
            p.drain()
            masters = p.ws / "compiled"
            manifest = json.loads((masters / "manifest.json").read_text(encoding="utf-8"))
            per_book = len(p.dataset(a.book_id, "sft"))
            all_sft = read_jsonl(masters / "all_sft.jsonl")
            assert per_book > 0 and len(all_sft) < per_book + len(p.dataset(b.book_id, "sft"))
            assert manifest["dedup"]["enabled"] and sum(manifest["dedup"]["removed"]["sft"].values()) > 0
        finally:
            p.close()


# --------------------------------------------------------------------------- governance
class TestGovernance:
    def test_license_gate_blocks_everything_but_owned_permissive_public_domain(self, assisted) -> None:
        p, book_id = assisted
        for status, allowed in [("unknown", False), ("copyrighted", False), ("owned", True), ("permissive", True), ("public_domain", True)]:
            set_license(p.con, str(book_id), status)
            set_review_status(p.con, str(book_id), "approved")
            decision = export_decision(p.book(book_id), 0.95)
            assert decision.eligible is allowed, status
            if not allowed:
                assert "only" in decision.reasons[0] and "RAG" in decision.reasons[0]

    def test_review_or_verified_quality_is_required(self, assisted) -> None:
        p, book_id = assisted
        set_license(p.con, str(book_id), "owned")
        book = p.book(book_id)
        assert book["quality_score"] >= 0.95  # the fixture is verified-quality ...
        assert export_decision(book, 0.95).eligible
        assert not export_decision(book, 1.01).eligible  # ... but not if the bar is higher and nobody reviewed it
        set_review_status(p.con, str(book_id), "approved")
        assert export_decision(p.book(book_id), 1.01).eligible  # review overrides the score
        set_review_status(p.con, str(book_id), "rejected")
        rejected = export_decision(p.book(book_id), 0.0)
        assert not rejected.eligible and "rejected in review" in rejected.reasons[0]

    def test_unfinished_books_are_not_exportable(self, assisted) -> None:
        p, book_id = assisted
        set_license(p.con, str(book_id), "owned")
        p.con.execute("UPDATE books SET state='failed' WHERE id=?", (book_id,))
        assert not export_decision(p.book(book_id), 0.0).eligible

    def test_book_lookup_is_strict(self, assisted) -> None:
        p, book_id = assisted
        sha = p.book(book_id)["sha256"]
        assert find_book(p.con, str(book_id))["id"] == find_book(p.con, sha[:10])["id"] == find_book(p.con, p.book(book_id)["path"])["id"]
        for bad in ("999", "abc", "", "zzzzzzzz"):
            with pytest.raises(GovernanceError):
                find_book(p.con, bad)
        with pytest.raises(GovernanceError, match="Unknown license"):
            set_license(p.con, str(book_id), "stolen")
        with pytest.raises(GovernanceError, match="Unknown review"):
            set_review_status(p.con, str(book_id), "maybe")

    def test_a_copyrighted_book_cannot_be_exported_by_any_route(self, assisted, tmp_path: Path) -> None:
        p, book_id = assisted
        set_license(p.con, str(book_id), "copyrighted")
        for refs in ([str(book_id)], None):
            with pytest.raises(ExportBlocked) as err:
                export_training_bundle(p.con, p.ws, tmp_path / "out", book_refs=refs, modes=["sft", "pretrain", "code"], formats=["jsonl", "parquet", "hf"])
            assert "copyrighted" in str(err.value) or "No book is eligible" in str(err.value)
        assert not (tmp_path / "out" / "sft").exists() and not (tmp_path / "out" / "manifest.json").exists()
        # re-licensing makes it exportable; the license written into the export is the current one
        set_license(p.con, str(book_id), "owned")
        manifest = export_training_bundle(p.con, p.ws, tmp_path / "out2", book_refs=[str(book_id)])
        assert {r["license_status"] for r in read_jsonl(tmp_path / "out2" / "sft" / "train.jsonl") + read_jsonl(tmp_path / "out2" / "sft" / "val.jsonl")} <= {"owned"}
        assert manifest["books"][0]["license_status"] == "owned"

    def test_export_without_naming_books_skips_ineligible_ones_with_reasons(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = pipe(tmp_path)
        try:
            ok = p.enqueue(tech_pdf)
            other = tmp_path / "other.pdf"
            other.write_bytes((tmp_path / "technical.pdf").read_bytes().replace(b"Disk Recovery Handbook", b"Another Handbook Titled"))
            bad = p.enqueue(other)
            p.drain()
            set_license(p.con, str(ok.book_id), "public_domain")
            manifest = export_training_bundle(p.con, p.ws, tmp_path / "bundle")
            assert [b["book_id"] for b in manifest["books"]] == [ok.book_id]
            assert manifest["skipped_books"] and "license is 'unknown'" in next(iter(manifest["skipped_books"].values()))[0]
            assert bad.book_id not in [b["book_id"] for b in manifest["books"]]
        finally:
            p.close()

    def test_bundle_has_deduplicated_splits_provenance_and_a_manifest(self, assisted, tmp_path: Path) -> None:
        p, book_id = assisted
        set_license(p.con, str(book_id), "owned")
        manifest = export_training_bundle(p.con, p.ws, tmp_path / "b", book_refs=[str(book_id)], modes=["sft", "code"], formats=["jsonl", "parquet"])
        files = {f: tmp_path / "b" / f for f in manifest["files"]}
        assert any(f.endswith(".jsonl") for f in files) and any(f.endswith(".parquet") for f in files)
        total = sum(manifest["counts"]["sft"].values())
        assert total == len(p.dataset(book_id, "sft"))
        for split, n in manifest["counts"]["sft"].items():
            if n:
                rows = read_jsonl(tmp_path / "b" / "sft" / f"{split}.jsonl")
                assert len(rows) == n and all(r["split"] == split and r["generator"].startswith("assist:") for r in rows)
        assert manifest["generators"] == {"assist:fake:grounded": total} | ({"extraction": manifest["generators"].get("extraction", 0)} if "extraction" in manifest["generators"] else {})
        assert manifest["excluded_heuristic_records"] == 0
        assert manifest["books"][0]["sha256"] == p.book(book_id)["sha256"] and manifest["dedup"]["stats"]["sft"]["kept"] == total
        assert json.loads((tmp_path / "b" / "manifest.json").read_text(encoding="utf-8"))["schema"] == "dabook.export.v1"

    def test_heuristic_records_are_excluded_unless_asked_for(self, tmp_path: Path, tech_pdf: Path) -> None:
        p = Pipeline(tmp_path / "ws", dataset={**TRAINING, "include_heuristic_sft": True}, assist={"provider": "fake:grounded", "min_section_words": 40})
        try:
            res = p.enqueue(tech_pdf)
            p.drain()
            set_license(p.con, str(res.book_id), "owned")
            default = export_training_bundle(p.con, p.ws, tmp_path / "a", book_refs=[str(res.book_id)])
            assert default["excluded_heuristic_records"] > 0 and "heuristic" not in default["generators"]
            forced = export_training_bundle(p.con, p.ws, tmp_path / "b", book_refs=[str(res.book_id)], allow_heuristic=True)
            assert "heuristic" in forced["generators"]
        finally:
            p.close()

    def test_exporter_validates_its_arguments(self, assisted, tmp_path: Path) -> None:
        p, book_id = assisted
        set_license(p.con, str(book_id), "owned")
        with pytest.raises(GovernanceError, match="Invalid"):
            export_training_bundle(p.con, p.ws, tmp_path / "x", modes=["rag"])
        with pytest.raises(GovernanceError, match="Invalid"):
            export_training_bundle(p.con, p.ws, tmp_path / "x", formats=["csv"])

    def test_hf_export_layout(self, assisted, tmp_path: Path) -> None:
        pytest.importorskip("pyarrow")
        p, book_id = assisted
        set_license(p.con, str(book_id), "owned")
        manifest = export_training_bundle(p.con, p.ws, tmp_path / "hf", book_refs=[str(book_id)], formats=["hf"], dedup=DedupSettings(exact=True, near=False))
        assert "hf/sft/README.md" in manifest["files"] and (tmp_path / "hf" / "hf" / "sft" / "data").is_dir()


# --------------------------------------------------------------------------- review loop
class TestReviewLoop:
    def test_rejected_pairs_disappear_at_the_next_compile_without_re_running_assist(self, assisted) -> None:
        p, book_id = assisted
        book = p.book(book_id)
        before = p.dataset(book_id, "sft")
        victim = before[0]["pair_id"]
        assist_key = p.con.execute("SELECT stage_key FROM tasks WHERE book_id=? AND stage='s13_assist_sft'", (book_id,)).fetchone()["stage_key"]
        digest_before = edits_digest(p.ws, book["sha256"])

        record_edit(p.ws, book["sha256"], victim, "reject", "answer is wrong")
        assert edits_digest(p.ws, book["sha256"]) != digest_before
        counts = plan_book(p.con, book_id, book["sha256"], 8, p.ws, p.params, retry_failed=False)
        assert counts["pending"] == 1  # only s14_compile re-runs
        assert p.con.execute("SELECT stage_key FROM tasks WHERE book_id=? AND stage='s13_assist_sft'", (book_id,)).fetchone()["stage_key"] == assist_key
        p.drain()

        after = p.dataset(book_id, "sft")
        assert victim not in {r["pair_id"] for r in after} and len(after) == len(before) - 1
        assert rejected_pair_ids(p.ws, book["sha256"]) == {victim}

    def test_the_latest_decision_wins_and_torn_lines_are_ignored(self, assisted) -> None:
        p, book_id = assisted
        sha = p.book(book_id)["sha256"]
        record_edit(p.ws, sha, "pair1", "reject")
        record_edit(p.ws, sha, "pair1", "accept")
        record_edit(p.ws, sha, "pair2", "reject", "bad")
        path = p.ws / "books" / sha[:12] / "edits.jsonl"
        path.write_text(path.read_text(encoding="utf-8") + '{"pair_id": "pair3", "act', encoding="utf-8")  # crash mid-write
        edits = read_edits(p.ws, sha)
        assert edits["pair1"]["action"] == "accept" and edits["pair2"]["reason"] == "bad" and "pair3" not in edits
        assert rejected_pair_ids(p.ws, sha) == {"pair2"}
        with pytest.raises(GovernanceError):
            record_edit(p.ws, sha, "x", "maybe")

    def test_no_decisions_means_a_stable_digest(self, assisted) -> None:
        p, book_id = assisted
        assert edits_digest(p.ws, p.book(book_id)["sha256"]) == "none"


def test_config_enables_the_llm_lane_only_with_a_provider() -> None:
    assert DabookConfig().assist.enabled is False
    assert DabookConfig.model_validate({"assist": {"provider": "ollama:x"}}).assist.enabled is True
