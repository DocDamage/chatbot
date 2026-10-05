"""
Stage implementations S00-S12 (S13, dataset compilation, lives in ``stages/compile.py``).

Every stage is registered with :func:`dabook.stages.registry.stage`, which is the single source
of its implementation version. A stage reads its inputs only through ``StageContext``, which
resolves them by the *exact* committed key the planner assigned, so a re-run with different
parameters can never pick up another run's leftovers (defects D4, D5).
"""

from __future__ import annotations

import json
import logging
import re
import time
import unicodedata
from collections.abc import Callable
from pathlib import Path
from typing import Any

import ftfy

from dabook.backends.pdfium import PdfiumExtractor
from dabook.core.atomic import StageCommit, write_json
from dabook.core.codedetect import classify_code
from dabook.ir.models import BookNode, PageData
from dabook.stages.registry import (
    STAGE_IMPLS,
    MissingSourceError,
    StageContext,
    stage,
)

logger = logging.getLogger("dabook.stages")

PARAMS_FILE = "params.json"

# A page counts as "has a text layer" above this many characters.
TEXT_PAGE_MIN_CHARS = 25
SCANNED_BELOW = 0.30  # share of sampled pages with text under which a PDF is scanned
NATIVE_AT_LEAST = 0.80  # ... and at/above which it is fully born-digital (between = mixed)


def load_params(work_dir: Path) -> dict[str, Any]:
    """Per-book parameters written by the planner; defaults for hand-driven runs."""
    path = work_dir / PARAMS_FILE
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            logger.warning("Unreadable %s (%s); using defaults", path, exc)
    from dabook.config.models import DabookConfig

    return DabookConfig().to_params_dict()


