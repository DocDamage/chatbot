"""
S13: compile the cleaned Book Graph into dataset files.

The builders are pure functions over node dicts so they can be unit tested without a PDF.
Only the modes listed in ``dataset.modes`` are written; files for other modes are removed so a
changed mode list never leaves stale data behind for the workspace consolidator to pick up.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import time
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from typing import Any

import dabook
from dabook.core.atomic import write_json
from dabook.core.datasets import (
    DedupSettings,
    consolidate_workspace_datasets,
    count_tokens,
    detect_code_language,
    is_boilerplate_node,
    is_valid_code_block,
    tokenizer_backend,
)
from dabook.core.dedup import dedup_records
from dabook.core.formats import read_jsonl, write_hf_layout, write_jsonl, write_parquet
from dabook.core.governance import rejected_pair_ids
from dabook.core.ids import chunk_id, make_book_slug
from dabook.core.splits import group_key, split_records
from dabook.stages.common import book_license_status, read_live_dataset_settings
from dabook.stages.registry import StageContext, stage

logger = logging.getLogger("dabook.stages.compile")

DATASET_FILES = {
    "raw": "raw.jsonl",
    "pretrain": "pretrain.jsonl",
    "sft": "sft.jsonl",
    "code": "code.jsonl",
    "rag": "rag.jsonl",
}

# Nodes that are navigation or page furniture, never training or retrieval content.
_NON_CONTENT_TYPES = ("toc", "furniture", "book")
_FRONT_MATTER_TERMS = ("author", "credit", "editor", "acknowledg", "contents at a glance")
_FIGURE_PREFIXES = ("figure", "table", "listing", "chart", "diagram", "note", "warning")

TokenCounter = Callable[[str], int]


def _fence(language: str, code: str) -> str:
    return f"```{language}\n{code}\n```"


def _code_language(node: dict[str, Any]) -> str:
    lang = (node.get("metadata") or {}).get("language")
    return lang if lang and lang != "text" else detect_code_language(node["text"])


# ---------------------------------------------------------------------------
# RAG chunking
# ---------------------------------------------------------------------------
def _split_to_max(text: str, max_tokens: int, count: TokenCounter, *, by_line: bool) -> list[str]:
    """Split *text* into pieces of at most ``max_tokens``; code splits on lines, prose on sentences."""
    if count(text) <= max_tokens:
        return [text]
    units = text.splitlines() if by_line else re.split(r"(?<=[.!?])\s+", text)
    joiner = "\n" if by_line else " "
    pieces: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf
        if buf:
            pieces.append(joiner.join(buf))
            buf = []

    for unit in units:
        if count(unit) > max_tokens:  # one unbroken run: fall back to word slices
            flush()
            words = unit.split()
            step = max(1, int(max_tokens / 1.5))
            pieces.extend(" ".join(words[i : i + step]) for i in range(0, len(words), step))
            continue
        # Re-count the joined text: token counts are not additive across rounding/merges.
        if buf and count(joiner.join([*buf, unit])) > max_tokens:
            flush()
        buf.append(unit)
    flush()
    return pieces


def build_rag_chunks(
    nodes: list[dict[str, Any]],
    *,
    book_sha256: str,
    book_title: str,
    quality: float | None,
    target_tokens: int,
    max_tokens: int,
    tokenizer: str = "cl100k_base",
) -> list[dict[str, Any]]:
    """
    Structure-aware chunks. A chunk never crosses a heading, grows to ``target_tokens`` and is
    capped at ``max_tokens``. ``chunk_id`` is content-addressed, so re-ingesting the same PDF
    yields identical ids and downstream stores can update in place.
    """

    def count(text: str) -> int:
        return count_tokens(text, tokenizer)

    slug = make_book_slug(book_title, book_sha256)
    chunks: list[dict[str, Any]] = []
    cur: list[dict[str, Any]] = []
    cur_tokens = 0
    crumbs: list[str] = []
    chapter_no = 0
    section_no = 0

    def flush() -> None:
        nonlocal cur, cur_tokens
        if not cur:
            return
        content = "\n\n".join(p["text"] for p in cur)
        has_code = any(p["type"] == "code" for p in cur)
        if len(content.split()) < 5 and not has_code:
            cur, cur_tokens = [], 0
            return
        record = {
            "chapter": chapter_no,
            "section": section_no,
            "page_start": min(p["page"] for p in cur),
            "page_end": max(p["page"] for p in cur),
            "breadcrumbs": list(crumbs),
            "node_ids": list(dict.fromkeys(p["node_id"] for p in cur)),
            "node_types": sorted({p["type"] for p in cur}),
            "has_code": has_code,
            "content": content,
            "tokens": cur_tokens,
        }
        # Fold a tiny tail into the previous chunk of the same section instead of orphaning it.
        prev = chunks[-1] if chunks else None
        if (
            prev is not None
            and record["tokens"] < 40
            and (prev["chapter"], prev["section"]) == (chapter_no, section_no)
            and count(prev["content"] + "\n\n" + content) <= max_tokens
        ):
            prev["content"] += "\n\n" + content
            prev["tokens"] = count(prev["content"])
            prev["page_end"] = max(prev["page_end"], record["page_end"])
            prev["node_ids"] = list(dict.fromkeys(prev["node_ids"] + record["node_ids"]))
            prev["node_types"] = sorted(set(prev["node_types"]) | set(record["node_types"]))
            prev["has_code"] = prev["has_code"] or has_code
        else:
            chunks.append(record)
        cur, cur_tokens = [], 0

    for n in nodes:
        ntype = n["node_type"]
        if ntype in _NON_CONTENT_TYPES:
            continue
        if ntype in ("chapter", "section"):
            flush()
            if ntype == "chapter":
                chapter_no += 1
                section_no = 0
            else:
                section_no += 1
            crumbs = [*n.get("breadcrumbs", []), n.get("title") or n["text"].strip()]
            continue

        text = n["text"].strip()
        if not text:
            continue
        is_code = ntype == "code"
        lang = _code_language(n) if is_code else ""
        for piece in _split_to_max(text, max_tokens, count, by_line=is_code):
            rendered = _fence(lang, piece) if is_code else piece
            if cur and count("\n\n".join([*(p["text"] for p in cur), rendered])) > max_tokens:
                flush()
            if not cur:
                crumbs = list(n.get("breadcrumbs") or crumbs)
            cur.append(
                {
                    "text": rendered,
                    "type": ntype,
                    "node_id": n["node_id"],
                    "page": n.get("page_idx", 0) + 1,
                }
            )
            cur_tokens = count("\n\n".join(p["text"] for p in cur))
            if cur_tokens >= target_tokens:
                flush()
    flush()

    records: list[dict[str, Any]] = []
    for seq, c in enumerate(chunks):
        records.append(
            {
                "chunk_id": chunk_id(slug, c["chapter"], c["section"], seq, c["content"]),
                "book_sha256": book_sha256,
                "book_title": book_title,
                "page": c["page_start"],
                "page_start": c["page_start"],
                "page_end": c["page_end"],
                "breadcrumbs": c["breadcrumbs"],
                "node_ids": c["node_ids"],
                "node_types": c["node_types"],
                "has_code": c["has_code"],
                "token_count": c["tokens"],
                "quality": quality,
                "content": c["content"],
            }
        )
    return records


# ---------------------------------------------------------------------------
# Pretrain / code / SFT / raw
# ---------------------------------------------------------------------------
def build_pretrain(
    nodes: list[dict[str, Any]],
    *,
    book_title: str,
    total_pages: int,
    filter_front_matter: bool,
    tokenizer: str,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    state = {"title": book_title, "lines": [], "start": 1, "end": 1, "idx": 0}

    def flush() -> None:
        lines: list[str] = state["lines"]
        if not lines:
            return
        doc_text = "\n\n".join(lines).strip()
        words = len(doc_text.split())
        front = filter_front_matter and state["start"] < 25
        if front and any(t in state["title"].lower() for t in _FRONT_MATTER_TERMS):
            state["lines"] = []
            return
        if words >= 40:
            records.append(
                {
                    "doc_id": f"doc_{state['idx']:03d}",
                    "book_title": book_title,
                    "chapter_title": state["title"],
                    "page_start": state["start"],
                    "page_end": state["end"],
                    "word_count": words,
                    "char_count": len(doc_text),
                    "token_count": count_tokens(doc_text, tokenizer),
                    "text": doc_text,
                }
            )
            state["idx"] += 1
        state["lines"] = []

    for n in nodes:
        ntype = n.get("node_type")
        text = n.get("text", "").strip()
        page = n.get("page_idx", 0) + 1
        if not text or ntype in _NON_CONTENT_TYPES:
            continue
        if ntype == "chapter":
            flush()
            state["title"] = n.get("title") or text.splitlines()[0]
            state["start"] = state["end"] = page
            state["lines"].append(f"# {state['title']}")
        elif ntype == "section":
            title = n.get("title") or text.splitlines()[0]
            depth = len(n.get("breadcrumbs", []))
            state["lines"].append(f"{'###' if depth > 2 else '##'} {title}")
            state["end"] = max(state["end"], page)
        elif ntype == "code":
            state["lines"].append(_fence(_code_language(n), text))
            state["end"] = max(state["end"], page)
        else:
            state["lines"].append(text)
            state["end"] = max(state["end"], page)
    flush()

    if not records and nodes:
        body = [
            _fence(_code_language(n), n["text"].strip())
            if n.get("node_type") == "code"
            else n["text"].strip()
            for n in nodes
            if n.get("text", "").strip() and n.get("node_type") not in _NON_CONTENT_TYPES
        ]
        if body:
            text = "\n\n".join(body)
            records.append(
                {
                    "doc_id": "doc_000",
                    "book_title": book_title,
                    "chapter_title": book_title,
                    "page_start": 1,
                    "page_end": total_pages,
                    "word_count": len(text.split()),
                    "char_count": len(text),
                    "token_count": count_tokens(text, tokenizer),
                    "text": text,
                }
            )
    return records


def build_code(
    nodes: list[dict[str, Any]], *, book_sha256: str
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for i, n in enumerate(nodes):
        if n.get("node_type") != "code":
            continue
        code_text = n.get("text", "").strip()
        if not is_valid_code_block(code_text):
            continue
        ctx_parts = [
            nodes[j]["text"].strip()
            for j in (i - 1, i + 1)
            if 0 <= j < len(nodes)
            and nodes[j].get("node_type") not in _NON_CONTENT_TYPES
            and nodes[j].get("text", "").strip()
        ]
        records.append(
            {
                "code_id": f"code_{len(records) + 1:04d}",
                "book_sha256": book_sha256,
                "node_id": n["node_id"],
                "page": n.get("page_idx", 0) + 1,
                "language": _code_language(n),
                "breadcrumbs": n.get("breadcrumbs", []),
                "surrounding_context": "\n\n".join(ctx_parts),
                "code": code_text,
                "line_count": len(code_text.splitlines()),
            }
        )
    return records


def build_sft_heuristic(
    nodes: list[dict[str, Any]],
    *,
    book_sha256: str,
    sft_format: str,
    system_prompt: str,
) -> list[dict[str, Any]]:
    """
    Template-based pairs. These are *not* LLM-grounded Q&A: every concept pair uses the same
    question shape, so treat them as a scaffold. Records say ``generator: heuristic`` so
    downstream governance can exclude them.
    """
    records: list[dict[str, Any]] = []

    def add(instruction: str, input_text: str, output: str, category: str, page: int, node_id: str, crumbs: list[str]) -> None:
        out = output.strip()
        if len(out.split()) < 15:
            return
        rec: dict[str, Any] = {
            "id": f"sft_{len(records) + 1:04d}",
            "category": category,
            "generator": "heuristic",
            "book_sha256": book_sha256,
            "source_node_ids": [node_id],
            "source_page": page,
            "breadcrumbs": crumbs,
        }
        if sft_format in ("alpaca", "both"):
            rec.update({"instruction": instruction, "input": input_text, "output": out})
        if sft_format in ("chatml", "both"):
            user = f"{instruction}\n\n{input_text}".strip() if input_text else instruction
            rec["messages"] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user},
                {"role": "assistant", "content": out},
            ]
        records.append(rec)

    for i, n in enumerate(nodes):
        ntype = n.get("node_type")
        text = n.get("text", "").strip()
        crumbs = n.get("breadcrumbs", [])
        page = n.get("page_idx", 0) + 1

        if ntype == "section" and n.get("title"):
            title = n["title"].strip()
            low = title.lower()
            valid = (
                bool(re.search(r"[a-zA-Z]", title))
                and not low.startswith(_FIGURE_PREFIXES)
                and len(title.split()) <= 8
                and len(title) <= 60
                and not (page < 29 and any(t in low for t in _FRONT_MATTER_TERMS))
            )
            if not valid:
                continue
            prose: list[str] = []
            for nxt in nodes[i + 1 : i + 8]:
                if nxt.get("node_type") in ("chapter", "section"):
                    break
                if nxt.get("node_type") in _NON_CONTENT_TYPES:
                    continue
                if nxt.get("node_type") == "code":
                    prose.append(_fence(_code_language(nxt), nxt["text"]))
                elif nxt.get("text", "").strip():
                    prose.append(nxt["text"].strip())
            explanation = "\n\n".join(prose)
            if len(explanation.split()) >= 30:
                where = f" in {crumbs[-1]}" if crumbs else ""
                add(f"Explain {title}{where} in detail.", "", explanation, "concept_qa", page, n["node_id"], crumbs)

        elif ntype == "code" and is_valid_code_block(text):
            ctx_prose = [
                nodes[j]["text"].strip()
                for j in (i - 1, i + 1)
                if 0 <= j < len(nodes)
                and nodes[j].get("node_type") not in ("chapter", "section", "code", *_NON_CONTENT_TYPES)
            ]
            explanation = "\n\n".join(p for p in ctx_prose if p)
            if len(explanation.split()) >= 15:
                lang = _code_language(n)
                add(
                    "Explain what the following code or command does:",
                    _fence(lang, text),
                    explanation,
                    "code_walkthrough",
                    page,
                    n["node_id"],
                    crumbs,
                )
        # Exercise/question lists are deliberately not turned into pairs: the book gives no
        # answer, and echoing the question as its own "solution" teaches nothing.
    return records


def build_raw(nodes: list[dict[str, Any]], *, book_sha256: str) -> list[dict[str, Any]]:
    return [
        {
            "id": n["node_id"],
            "book_sha256": book_sha256,
            "page": n["page_idx"] + 1,
            "type": n["node_type"],
            "text": n["text"],
            "breadcrumbs": n.get("breadcrumbs", []),
        }
        for n in nodes
        if n["node_type"] != "book" and n["text"].strip()
    ]


# ---------------------------------------------------------------------------
# Provenance, dedup, splits
# ---------------------------------------------------------------------------
TRAINING_MODES = ("sft", "pretrain", "code")


def stamp(
    record: dict[str, Any],
    *,
    book_sha256: str,
    license_status: str,
    node_ids: list[str] | None,
    pages: list[int] | None,
    generator: str,
    dabook_version: str,
) -> dict[str, Any]:
    """Per-record provenance, so any training record can be traced to its book, pages and origin."""
    record.update(
        {
            "book_sha256": book_sha256,
            "license_status": license_status,
            "source_node_ids": node_ids if node_ids is not None else record.get("source_node_ids", []),
            "pages": pages if pages is not None else record.get("pages", []),
            "generator": generator,
            "dabook_version": dabook_version,
        }
    )
    return record


def expand_assisted_pair(pair: dict[str, Any], *, sft_format: str, system_prompt: str) -> dict[str, Any]:
    """Canonical assisted pair -> exportable record (Alpaca and/or ChatML per ``sft_format``)."""
    rec: dict[str, Any] = {
        "id": f"sft_{pair['pair_id']}",
        "pair_id": pair["pair_id"],
        "category": pair["category"],
        "breadcrumbs": pair.get("breadcrumbs", []),
        "evidence": pair.get("evidence"),
        "grounding": pair.get("grounding"),
    }
    instruction, input_text, output = pair["instruction"], pair.get("input", ""), pair["output"]
    if sft_format in ("alpaca", "both"):
        rec.update({"instruction": instruction, "input": input_text, "output": output})
    if sft_format in ("chatml", "both"):
        user = f"{instruction}\n\n{input_text}".strip() if input_text else instruction
        rec["messages"] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user},
            {"role": "assistant", "content": output},
        ]
    return rec


def sft_text(record: dict[str, Any]) -> str:
    if "instruction" in record:
        return f"{record['instruction']} {record.get('input', '')} {record['output']}"
    return " ".join(m["content"] for m in record.get("messages", []) if m["role"] != "system")


TEXT_OF: dict[str, Callable[[dict[str, Any]], str]] = {
    "sft": sft_text,
    "pretrain": lambda r: r["text"],
    "code": lambda r: r["code"],
    "rag": lambda r: r["content"],
}

SPLIT_GROUP_FIELDS: dict[str, Callable[[dict[str, Any]], list[str]]] = {
    "sft": lambda r: r.get("breadcrumbs", []),
    "pretrain": lambda r: [r.get("chapter_title") or ""],
    "code": lambda r: r.get("breadcrumbs", []),
}


def dedup_mode(mode: str, records: list[dict[str, Any]], ctx: StageContext) -> tuple[list[dict[str, Any]], dict[str, int]]:
    exact, near = bool(ctx.param("dedup_exact", True)), bool(ctx.param("dedup_near", True))
    if mode not in TEXT_OF or not (exact or near):
        return records, {"input": len(records), "exact_removed": 0, "near_removed": 0, "kept": len(records)}
    kept, stats = dedup_records(
        records, TEXT_OF[mode], exact=exact, near=near, jaccard_threshold=float(ctx.param("dedup_jaccard", 0.8))
    )
    return kept, stats.as_dict()


def _rel(path: Path, workspace: Path) -> str:
    return path.relative_to(workspace).as_posix()


# ---------------------------------------------------------------------------
# The stage
# ---------------------------------------------------------------------------
@stage("s14_compile", "0.3.0")
def stage_s14_compile(ctx: StageContext) -> None:
    nodes = ctx.read_json("s12_semantic", "semantic_graph.json")["nodes"]
    inspection = ctx.read_json("s01_inspect", "inspection.json")
    validation = ctx.read_json("s11_validate", "validation.json")
    assist_dir = ctx.input_dir("s13_assist_sft")
    assist_pairs = read_jsonl(assist_dir / "assist_sft.jsonl")
    assist_stats = json.loads((assist_dir / "stats.json").read_text(encoding="utf-8"))

    modes = list(ctx.param("modes", ["raw", "rag"]))
    formats = list(ctx.param("formats", ["jsonl"]))
    tokenizer = ctx.param("tokenizer", "cl100k_base")
    workspace = ctx.work_dir.parent.parent
    live = read_live_dataset_settings(workspace)

    source = json.loads((ctx.work_dir / "source.json").read_text(encoding="utf-8"))
    book_sha = source["sha256"]
    book_title = inspection.get("title") or Path(source.get("original_path") or "book").stem
    total_pages = inspection["page_count"]
    quality = validation.get("quality_score")
    license_status = book_license_status(workspace, book_sha)
    version = dabook.__version__
    provenance = {"book_sha256": book_sha, "license_status": license_status, "dabook_version": version}

    content_nodes = [n for n in nodes if n["node_type"] not in _NON_CONTENT_TYPES]
    train_nodes = (
        [n for n in content_nodes if not is_boilerplate_node(n, n.get("page_idx", 0), total_pages)]
        if live.filter_boilerplate
        else content_nodes
    )

    datasets_dir = ctx.work_dir / "datasets"
    datasets_dir.mkdir(parents=True, exist_ok=True)
    ctx.progress(0, "Compiling datasets…")

    built: dict[str, list[dict[str, Any]]] = {}
    dedup_stats: dict[str, dict[str, int]] = {}
    warnings: list[str] = []
    heuristic: list[dict[str, Any]] = []

    if "raw" in modes:
        built["raw"] = build_raw(nodes, book_sha256=book_sha)
    if "pretrain" in modes:
        docs = build_pretrain(
            train_nodes, book_title=book_title, total_pages=total_pages,
            filter_front_matter=live.filter_boilerplate, tokenizer=tokenizer,
        )
        built["pretrain"] = [
            stamp(d, **provenance, node_ids=[], pages=[d["page_start"], d["page_end"]], generator="extraction")
            for d in docs
        ]
    if "code" in modes:
        built["code"] = [
            stamp(c, **provenance, node_ids=[c["node_id"]], pages=[c["page"], c["page"]], generator="extraction")
            for c in build_code(content_nodes, book_sha256=book_sha)
        ]
    if "rag" in modes:
        built["rag"] = [
            stamp(c, **provenance, node_ids=c["node_ids"], pages=[c["page_start"], c["page_end"]], generator="extraction")
            for c in build_rag_chunks(
                train_nodes, book_sha256=book_sha, book_title=book_title, quality=quality,
                target_tokens=int(ctx.param("chunk_target_tokens", 400)),
                max_tokens=int(ctx.param("chunk_max_tokens", 800)), tokenizer=tokenizer,
            )
        ]
    rejected = rejected_pair_ids(workspace, book_sha)
    if "sft" in modes:
        system_prompt = ctx.param("sft_system_prompt", "")
        accepted = [p for p in assist_pairs if p["pair_id"] not in rejected]
        sft = [
            stamp(
                expand_assisted_pair(p, sft_format=live.sft_format, system_prompt=system_prompt),
                **provenance, node_ids=p["source_node_ids"], pages=p["pages"], generator=p["generator"],
            )
            for p in accepted
        ]
        heuristic = build_sft_heuristic(
            train_nodes, book_sha256=book_sha, sft_format=live.sft_format, system_prompt=system_prompt
        )
        for h in heuristic:
            stamp(h, **provenance, node_ids=None, pages=[h["source_page"], h["source_page"]], generator="heuristic")
        if ctx.param("include_heuristic_sft", False):
            sft += heuristic
        elif not accepted:
            warnings.append(
                "sft: no assisted pairs"
                + (" (assist.provider is none)" if assist_stats.get("provider") == "none" else "")
                + f"; {len(heuristic)} template pairs were written to sft_heuristic.jsonl and are not exported"
            )
        built["sft"] = sft

    for mode in list(built):
        built[mode], dedup_stats[mode] = dedup_mode(mode, built[mode], ctx)

    # ---- write: files for requested modes only; everything derived is rebuilt from scratch
    for sub in ("splits", "parquet", "hf"):
        shutil.rmtree(datasets_dir / sub, ignore_errors=True)
    files: dict[str, dict[str, Any]] = {}
    for mode, filename in DATASET_FILES.items():
        path = datasets_dir / filename
        if mode in built:
            write_jsonl(path, built[mode])
            files[mode] = {"path": _rel(path, workspace), "records": len(built[mode])}
        else:
            path.unlink(missing_ok=True)
    heur_path = datasets_dir / "sft_heuristic.jsonl"
    if "sft" in modes:
        write_jsonl(heur_path, heuristic)
    else:
        heur_path.unlink(missing_ok=True)

    split_cfg = (ctx.param("split_by"), ctx.param("split_ratios"), ctx.param("split_seed"))
    splits: dict[str, dict[str, list[dict[str, Any]]]] = {}
    split_files: dict[str, dict[str, dict[str, Any]]] = {}
    if all(v is not None for v in split_cfg):
        by, ratios, seed = split_cfg
        for mode in TRAINING_MODES:
            if mode not in built:
                continue
            parts = split_records(
                built[mode],
                lambda r, m=mode: group_key(by, book_sha, SPLIT_GROUP_FIELDS[m](r)),
                ratios=ratios, seed=int(seed),
            )
            splits[mode] = {s: [{**r, "split": s} for r in rows] for s, rows in parts.items()}
            split_files[mode] = {}
            for split, rows in splits[mode].items():
                if rows:
                    path = datasets_dir / "splits" / split / f"{DATASET_FILES[mode]}"
                    write_jsonl(path, rows)
                    split_files[mode][split] = {"path": _rel(path, workspace), "records": len(rows)}

    parquet_files: dict[str, str] = {}
    hf_dirs: dict[str, str] = {}
    if "parquet" in formats:
        for mode, rows in built.items():
            if write_parquet(datasets_dir / "parquet" / f"{mode}.parquet", rows):
                parquet_files[mode] = _rel(datasets_dir / "parquet" / f"{mode}.parquet", workspace)
        for mode, parts in splits.items():
            for split, rows in parts.items():
                if write_parquet(datasets_dir / "parquet" / "splits" / split / f"{mode}.parquet", rows):
                    parquet_files[f"{mode}/{split}"] = _rel(datasets_dir / "parquet" / "splits" / split / f"{mode}.parquet", workspace)
    generators = dict(Counter(r.get("generator", "unknown") for m in TRAINING_MODES for r in built.get(m, [])))
    notes = {
        "books": [{"title": book_title, "sha256": book_sha, "license_status": license_status, "quality_score": quality}],
        "generators": generators,
        "dedup": dedup_stats,
    }
    if "hf" in formats:
        for mode in TRAINING_MODES:
            if mode not in built:
                continue
            parts = splits.get(mode) or {"train": built[mode], "val": [], "test": []}
            write_hf_layout(datasets_dir / "hf" / mode, f"{book_title} ({mode})", parts, notes)
            hf_dirs[mode] = _rel(datasets_dir / "hf" / mode, workspace)

    summary = {
        "compiled_at": time.time(),
        "dabook_version": version,
        "book_sha256": book_sha,
        "book_title": book_title,
        "license_status": license_status,
        "pages": total_pages,
        "quality_score": quality,
        "modes": modes,
        "formats": formats,
        "tokenizer": tokenizer_backend(tokenizer),
        "total_nodes": len(nodes),
        "training_nodes": len(train_nodes),
        "files": files,
        "splits": split_files,
        "parquet": parquet_files,
        "hf": hf_dirs,
        "dedup": dedup_stats,
        "generators": generators,
        "assist": assist_stats,
        "edits": {"rejected_pairs": len(rejected)},
        "heuristic_pairs": len(heuristic),
        "warnings": warnings,
        # Legacy count keys kept for the dashboard
        "raw_lines": len(built.get("raw", [])),
        "pretrain_docs": len(built.get("pretrain", [])),
        "sft_pairs": len(built.get("sft", [])),
        "code_blocks": len(built.get("code", [])),
        "rag_chunks": len(built.get("rag", [])),
    }
    write_json(ctx.out_dir / "summary.json", summary)
    write_json(datasets_dir / "manifest.json", summary)

    if live.merge_all:
        try:
            consolidate_workspace_datasets(
                workspace,
                dedup=DedupSettings(
                    exact=bool(ctx.param("dedup_exact", True)),
                    near=bool(ctx.param("dedup_near", True)),
                    jaccard=float(ctx.param("dedup_jaccard", 0.8)),
                ),
            )
        except Exception as exc:  # consolidation is a convenience, never a reason to fail a book
            logger.warning("Auto-consolidation warning: %s", exc)

    ctx.progress(1, "Datasets compiled: " + ", ".join(f"{len(v)} {k}" for k, v in built.items()))
