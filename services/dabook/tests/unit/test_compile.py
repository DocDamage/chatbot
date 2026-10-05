"""Pure dataset builders (S13): RAG chunking, pretrain, SFT, code."""

from __future__ import annotations

from typing import Any

from dabook.stages.compile import build_code, build_pretrain, build_rag_chunks, build_sft_heuristic

SHA = "ab" * 32


def node(nid: str, ntype: str, text: str, *, page: int = 0, crumbs=None, title=None, lang=None) -> dict[str, Any]:
    return {
        "node_id": nid,
        "node_type": ntype,
        "text": text,
        "title": title,
        "page_idx": page,
        "breadcrumbs": crumbs or [],
        "metadata": {"language": lang} if lang else {},
    }


def words(n: int, tag: str = "w") -> str:
    return " ".join(f"{tag}{i}" for i in range(n))


def chunks(nodes, **kw):
    defaults = dict(book_sha256=SHA, book_title="Book", quality=0.9, target_tokens=100, max_tokens=200)
    return build_rag_chunks(nodes, **{**defaults, **kw})


def test_chunks_never_cross_headings_and_carry_breadcrumbs() -> None:
    nodes = [
        node("c1", "chapter", "Chapter One", title="Chapter One"),
        node("p1", "paragraph", words(30), crumbs=["Chapter One"]),
        node("s1", "section", "Setup", title="Setup", crumbs=["Chapter One"]),
        node("p2", "paragraph", words(30, "z"), page=1, crumbs=["Chapter One", "Setup"]),
    ]
    out = chunks(nodes)
    assert [c["breadcrumbs"] for c in out] == [["Chapter One"], ["Chapter One", "Setup"]]
    assert out[1]["page_start"] == 2
    assert all(c["book_sha256"] == SHA and c["quality"] == 0.9 for c in out)


def test_chunk_size_respects_target_and_max() -> None:
    nodes = [node("c", "chapter", "C", title="C")] + [
        node(f"p{i}", "paragraph", words(40, f"p{i}_"), crumbs=["C"]) for i in range(12)
    ]
    out = chunks(nodes, target_tokens=100, max_tokens=150)
    assert len(out) > 2
    assert all(c["token_count"] <= 150 for c in out)


def test_oversized_paragraph_is_split_to_the_cap() -> None:
    sentence = "This is a sentence about disk recovery tools and their usage. "
    nodes = [node("c", "chapter", "C", title="C"), node("p", "paragraph", sentence * 80, crumbs=["C"])]
    out = chunks(nodes, target_tokens=100, max_tokens=150)
    assert len(out) > 1
    assert all(c["token_count"] <= 150 for c in out)
    assert "".join(c["content"] for c in out).count("recovery") == 80


def test_code_is_fenced_and_flagged() -> None:
    nodes = [
        node("c", "chapter", "C", title="C"),
        node("p", "paragraph", words(20), crumbs=["C"]),
        node("k", "code", "$ sudo testdisk /dev/sda", crumbs=["C"], lang="bash"),
    ]
    (chunk,) = chunks(nodes)
    assert chunk["has_code"] is True
    assert "```bash\n$ sudo testdisk /dev/sda\n```" in chunk["content"]
    assert chunk["node_types"] == ["code", "paragraph"]
    assert chunk["node_ids"] == ["p", "k"]


def test_toc_and_furniture_never_reach_rag() -> None:
    nodes = [
        node("c", "chapter", "C", title="C"),
        node("t", "toc", "Chapter 1 ........ 5 " * 5, crumbs=["C"]),
        node("f", "furniture", "running header text goes here ok", crumbs=["C"]),
        node("p", "paragraph", words(30), crumbs=["C"]),
    ]
    out = chunks(nodes)
    assert len(out) == 1
    assert "......" not in out[0]["content"] and "running header" not in out[0]["content"]


def test_chunk_ids_are_stable_and_content_addressed() -> None:
    nodes = [node("c", "chapter", "C", title="C"), node("p", "paragraph", words(30), crumbs=["C"])]
    a, b = chunks(nodes), chunks(nodes)
    assert [c["chunk_id"] for c in a] == [c["chunk_id"] for c in b]
    changed = [nodes[0], node("p", "paragraph", words(30, "q"), crumbs=["C"])]
    assert chunks(changed)[0]["chunk_id"] != a[0]["chunk_id"]


def test_tiny_tail_is_folded_into_the_previous_chunk() -> None:
    nodes = [
        node("c", "chapter", "C", title="C"),
        node("p1", "paragraph", words(90), crumbs=["C"]),
        node("p2", "paragraph", "Short closing note about the topic here.", crumbs=["C"]),
    ]
    out = chunks(nodes, target_tokens=100, max_tokens=300)
    assert len(out) == 1


def test_pretrain_builds_markdown_documents_and_skips_front_matter() -> None:
    nodes = [
        node("c1", "chapter", "About the Author", title="About the Author", page=2),
        node("a", "paragraph", words(60), page=2),
        node("c2", "chapter", "Real Content", title="Real Content", page=30),
        node("p", "paragraph", words(60), page=30),
        node("k", "code", "x = 1\ny = 2", page=30, lang="python"),
    ]
    docs = build_pretrain(nodes, book_title="B", total_pages=40, filter_front_matter=True, tokenizer="cl100k_base")
    assert [d["chapter_title"] for d in docs] == ["Real Content"]
    assert docs[0]["text"].startswith("# Real Content")
    assert "```python\nx = 1\ny = 2\n```" in docs[0]["text"]


def test_sft_uses_the_configured_system_prompt_and_is_marked_heuristic() -> None:
    nodes = [
        node("c", "chapter", "C", title="C"),
        node("s", "section", "Partition Tables", title="Partition Tables", crumbs=["C"]),
        node("p", "paragraph", words(50), crumbs=["C", "Partition Tables"]),
    ]
    recs = build_sft_heuristic(nodes, book_sha256=SHA, sft_format="chatml", system_prompt="CUSTOM PROMPT")
    assert len(recs) == 1
    assert recs[0]["generator"] == "heuristic"
    assert recs[0]["messages"][0] == {"role": "system", "content": "CUSTOM PROMPT"}
    assert "reverse engineering" not in str(recs)


def test_sft_no_longer_fabricates_exercise_answers() -> None:
    nodes = [
        node("e", "section", "Exercises", title="Exercises"),
        node("q", "paragraph", "1. Explain how a partition table is stored on disk and why.\n2. Describe the boot sector layout in detail please."),
    ]
    assert build_sft_heuristic(nodes, book_sha256=SHA, sft_format="both", system_prompt="s") == []


def test_code_dataset_includes_shell_blocks() -> None:
    nodes = [
        node("p0", "paragraph", words(20)),
        node("k", "code", "$ sudo testdisk /log /dev/sda1\n$ photorec --version", lang="bash"),
    ]
    (rec,) = build_code(nodes, book_sha256=SHA)
    assert rec["language"] == "bash" and rec["book_sha256"] == SHA