def run_stage(
    task: dict[str, Any],
    work_dir: Path,
    pdf_path: Path,
    progress_fn: Callable[[int, str], None],
    should_abort: Callable[[], bool],
    upstream: dict[str, list[str]] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute the registered implementation of ``task['stage']`` and commit its output."""
    name = task["stage"]
    key = task["stage_key"]
    stage_dir = work_dir / "stages" / name
    if name not in STAGE_IMPLS:
        raise KeyError(f"No implementation registered for stage {name!r}")
    impl = STAGE_IMPLS[name]

    t0 = time.time()
    meta = {
        "stage": name,
        "task_id": task["id"],
        "shard_idx": task.get("shard_idx", 0),
        "impl_version": impl.version,
    }
    try:
        with StageCommit(stage_dir, key, meta) as out_dir:
            ctx = StageContext(
                task=task,
                work_dir=work_dir,
                out_dir=out_dir,
                pdf_path=pdf_path,
                upstream=upstream or {},
                params=params if params is not None else load_params(work_dir),
                progress=progress_fn,
                should_abort=should_abort,
            )
            impl.fn(ctx)
    except FileExistsError:
        # Another worker already committed this exact key: a cache hit.
        return {"output_path": str(stage_dir / key), "duration_ms": 0, "cache_hit": True}

    return {
        "output_path": str(stage_dir / key),
        "duration_ms": int((time.time() - t0) * 1000),
        "cache_hit": False,
    }


def _require_pdf(ctx: StageContext) -> Path:
    if not ctx.pdf_path.is_file():
        raise MissingSourceError(f"Source PDF not found: {ctx.pdf_path}")
    return ctx.pdf_path


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


# ---------------------------------------------------------------------------
# S00 Register
# ---------------------------------------------------------------------------
@stage("s00_register", "0.2.0")
def stage_s00_register(ctx: StageContext) -> None:
    pdf = _require_pdf(ctx)
    write_json(
        ctx.out_dir / "source_meta.json",
        {"pdf_name": pdf.name, "pdf_size": pdf.stat().st_size, "registered_at": time.time()},
    )


# ---------------------------------------------------------------------------
# S01 Inspect
# ---------------------------------------------------------------------------
def _sample_pages(page_count: int, n: int = 8) -> list[int]:
    if page_count <= n:
        return list(range(page_count))
    step = (page_count - 1) / (n - 1)
    return sorted({round(i * step) for i in range(n)})


def classify_doc_type(text_pages: int, sampled: int) -> str:
    ratio = text_pages / sampled if sampled else 0.0
    if ratio < SCANNED_BELOW:
        return "scanned"
    return "native" if ratio >= NATIVE_AT_LEAST else "mixed"


@stage("s01_inspect", "0.2.0")
def stage_s01_inspect(ctx: StageContext) -> None:
    pdf = _require_pdf(ctx)
    ctx.progress(0, "Inspecting PDF and extracting bookmarks…")
    toc_mode = ctx.param("toc_mode", "auto")
    with PdfiumExtractor(pdf) as ext:
        page_count = ext.page_count()
        if page_count == 0:
            raise ValueError("PDF is invalid: it has no pages")
        toc = [] if toc_mode == "off" else ext.extract_toc()
        title = ext.extract_title()
        sampled = _sample_pages(page_count)
        text_pages = sum(1 for idx in sampled if ext.page_char_count(idx) >= TEXT_PAGE_MIN_CHARS)

    doc_type = classify_doc_type(text_pages, len(sampled))
    write_json(
        ctx.out_dir / "inspection.json",
        {
            "page_count": page_count,
            "title": title,
            "doc_type": doc_type,
            "is_born_digital": doc_type != "scanned",
            "sampled_pages": sampled,
            "text_pages_sampled": text_pages,
            "toc_count": len(toc),
            "toc": [t.model_dump() for t in toc],
        },
    )
    ctx.progress(1, "Inspection complete.")


# ---------------------------------------------------------------------------
# S02 Extract (sharded)
# ---------------------------------------------------------------------------
@stage("s02_extract", "0.2.0")
def stage_s02_extract(ctx: StageContext) -> None:
    pdf = _require_pdf(ctx)
    page_start = ctx.task.get("page_start") or 0
    page_end = ctx.task.get("page_end") or (page_start + 1)

    extracted: list[dict[str, Any]] = []
    with PdfiumExtractor(pdf) as ext:
        total = ext.page_count()
        for done, p_num in enumerate(range(page_start, min(page_end, total)), start=1):
            if ctx.should_abort():
                raise RuntimeError("Aborted")
            try:
                page = ext.extract_page(p_num)
            except Exception as exc:  # one bad page must not sink the book; S11 scores it
                logger.warning("Page %d failed to extract: %s", p_num, exc)
                page = PageData(page_idx=p_num, width=612.0, height=792.0, error=str(exc)[:300])
            extracted.append(page.model_dump())
            ctx.progress(done, f"Extracted page {p_num + 1}/{page_end}")

    write_json(
        ctx.out_dir / "pages.json",
        {
            "shard_idx": ctx.task.get("shard_idx", 0),
            "page_start": page_start,
            "page_end": page_end,
            "pages": extracted,
        },
    )


# ---------------------------------------------------------------------------
# S03 Merge
# ---------------------------------------------------------------------------
@stage("s03_merge", "0.2.0")
def stage_s03_merge(ctx: StageContext) -> None:
    ctx.progress(0, "Merging sharded extraction outputs…")
    pages: list[dict[str, Any]] = []
    # Exactly the shards of the current plan; no other key's leftovers are ever merged.
    for shard_dir in ctx.input_dirs("s02_extract"):
        data = json.loads((shard_dir / "pages.json").read_text(encoding="utf-8"))
        pages.extend(data.get("pages", []))
    pages.sort(key=lambda p: p["page_idx"])

    expected = ctx.read_json("s01_inspect", "inspection.json")["page_count"]
    seen = [p["page_idx"] for p in pages]
    if seen != list(range(expected)):
        raise RuntimeError(
            f"S03 page coverage mismatch: expected pages 0..{expected - 1}, got {len(seen)} "
            f"({len(seen) - len(set(seen))} duplicates)"
        )
    write_json(ctx.out_dir / "merged_pages.json", {"pages": pages, "total_pages": len(pages)})
    ctx.progress(len(pages), f"Merged {len(pages)} pages.")


# ---------------------------------------------------------------------------
# S04 Furniture + TOC-page removal
# ---------------------------------------------------------------------------
_DOT_LEADER = re.compile(r"(?:\.\s?){4,}")


def _block_line_texts(block: dict[str, Any]) -> list[str]:
    lines = block.get("lines") or []
    texts = [ln["text"] for ln in lines] or block["raw_text"].splitlines()
    return [t for t in texts if t.strip()]


def is_toc_block(block: dict[str, Any]) -> bool:
    """A block where at least half the lines carry dot leaders ("Chapter 1 ......... 5")."""
    texts = _block_line_texts(block)
    if not texts:
        return False
    return sum(1 for t in texts if _DOT_LEADER.search(t)) / len(texts) >= 0.5


@stage("s04_furniture", "0.2.0")
def stage_s04_furniture(ctx: StageContext) -> None:
    ctx.progress(0, "Detecting running headers, footers, watermarks and TOC pages…")
    pages_data = ctx.read_json("s03_merge", "merged_pages.json")["pages"]

    # Frequency analysis across margin bands (top 6% and bottom 6%)
    margin_patterns: dict[str, int] = {}
    for page in pages_data:
        h = page.get("height", 660.0)
        for b in page.get("blocks", []):
            y0, y1 = b["bbox"][1], b["bbox"][3]
            if y0 < h * 0.06 or y1 > h * 0.94:
                txt = b["raw_text"].strip()
                margin_patterns[txt] = margin_patterns.get(txt, 0) + 1

    indesign_re = re.compile(r".*\.indd\s+\d+:\d+:\d+.*Page\s+\w+", re.IGNORECASE)
    watermark_re = re.compile(r"www\.[a-z0-9\-]+\.(info|org|com|net)", re.IGNORECASE)
    page_num_re = re.compile(r"^(\d{1,4}|[ivxlcdm]+)$", re.IGNORECASE)
    running_head_re = re.compile(r"^(Chapter\s+\d+|[A-Z0-9\s]{3,30}\s+\d{1,4})$", re.IGNORECASE)

    clean_pages: list[dict[str, Any]] = []
    for page in pages_data:
        h = page.get("height", 660.0)
        for b in page.get("blocks", []):
            txt = b["raw_text"].strip()
            y0, y1 = b["bbox"][1], b["bbox"][3]
            in_margin = y0 < h * 0.06 or y1 > h * 0.94
            if (
                watermark_re.search(txt)
                or indesign_re.search(txt)
                or (
                    in_margin
                    and (
                        margin_patterns.get(txt, 0) >= 2
                        or page_num_re.match(txt)
                        or (running_head_re.match(txt) and len(txt) < 40)
                        or ("■" in txt and len(txt) < 50)
                    )
                )
            ):
                b["block_type"] = "furniture"

        # Table-of-contents pages: dot-leader lines are navigation, not knowledge.
        content = [b for b in page.get("blocks", []) if b["block_type"] != "furniture"]
        toc_blocks = [b for b in content if is_toc_block(b)]
        if toc_blocks and len(toc_blocks) / len(content) >= 0.5:
            for b in content:
                b["block_type"] = "toc"
        else:
            for b in toc_blocks:
                b["block_type"] = "toc"
        clean_pages.append(page)

    write_json(ctx.out_dir / "clean_pages.json", {"pages": clean_pages})
    ctx.progress(len(clean_pages), "Furniture filtering complete.")


# ---------------------------------------------------------------------------
# S05 Reading order (column-aware)
# ---------------------------------------------------------------------------
@stage("s05_reading_order", "0.2.0")
def stage_s05_reading_order(ctx: StageContext) -> None:
    pages_data = ctx.read_json("s04_furniture", "clean_pages.json")["pages"]

    for page in pages_data:
        pw = page.get("width", 530.0)
        ph = page.get("height", 660.0)
        blocks = [b for b in page["blocks"] if b["block_type"] != "furniture"]
        if not blocks:
            page["blocks"] = []
            continue

        mid_x = pw / 2.0
        left_blocks = [b for b in blocks if b["bbox"][2] <= mid_x + 10]
        right_blocks = [b for b in blocks if b["bbox"][0] >= mid_x - 10]
        spanning_blocks = [
            b for b in blocks if b["bbox"][0] < mid_x - 10 and b["bbox"][2] > mid_x + 10
        ]

        is_two_col = (
            len(left_blocks) >= 1
            and len(right_blocks) >= 1
            and (len(left_blocks) + len(right_blocks)) / len(blocks) >= 0.75
            and len(spanning_blocks) <= 2
            and len(left_blocks) + len(right_blocks) >= 3
        )

        def by_position(b: dict[str, Any]) -> tuple[int, float]:
            return (round(b["bbox"][1] / 3.5), b["bbox"][0])

        if is_two_col:
            top_spanning = [b for b in spanning_blocks if b["bbox"][1] < ph * 0.3]
            bot_spanning = [b for b in spanning_blocks if b["bbox"][1] >= ph * 0.3]
            # A full-width banner above the columns reads first; one below reads last.
            ordered = (
                sorted(top_spanning, key=lambda b: b["bbox"][1])
                + sorted(left_blocks, key=by_position)
                + sorted(right_blocks, key=by_position)
                + sorted(bot_spanning, key=lambda b: b["bbox"][1])
            )
        else:
            ordered = sorted(blocks, key=by_position)

        # Chapter opening banner inversion check (e.g. 'C H A P T E R 1: ...')
        ch_idx = next(
            (
                i
                for i, b in enumerate(ordered)
                if re.match(r"^C\s*H\s*A\s*P\s*T\s*E\s*R\s*\d+", b["raw_text"], re.IGNORECASE)
            ),
            None,
        )
        if ch_idx is not None and ch_idx > 0 and ordered[ch_idx]["bbox"][1] < ph * 0.3:
            ordered.insert(0, ordered.pop(ch_idx))

        page["blocks"] = ordered

    write_json(ctx.out_dir / "ordered_pages.json", {"pages": pages_data})
    ctx.progress(len(pages_data), "Reading order organized.")


# ---------------------------------------------------------------------------
# S06 Structure (outline reconciliation + bold headings)
# ---------------------------------------------------------------------------
_CHAPTER_RE = re.compile(r"^(Chapter\s+\d+|Appendix\s+\w+|Part\s+\w+|Index)$", re.IGNORECASE)


@stage("s06_structure", "0.2.0")
def stage_s06_structure(ctx: StageContext) -> None:
    pages_data = ctx.read_json("s05_reading_order", "ordered_pages.json")["pages"]
    toc: list[dict[str, Any]] = []
    if ctx.param("toc_mode", "auto") != "off":
        toc = ctx.read_json("s01_inspect", "inspection.json").get("toc", [])

    for page in pages_data:
        entries = [t for t in toc if t.get("page_idx") == page["page_idx"]]
        used: set[int] = set()

        for block in page["blocks"]:
            if block["block_type"] in ("toc", "furniture", "code"):
                continue
            txt = block["raw_text"].strip()
            norm = _norm(txt)

            # An outline entry claims a block only when the block is essentially that title
            # (numbering/page-number slack allowed), never a paragraph that merely mentions it.
            matched: dict[str, Any] | None = None
            for i, t in enumerate(entries):
                t_norm = _norm(t["title"])
                if i not in used and len(t_norm) >= 3 and t_norm in norm and len(norm) <= len(t_norm) + 10:
                    matched = t
                    used.add(i)
                    break

            if matched:
                block["block_type"] = "heading"
                block["metadata"]["level"] = matched["level"]
                block["metadata"]["title"] = matched["title"]
            elif block.get("is_bold") and len(txt) < 100 and not txt.endswith((".", ";", ":", ",")):
                if _CHAPTER_RE.match(txt):
                    block["block_type"] = "heading"
                    block["metadata"]["level"] = 0
                elif block["block_type"] == "heading":
                    block["metadata"]["level"] = 2
            elif block["block_type"] == "heading":
                block["block_type"] = "paragraph"

    write_json(ctx.out_dir / "structured_pages.json", {"pages": pages_data, "toc": toc})
    ctx.progress(len(pages_data), "Structure and headings identified.")


# ---------------------------------------------------------------------------
# S07 Continuity
# ---------------------------------------------------------------------------
@stage("s07_continuity", "0.2.0")
def stage_s07_continuity(ctx: StageContext) -> None:
    pages_data = ctx.read_json("s06_structure", "structured_pages.json")["pages"]

    for i in range(len(pages_data) - 1):
        curr_blocks = pages_data[i]["blocks"]
        next_blocks = pages_data[i + 1]["blocks"]
        if curr_blocks and next_blocks:
            last, first = curr_blocks[-1], next_blocks[0]
            if (
                last["block_type"] == "paragraph"
                and first["block_type"] == "paragraph"
                and not last["raw_text"].endswith((".", ":", ";", "?", "!"))
            ):
                last["metadata"]["continues_on_next_page"] = True
                first["metadata"]["continues_from_prev_page"] = True

    write_json(ctx.out_dir / "continuous_pages.json", {"pages": pages_data})
    ctx.progress(len(pages_data), "Continuity verified.")


# ---------------------------------------------------------------------------
# S08 Typed content (code of any language, lists)
# ---------------------------------------------------------------------------
@stage("s08_typed_content", "0.2.0")
def stage_s08_typed_content(ctx: StageContext) -> None:
    pages_data = ctx.read_json("s07_continuity", "continuous_pages.json")["pages"]

    code_blocks = 0
    for page in pages_data:
        for block in page["blocks"]:
            b_type = block["block_type"]
            if b_type in ("heading", "toc", "furniture"):
                continue
            txt = block["raw_text"]
            is_mono = bool(block.get("is_mono")) or b_type == "code"
            language = classify_code(txt, is_mono)
            if language is not None:
                block["block_type"] = "code"
                block["metadata"]["language"] = language
                code_blocks += 1
            elif txt.strip().startswith(("1.", "2.", "3.", "■", "•", "-")):
                block["block_type"] = "list_item"

    write_json(
        ctx.out_dir / "typed_pages.json", {"pages": pages_data, "code_block_count": code_blocks}
    )
    ctx.progress(len(pages_data), f"Typed content identified ({code_blocks} code blocks).")


# ---------------------------------------------------------------------------
# S09 Book graph
# ---------------------------------------------------------------------------
@stage("s09_graph", "0.2.0")
def stage_s09_graph(ctx: StageContext) -> None:
    pages_data = ctx.read_json("s08_typed_content", "typed_pages.json")["pages"]

    nodes: list[BookNode] = [BookNode(node_id="root", node_type="book", title="Book Root")]
    # Heading stack of (level, node_id): a heading's parent is the nearest open heading with a
    # smaller level, so outline levels become a real chapter > section > subsection tree.
    stack: list[tuple[int, str]] = []

    for page in pages_data:
        p_idx = page["page_idx"]
        for b in page["blocks"]:
            b_type = b["block_type"]
            txt = b["raw_text"]

            if b_type == "heading":
                level = int(b.get("metadata", {}).get("level", 1))
                if _CHAPTER_RE.match(txt.strip()):
                    level = 0
                while stack and stack[-1][0] >= level:
                    stack.pop()
                parent_id = stack[-1][1] if stack else "root"
                nodes.append(
                    BookNode(
                        node_id=b["block_id"],
                        node_type="chapter" if level <= 0 else "section",
                        title=txt,
                        text=txt,
                        page_idx=p_idx,
                        bbox=b["bbox"],
                        parent_id=parent_id,
                        metadata={"level": level},
                    )
                )
                stack.append((level, b["block_id"]))
            else:
                nodes.append(
                    BookNode(
                        node_id=b["block_id"],
                        node_type=b_type,
                        text=txt,
                        page_idx=p_idx,
                        bbox=b["bbox"],
                        parent_id=stack[-1][1] if stack else "root",
                        metadata=b.get("metadata", {}),
                    )
                )

    write_json(ctx.out_dir / "graph.json", {"nodes": [n.model_dump() for n in nodes]})
    ctx.progress(len(nodes), f"Book Graph constructed with {len(nodes)} nodes.")


# ---------------------------------------------------------------------------
# S10 Clean
# ---------------------------------------------------------------------------
_LIGATURE_FIXES = [
    ("fl ag", "flag"),
    ("fi nd", "find"),
    ("fi rst", "first"),
    ("defi ne", "define"),
    ("defi ned", "defined"),
    ("effi cient", "efficient"),
    ("affi liate", "affiliate"),
    ("offi ce", "office"),
    ("confl ict", "conflict"),
    ("signifi cant", "significant"),
    ("signifi cantly", "significantly"),
    ("speci fi", "specifi"),
    ("fi eld", "field"),
    ("identi fi", "identifi"),
    ("beneﬁ", "benefi"),
]


@stage("s10_clean", "0.2.0")
def stage_s10_clean(ctx: StageContext) -> None:
    nodes_data = ctx.read_json("s09_graph", "graph.json")["nodes"]
    form = ctx.param("unicode_normal", "NFC")
    fix_spaced = ctx.param("fix_spaced_letters", True)
    dehyphenate = ctx.param("dehyphenate", True)

    for node in nodes_data:
        text = node["text"]
        # quotes_policy is "keep": do not let ftfy straighten typographic quotes.
        text = ftfy.fix_text(text, uncurl_quotes=False)
        for bad, good in _LIGATURE_FIXES:
            text = text.replace(bad, good)

        if fix_spaced:
            text = re.sub(r"\bC\s+H\s+A\s+P\s+T\s+E\s+R\b", "CHAPTER", text, flags=re.IGNORECASE)
            text = re.sub(r"\bA\s+P\s+P\s+E\s+N\s+D\s+I\s+X\b", "APPENDIX", text, flags=re.IGNORECASE)
            text = re.sub(r"\bI\s+N\s+D\s+E\s+X\b", "INDEX", text, flags=re.IGNORECASE)

        text = text.replace("\xad", "").replace("\x02", "").replace("�", "")
        if dehyphenate:
            text = re.sub(r"(\b[a-zA-Z]{3,})-\s*\n\s*([a-z]{2,}\b)", r"\1\2", text)

        node["text"] = unicodedata.normalize(form, text)

    write_json(ctx.out_dir / "clean_graph.json", {"nodes": nodes_data})
    ctx.progress(len(nodes_data), "Text normalized and cleaned.")


# ---------------------------------------------------------------------------
# S11 Validate (quality audit)
# ---------------------------------------------------------------------------
def score_quality(
    *,
    pages: int,
    words: int,
    headings: int,
    replacement_chars: int,
    chars: int,
    empty_pages: int,
    failed_pages: int,
) -> tuple[float, list[str]]:
    """Heuristic 0..1 confidence that the extraction is usable, with the reasons for deductions."""
    score = 1.0
    reasons: list[str] = []
    if pages and failed_pages:
        score -= min(0.4, 0.4 * failed_pages / pages)
        reasons.append(f"{failed_pages} page(s) failed to extract")
    density = words / max(1, pages)
    if density < 40:
        score -= 0.35 * (40 - density) / 40
        reasons.append(f"sparse text ({density:.0f} words/page)")
    if headings == 0:
        score -= 0.20
        reasons.append("no headings detected")
    if chars and replacement_chars / chars > 0.002:
        score -= min(0.3, 50 * replacement_chars / chars)
        reasons.append("garbled characters present")
    if pages and empty_pages / pages > 0.5:
        score -= 0.2
        reasons.append("more than half the pages have no text")
    return round(max(0.0, min(1.0, score)), 3), reasons


@stage("s11_validate", "0.2.0")
def stage_s11_validate(ctx: StageContext) -> None:
    nodes = ctx.read_json("s10_clean", "clean_graph.json")["nodes"]
    inspection = ctx.read_json("s01_inspect", "inspection.json")
    pages_total = inspection["page_count"]

    content = [n for n in nodes if n["node_type"] not in ("book", "toc", "furniture")]
    total_words = sum(len(n["text"].split()) for n in content)
    chars = sum(len(n["text"]) for n in content)
    garbled = sum(n["text"].count("�") + n["text"].count("\x00") for n in content)
    code_blocks = sum(1 for n in content if n["node_type"] == "code")
    headings = sum(1 for n in content if n["node_type"] in ("chapter", "section"))
    pages_with_text = {n["page_idx"] for n in content if n["text"].strip()}

    merged = ctx.read_json("s03_merge", "merged_pages.json")["pages"]
    failed_pages = sum(1 for p in merged if p.get("error"))

    quality, reasons = score_quality(
        pages=pages_total,
        words=total_words,
        headings=headings,
        replacement_chars=garbled,
        chars=chars,
        empty_pages=pages_total - len(pages_with_text),
        failed_pages=failed_pages,
    )
    write_json(
        ctx.out_dir / "validation.json",
        {
            "quality_score": quality,
            "quality_reasons": reasons,
            "total_nodes": len(nodes),
            "total_words": total_words,
            "code_blocks": code_blocks,
            "headings": headings,
            "failed_pages": failed_pages,
            "status": "passed",
        },
    )
    ctx.progress(1, f"Validation: quality {quality}, {total_words} words, {code_blocks} code blocks.")


# ---------------------------------------------------------------------------
# S12 Semantic (breadcrumbs)
# ---------------------------------------------------------------------------
@stage("s12_semantic", "0.2.0")
def stage_s12_semantic(ctx: StageContext) -> None:
    nodes = ctx.read_json("s10_clean", "clean_graph.json")["nodes"]

    node_by_id = {n["node_id"]: n for n in nodes}
    for n in nodes:
        crumbs: list[str] = []
        curr = n.get("parent_id")
        seen: set[str] = set()
        while curr and curr in node_by_id and curr != "root" and curr not in seen:
            seen.add(curr)
            parent = node_by_id[curr]
            if parent.get("title"):
                crumbs.insert(0, parent["title"])
            curr = parent.get("parent_id")
        n["breadcrumbs"] = crumbs

    write_json(ctx.out_dir / "semantic_graph.json", {"nodes": nodes})
    ctx.progress(len(nodes), "Semantic breadcrumbs added.")


# S13 (assist) and S14 (compile) register themselves on import.
from dabook.stages import assist as _assist  # noqa: E402,F401
from dabook.stages import compile as _compile  # noqa: E402,F401
