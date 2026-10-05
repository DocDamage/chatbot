"""
PDF extraction backend using pypdfium2 (§8.2).

Fast, permissive C-level PDF parsing. Extracts character-level bounding boxes,
word runs, lines, page dimensions, embedded bookmarks, and exact font metrics
from PDF graphics-state objects.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium

from dabook.ir.models import PageData, RawBlock, TextLine, TocItem

logger = logging.getLogger("dabook.backends.pdfium")

_MONO_HINTS = (
    "courier",
    "mono",
    "code",
    "consolas",
    "inconsolata",
    "typewriter",
    "menlo",
    "fixed",
    "lucidaconsole",
    "terminal",
)
_BOLD_HINTS = ("bold", "black", "heavy", "semibold", "demi", "extrabold")


def _font_traits(font: Any) -> tuple[str, int, bool]:
    """
    (display name, weight, is_monospace) for a pdfium font.

    pdfium reports weight 0 for the standard non-embedded fonts, so boldness is also read
    from the PostScript base name ("Helvetica-Bold", "ABCDEF+TimesNewRomanPS-BoldMT").
    """

    def _get(method: str) -> str:
        try:
            return str(getattr(font, method)() or "")
        except Exception:
            return ""

    family = _get("get_family_name")
    base = _get("get_base_name")
    try:
        weight = int(font.get_weight() or 0)
    except Exception:
        weight = 0
    names = f"{family} {base}".lower().replace(" ", "")
    if weight < 600 and any(h in names for h in _BOLD_HINTS):
        weight = 700
    elif weight == 0:
        weight = 400
    return (base or family), weight, any(h in names for h in _MONO_HINTS)


def _headingish(line: TextLine) -> bool:
    return line.is_bold and len(line.text) < 120 and not line.text.endswith((".", ";", ":"))


# ---------------------------------------------------------------------------
# Span -> line assembly and column detection (module level so they are unit-testable)
# ---------------------------------------------------------------------------

_GUTTER_MIN_WIDTH = 8.0  # PDF points of clear space needed to call something a column gutter


def _split_columns(spans: list[dict[str, Any]], page_width: float) -> list[list[dict[str, Any]]]:
    """
    Partition a page's spans into text streams.

    Returns ``[spans]`` for ordinary single-column pages. When a vertical gutter near the page
    centre is crossed by few spans while both sides carry real text, returns
    ``[full_width_spans, left_column, right_column]`` (empty groups dropped), so each column is
    assembled into lines independently.
    """
    if len(spans) < 8 or page_width <= 0:
        return [spans]

    width = int(page_width) + 2
    diff = [0] * (width + 1)
    for s in spans:
        lo = max(0, int(s["x0"]))
        hi = min(width - 1, int(s["x1"]))
        diff[lo] += 1
        diff[hi + 1] -= 1
    cover: list[int] = []
    running = 0
    for i in range(width):
        running += diff[i]
        cover.append(running)

    peak = max(cover[int(page_width * 0.05) : int(page_width * 0.95)] or [0])
    if peak < 4:
        return [spans]
    empty_enough = max(2, int(0.12 * peak))

    # Widest run of (nearly) unoccupied columns of the page inside the central band
    best: tuple[int, int] | None = None  # (start, end) inclusive
    run_start: int | None = None
    lo_band, hi_band = int(page_width * 0.30), int(page_width * 0.70)
    for x in range(lo_band, hi_band + 2):
        free = x <= hi_band and cover[x] <= empty_enough
        if free and run_start is None:
            run_start = x
        elif not free and run_start is not None:
            if best is None or (x - 1 - run_start) > (best[1] - best[0]):
                best = (run_start, x - 1)
            run_start = None
    if best is None or (best[1] - best[0] + 1) < _GUTTER_MIN_WIDTH:
        return [spans]

    gx = (best[0] + best[1]) / 2.0
    left = [s for s in spans if s["x1"] <= gx]
    right = [s for s in spans if s["x0"] >= gx]
    crossing = [s for s in spans if s["x0"] < gx < s["x1"]]
    n = len(spans)
    if len(left) < 0.25 * n or len(right) < 0.25 * n or len(crossing) > max(3, int(0.12 * n)):
        return [spans]
    return [g for g in (crossing, left, right) if g]


def _assemble_lines(spans: list[dict[str, Any]]) -> list[TextLine]:
    """Cluster spans on a shared baseline into visual lines (sorted top-to-bottom)."""
    spans = sorted(spans, key=lambda s: (round(s["y0"] / 3.5), s["x0"]))

    lines_spans: list[list[dict[str, Any]]] = []
    curr_line: list[dict[str, Any]] = []
    for s in spans:
        if not curr_line:
            curr_line.append(s)
            continue
        if abs(s["y0"] - curr_line[0]["y0"]) <= 3.5:
            curr_line.append(s)
        else:
            lines_spans.append(curr_line)
            curr_line = [s]
    if curr_line:
        lines_spans.append(curr_line)

    assembled: list[TextLine] = []
    for l_spans in lines_spans:
        l_spans.sort(key=lambda s: s["x0"])
        line_text = ""
        for i, s in enumerate(l_spans):
            t = s["text"]
            # Ligature healing on adjacent spans (e.g. 'defi' + 'fi ned')
            if line_text.endswith(("fi", "fl", "ff")) and t.startswith(("fi ", "fl ", "ff ")):
                t = t[3:]
            elif (
                line_text
                and not line_text.endswith((" ", "-", "[", "("))
                and not t.startswith((" ", "]", ")", ",", ".", ";", ":"))
                and s["x0"] - l_spans[i - 1]["x1"] > 2.0
            ):
                line_text += " "
            line_text += t

        clean_line_text = line_text.strip()
        if not clean_line_text:
            continue

        mono_chars = sum(len(s["text"]) for s in l_spans if s["is_mono"])
        total_chars = max(1, sum(len(s["text"]) for s in l_spans))
        is_line_mono = (mono_chars / total_chars >= 0.5) or (
            l_spans[0]["is_mono"]
            and clean_line_text.startswith(
                ("01:", "02:", ";", "//", "mov", "push", "pop", "add", "sub", "xor", "call", "ret")
            )
        )

        avg_weight = sum(s["weight"] for s in l_spans) / len(l_spans)
        max_fs = max(s["font_size"] for s in l_spans)
        assembled.append(
            TextLine(
                text=clean_line_text,
                bbox=[
                    round(min(s["x0"] for s in l_spans), 2),
                    round(min(s["y0"] for s in l_spans), 2),
                    round(max(s["x1"] for s in l_spans), 2),
                    round(max(s["y1"] for s in l_spans), 2),
                ],
                font_size=round(max_fs, 1),
                is_bold=avg_weight >= 600,
                is_mono=is_line_mono,
            )
        )
    return assembled


class PdfiumExtractor:
    """Extracts text, bounding boxes, and structure from a PDF file."""

    def __init__(self, pdf_path: Path) -> None:
        self.pdf_path = pdf_path
        self._doc: pdfium.PdfDocument | None = None

    def __enter__(self) -> PdfiumExtractor:
        self._doc = pdfium.PdfDocument(self.pdf_path)
        return self

    def __exit__(self, *args: Any) -> None:
        if self._doc is not None:
            self._doc.close()
            self._doc = None

    @property
    def doc(self) -> pdfium.PdfDocument:
        if self._doc is None:
            self._doc = pdfium.PdfDocument(self.pdf_path)
        return self._doc

    def page_count(self) -> int:
        return len(self.doc)

    def extract_title(self) -> str | None:
        """Document-information Title, if the PDF declares a meaningful one."""
        try:
            title = (self.doc.get_metadata_dict().get("Title") or "").strip()
        except Exception:
            return None
        # Word/LaTeX exports often leave a filename or "untitled" behind
        if not title or title.lower() in {"untitled", "unspecified"} or title.lower().endswith(".pdf"):
            return None
        return title

    def page_char_count(self, page_idx: int) -> int:
        """Cheap text-layer probe (no block assembly) used to classify native vs scanned."""
        page = self.doc[page_idx]
        try:
            return int(page.get_textpage().count_chars())
        finally:
            page.close()

    def extract_toc(self) -> list[TocItem]:
        """Extract embedded PDF bookmarks / table of contents."""
        items: list[TocItem] = []
        try:
            for bm in self.doc.get_toc():
                title = bm.get_title().strip() if hasattr(bm, "get_title") else ""
                if not title:
                    continue
                dest = bm.get_dest()
                page_idx = dest.get_index() if dest else 0
                items.append(
                    TocItem(
                        title=title,
                        level=bm.level,
                        page_idx=page_idx or 0,
                    )
                )
        except Exception as e:
            logger.warning("Failed to extract TOC: %s", e)
        return items

    def extract_page(self, page_idx: int) -> PageData:
        """Extract all blocks, lines, and bounding boxes for a single page with graphics state."""
        page = self.doc[page_idx]
        pw, ph = page.get_size()
        tp = page.get_textpage()

        char_count = tp.count_chars()
        if char_count == 0:
            return PageData(
                page_idx=page_idx,
                width=pw,
                height=ph,
                is_scanned=True,
                char_count=0,
            )

        # 1. Extract visual spans with graphics-state metadata
        spans: list[dict[str, Any]] = []
        try:
            for obj in page.get_objects():
                if not isinstance(obj, pdfium.PdfTextObj):
                    continue
                obj.textpage = tp
                raw_text = obj.extract()
                if not raw_text:
                    continue

                font = obj.get_font()
                fname, weight, is_mono = _font_traits(font)
                fs = obj.get_font_size() if hasattr(obj, "get_font_size") else 10.0

                bounds = obj.get_bounds()
                x0 = max(0.0, bounds[0])
                top_y = max(0.0, ph - bounds[3])
                x1 = min(pw, bounds[2])
                bot_y = max(top_y + 1.0, ph - bounds[1])

                spans.append(
                    {
                        "x0": x0,
                        "y0": top_y,
                        "x1": x1,
                        "y1": bot_y,
                        "text": raw_text,
                        "font": fname,
                        "weight": weight,
                        "font_size": fs,
                        "is_mono": is_mono,
                    }
                )
        except Exception as exc:
            logger.warning("Object extraction failed on page %d, using flat text: %s", page_idx, exc)

        # Fallback to textpage rects if no spans were extracted
        if not spans:
            return self._extract_page_fallback(page_idx, page, pw, ph, tp, char_count)

        # 2. Column detection: a vertical gutter splits the page into independent text streams,
        #    so two-column layouts are never fused into single wide lines.
        blocks: list[RawBlock] = []
        for group in _split_columns(spans, pw):
            blocks.extend(self._group_blocks(page_idx, len(blocks), _assemble_lines(group)))

        return PageData(
            page_idx=page_idx,
            width=pw,
            height=ph,
            blocks=blocks,
            is_scanned=False,
            char_count=char_count,
        )

    def _group_blocks(self, page_idx: int, first_idx: int, lines: list[TextLine]) -> list[RawBlock]:
        """Group consecutive lines of one text stream into cohesive semantic blocks."""
        blocks: list[RawBlock] = []
        block_idx = first_idx
        current_lines: list[TextLine] = []

        for line in lines:
            if not current_lines:
                current_lines.append(line)
                continue

            prev = current_lines[-1]
            vert_gap = line.bbox[1] - prev.bbox[3]

            is_mono_transition = line.is_mono != prev.is_mono
            line_is_head = _headingish(line)
            # A change of weight or a size jump of 1.5pt+ starts a new block, so a bold chapter
            # title never fuses with the body text underneath it (and vice versa).
            style_change = (
                line.is_bold != prev.is_bold or abs(line.font_size - prev.font_size) >= 1.5
            )
            # Wrapped multi-line heading: same bold style, tight line spacing -> keep together.
            heading_continuation = (
                line_is_head
                and _headingish(prev)
                and not style_change
                and vert_gap < max(prev.font_size, 8.0) * 0.6
            )
            is_gap = vert_gap > max(prev.font_size, 10.0) * 1.5
            is_bullet = line.text.startswith(("■", "•", "-", "*", "1.", "2.", "3."))

            if (
                is_mono_transition
                or style_change
                or (line_is_head and not heading_continuation)
                or is_gap
                or is_bullet
            ):
                blocks.append(self._create_block(page_idx, block_idx, current_lines))
                block_idx += 1
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            blocks.append(self._create_block(page_idx, block_idx, current_lines))
        return blocks

    def _create_block(
        self,
        page_idx: int,
        block_idx: int,
        lines: list[TextLine],
    ) -> RawBlock:
        x0 = min(ln.bbox[0] for ln in lines)
        y0 = min(ln.bbox[1] for ln in lines)
        x1 = max(ln.bbox[2] for ln in lines)
        y1 = max(ln.bbox[3] for ln in lines)

        mono_chars = sum(len(ln.text) for ln in lines if ln.is_mono)
        total_chars = max(1, sum(len(ln.text) for ln in lines))
        is_all_mono = any(ln.is_mono for ln in lines) and (mono_chars / total_chars >= 0.5)

        is_heading = (
            lines[0].is_bold
            and len(lines) <= 2
            and sum(len(ln.text) for ln in lines) < 120
            and not lines[-1].text.endswith((".", ";"))
        )
        is_bullet = lines[0].text.startswith(("■", "•", "-", "*"))

        if is_all_mono:
            block_type = "code"
            base_x = min(ln.bbox[0] for ln in lines)
            indented = []
            for ln in lines:
                indent = max(0, round((ln.bbox[0] - base_x) / 6.0))
                indented.append((" " * indent) + ln.text)
            full_text = "\n".join(indented)
        elif is_heading:
            block_type = "heading"
            full_text = " ".join(ln.text for ln in lines)
        elif is_bullet:
            block_type = "list_item"
            full_text = " ".join(ln.text for ln in lines)
        else:
            block_type = "paragraph"
            full_text = " ".join(ln.text for ln in lines)

        return RawBlock(
            block_id=f"p{page_idx}_b{block_idx}",
            page_idx=page_idx,
            bbox=[round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
            raw_text=full_text,
            normalized_text=full_text,
            clean_text=full_text,
            block_type=block_type,
            font_size=round(max(ln.font_size for ln in lines), 1),
            is_bold=lines[0].is_bold,
            is_mono=is_all_mono,
            lines=lines,
        )

    def _extract_page_fallback(
        self,
        page_idx: int,
        page: Any,
        pw: float,
        ph: float,
        tp: Any,
        char_count: int,
    ) -> PageData:
        """Fallback extractor using raw textpage if object graphics state is unavailable."""
        raw_text_full = tp.get_text_range()
        split_lines = [ln.strip() for ln in raw_text_full.splitlines() if ln.strip()]
        lines: list[TextLine] = []
        for line_idx, line_text in enumerate(split_lines):
            y_pos = (line_idx / max(1, len(split_lines))) * ph
            lines.append(
                TextLine(
                    text=line_text,
                    bbox=[50.0, round(y_pos, 2), pw - 50.0, round(y_pos + 12.0, 2)],
                    font_size=10.0,
                    is_bold=False,
                    is_mono=False,
                )
            )
        blocks = [
            RawBlock(
                block_id=f"p{page_idx}_b0",
                page_idx=page_idx,
                bbox=[50.0, 50.0, pw - 50.0, ph - 50.0],
                raw_text="\n".join(split_lines),
                normalized_text="\n".join(split_lines),
                clean_text="\n".join(split_lines),
                block_type="paragraph",
                lines=lines,
            )
        ]
        return PageData(
            page_idx=page_idx,
            width=pw,
            height=ph,
            blocks=blocks,
            is_scanned=False,
            char_count=char_count,
        )
