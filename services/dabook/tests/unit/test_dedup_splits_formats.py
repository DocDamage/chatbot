"""Phase 4A: dedup, deterministic splits, Parquet/HF round-trips."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from dabook.core.dedup import Deduplicator, dedup_records, exact_key, jaccard, normalize, shingles
from dabook.core.formats import read_jsonl, read_parquet, write_hf_layout, write_jsonl, write_parquet
from dabook.core.splits import FRONT_MATTER_GROUP, SPLIT_NAMES, assign_split, group_key, split_records

PARA = (
    "The recovery tool scans the partition table and rebuilds the boot sector from a backup copy "
    "so that the operating system can mount the volume again without losing any files"
)


def words(seed: int, n: int = 40) -> str:
    return " ".join(f"w{seed}x{i}" for i in range(n))


# --------------------------------------------------------------------------- dedup
class TestDedup:
    def test_normalization_ignores_case_punctuation_and_spacing(self) -> None:
        assert normalize("Hello,   WORLD!\n") == "hello world"
        assert exact_key("Hello, World") == exact_key("hello   world!")

    def test_exact_duplicates_are_removed_keeping_the_first(self) -> None:
        recs = [{"id": 1, "t": PARA}, {"id": 2, "t": PARA.upper()}, {"id": 3, "t": words(1)}]
        kept, stats = dedup_records(recs, lambda r: r["t"], near=False)
        assert [r["id"] for r in kept] == [1, 3]
        assert (stats.input, stats.exact_removed, stats.near_removed, stats.kept) == (3, 1, 0, 2)

    def test_near_duplicates_are_removed_but_distinct_text_is_kept(self) -> None:
        long_text = " ".join(
            f"{PARA} Section {i} adds detail number {i} about drive geometry and sector alignment."
            for i in range(4)
        )
        near = long_text.replace("backup copy", "backup replica", 1)  # a single edited word
        other = " ".join(words(9, 60) for _ in range(1))
        kept, stats = dedup_records([long_text, near, other], lambda t: t, jaccard_threshold=0.8)
        assert kept == [long_text, other]
        assert stats.near_removed == 1 and stats.exact_removed == 0

    def test_one_word_change_in_a_short_paragraph_is_below_the_default_threshold(self) -> None:
        """5-word shingles make short passages sensitive; that strictness is deliberate."""
        near = PARA.replace("backup copy", "backup replica")
        sim = jaccard(shingles(normalize(PARA)), shingles(normalize(near)))
        assert 0.5 < sim < 0.8
        assert len(dedup_records([PARA, near], lambda t: t, jaccard_threshold=0.8)[0]) == 2
        assert len(dedup_records([PARA, near], lambda t: t, jaccard_threshold=0.6)[0]) == 1

    def test_short_records_only_get_exact_dedup(self) -> None:
        kept, stats = dedup_records(["tiny text here", "tiny text there", "Tiny text here"], lambda t: t)
        assert kept == ["tiny text here", "tiny text there"]
        assert stats.exact_removed == 1 and stats.near_removed == 0

    def test_flags_can_disable_each_mode(self) -> None:
        near = PARA.replace("backup copy", "backup replica")
        same = dedup_records([PARA, PARA, near], lambda t: t, exact=False, near=False)[0]
        assert len(same) == 3
        assert len(dedup_records([PARA, PARA, near], lambda t: t, exact=True, near=False)[0]) == 2
        assert len(dedup_records([PARA, PARA], lambda t: t, exact=False, near=True)[0]) == 1  # near catches it

    def test_is_deterministic_and_order_preserving(self) -> None:
        recs = [words(i % 7) + f" tail{i % 3}" for i in range(60)]
        a, _ = dedup_records(recs, lambda t: t)
        b, _ = dedup_records(list(recs), lambda t: t)
        assert a == b
        assert a == sorted(a, key=recs.index)  # kept items appear in input order

    def test_a_shared_deduplicator_works_across_batches(self) -> None:
        dd = Deduplicator()
        first, s1 = dedup_records([PARA, words(3)], lambda t: t, deduplicator=dd)
        second, s2 = dedup_records([PARA, words(4)], lambda t: t, deduplicator=dd)
        assert len(first) == 2 and second == [words(4)]
        assert (s1.kept, s2.exact_removed, s2.kept) == (2, 1, 1)
        assert s1.merge(s2).input == 4

    def test_empty_text_is_never_collapsed(self) -> None:
        kept, _ = dedup_records(["", "   ", "..."], lambda t: t)
        assert len(kept) == 3

    def test_very_long_documents_stay_bounded(self) -> None:
        long_text = " ".join(f"token{i}" for i in range(20_000))
        assert len(shingles(normalize(long_text))) <= 2000
        kept, stats = dedup_records([long_text, long_text + " extra"], lambda t: t)
        assert stats.near_removed + stats.exact_removed == 1 and len(kept) == 1


# --------------------------------------------------------------------------- splits
class TestSplits:
    RATIOS = [0.9, 0.05, 0.05]

    def test_assignment_is_deterministic_and_seed_dependent(self) -> None:
        groups = [f"book|chapter {i}" for i in range(200)]
        a = [assign_split(g, 42, self.RATIOS) for g in groups]
        assert a == [assign_split(g, 42, self.RATIOS) for g in groups]
        assert a != [assign_split(g, 43, self.RATIOS) for g in groups]

    def test_proportions_follow_the_ratios(self) -> None:
        counts = {n: 0 for n in SPLIT_NAMES}
        for i in range(5000):
            counts[assign_split(f"g{i}", 7, self.RATIOS)] += 1
        assert 0.86 < counts["train"] / 5000 < 0.94
        assert 0.02 < counts["val"] / 5000 < 0.08 and 0.02 < counts["test"] / 5000 < 0.08

    def test_no_chapter_leaks_across_splits(self) -> None:
        records = [
            {"id": f"{c}-{i}", "breadcrumbs": [f"Chapter {c}", f"Sec {i % 3}"]}
            for c in range(60)
            for i in range(9)
        ]
        parts = split_records(
            records, lambda r: group_key("chapter", "abc", r["breadcrumbs"]), ratios=self.RATIOS, seed=42
        )
        home: dict[str, str] = {}
        for split, rows in parts.items():
            for r in rows:
                chapter = r["breadcrumbs"][0]
                assert home.setdefault(chapter, split) == split, f"{chapter} leaked across splits"
        assert sum(len(v) for v in parts.values()) == len(records)
        assert all(parts[n] for n in SPLIT_NAMES)  # with 60 chapters every split is populated

    def test_section_grouping_is_finer_than_chapter_grouping(self) -> None:
        assert group_key("chapter", "b", ["Ch 1", "Sec 2"]) == "b|Ch 1"
        assert group_key("section", "b", ["Ch 1", "Sec 2"]) == "b|Ch 1 > Sec 2"
        assert group_key("book", "b", ["Ch 1"]) == "b|*"
        assert group_key("chapter", "b", []) == f"b|{FRONT_MATTER_GROUP}"

    def test_adding_a_book_never_moves_another_books_groups(self) -> None:
        before = assign_split(group_key("chapter", "book-a", ["Ch 1"]), 42, self.RATIOS)
        _ = assign_split(group_key("chapter", "book-b", ["Ch 1"]), 42, self.RATIOS)
        assert assign_split(group_key("chapter", "book-a", ["Ch 1"]), 42, self.RATIOS) == before

    def test_ratios_must_have_three_entries(self) -> None:
        with pytest.raises(ValueError, match="3 entries"):
            assign_split("g", 1, [0.5, 0.5])

    def test_a_single_split_ratio_sends_everything_there(self) -> None:
        assert {assign_split(f"g{i}", 1, [0.0, 1.0, 0.0]) for i in range(50)} == {"val"}
        assert {assign_split(f"g{i}", 1, [1.0, 0.0, 0.0]) for i in range(50)} == {"train"}


# --------------------------------------------------------------------------- formats
pa = pytest.importorskip("pyarrow")


class TestFormats:
    RECORDS = [
        {
            "id": f"sft_{i}",
            "instruction": f"Explain topic {i}",
            "output": f"Answer {i} " * 5,
            "pages": [i + 1, i + 2],
            "messages": [{"role": "user", "content": f"q{i}"}, {"role": "assistant", "content": f"a{i}"}],
            "grounding": {"overlap": 0.8 + i / 100, "code_ok": True},
            "source_node_ids": [f"p{i}_b0"],
            "generator": "assist:ollama:qwen",
        }
        for i in range(5)
    ]

    def test_jsonl_round_trip(self, tmp_path: Path) -> None:
        write_jsonl(tmp_path / "a" / "x.jsonl", self.RECORDS)
        assert read_jsonl(tmp_path / "a" / "x.jsonl") == self.RECORDS
        assert read_jsonl(tmp_path / "missing.jsonl") == []

    def test_parquet_round_trip_preserves_nested_structure(self, tmp_path: Path) -> None:
        assert write_parquet(tmp_path / "x.parquet", self.RECORDS)
        back = read_parquet(tmp_path / "x.parquet")
        assert [r["id"] for r in back] == [r["id"] for r in self.RECORDS]
        assert back[2]["messages"] == self.RECORDS[2]["messages"]
        assert back[3]["pages"] == [4, 5]
        assert back[1]["grounding"]["code_ok"] is True
        assert not list(tmp_path.glob(".*.tmp"))  # no temp file left behind

    def test_parquet_survives_records_with_missing_and_mixed_keys(self, tmp_path: Path) -> None:
        records = [{"id": 1, "instruction": "a"}, {"id": 2, "output": "b", "extra": {"k": 1}}]
        assert write_parquet(tmp_path / "x.parquet", records)
        back = read_parquet(tmp_path / "x.parquet")
        assert {r["id"] for r in back} == {1, 2}

    def test_parquet_falls_back_to_json_strings_for_unreconcilable_nested_values(self, tmp_path: Path) -> None:
        records = [{"id": 1, "meta": {"a": 1}}, {"id": 2, "meta": ["not", "a", "dict"]}]
        assert write_parquet(tmp_path / "x.parquet", records)
        assert json.loads(read_parquet(tmp_path / "x.parquet")[1]["meta"]) == ["not", "a", "dict"]

    def test_empty_input_writes_nothing(self, tmp_path: Path) -> None:
        assert write_parquet(tmp_path / "x.parquet", []) is False
        assert not (tmp_path / "x.parquet").exists()

    def test_hf_layout_has_a_card_and_per_split_parquet(self, tmp_path: Path) -> None:
        splits = {"train": self.RECORDS[:3], "val": self.RECORDS[3:4], "test": self.RECORDS[4:]}
        counts = write_hf_layout(
            tmp_path / "hf",
            "my-books sft",
            splits,
            {
                "books": [{"title": "Handbook", "license_status": "owned", "quality_score": 0.97}],
                "generators": {"assist:ollama:qwen": 5},
                "dedup": {"kept": 5},
            },
        )
        assert counts == {"train": 3, "val": 1, "test": 1}
        card = (tmp_path / "hf" / "README.md").read_text(encoding="utf-8")
        assert card.startswith("---\nconfigs:") and "split: validation" in card
        assert "path: data/train-*.parquet" in card and "Handbook (license: owned" in card
        assert "no chapter appears in more than one split" in card
        assert len(read_parquet(tmp_path / "hf" / "data" / "train-00000-of-00001.parquet")) == 3
        assert len(read_parquet(tmp_path / "hf" / "data" / "validation-00000-of-00001.parquet")) == 1

    def test_hf_card_omits_empty_splits(self, tmp_path: Path) -> None:
        write_hf_layout(tmp_path / "hf", "n", {"train": self.RECORDS, "val": [], "test": []}, {})
        card = (tmp_path / "hf" / "README.md").read_text(encoding="utf-8")
        assert "split: train" in card and "split: validation" not in card
        assert not (tmp_path / "hf" / "data" / "validation-00000-of-00001.parquet").exists()
