"""Recover conservative native-PDF formula candidates before visual enrichment.

Text equality alone is insufficient: candidates also need native superscript,
subscript, stacked fraction geometry, or a mathematical operator. No LaTeX is
invented here; Docling's visual formula model still transcribes the crop.
"""

import re
import statistics

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_raw

_RELATION = re.compile(r"[=≈≠≤≥<>]")
_CODE = re.compile(
    r"\b(?:def|return|const|let|var|if|for|import|true|false|null)\b|\*\*|==|=>|:=|;|//",
    re.IGNORECASE,
)


def plausible_math(text: str) -> bool:
    if not text.strip() or len(text) > 200 or not _RELATION.search(text) or _CODE.search(text):
        return False
    # Long words and ordinary punctuation are prose. Short variables and Greek
    # symbols remain eligible, but still require independent visual structure.
    if any(len(word) > 3 for word in re.findall(r"[^\W\d_]+", text, re.UNICODE)):
        return False
    return all(
        char.isalnum() or char.isspace() or char in "=≈≠≤≥<>+-−*/()[]{}^_.±∑∫√∞,|" for char in text
    )


def structural_evidence(glyphs: list[tuple[str, tuple[float, ...], float]]) -> str | None:
    visible = [(char, box, size) for char, box, size in glyphs if char.strip() and size > 0]
    if len(visible) < 3:
        return None
    if any(char in "∑∫√±" for char, _, _ in visible):
        return "math_operator"
    largest = max(size for _, _, size in visible)
    baseline = statistics.median(box[1] for _, box, size in visible if size >= largest * 0.95)
    for _, box, size in visible:
        if size < largest * 0.85 and (
            box[1] > baseline + largest * 0.15 or box[1] < baseline - largest * 0.15
        ):
            return "script_geometry"
    relations = [box for char, box, _ in visible if _RELATION.fullmatch(char)]
    for relation in relations:
        right = [(box, size) for _, box, size in visible if box[0] > relation[2]]
        if not right:
            continue
        above = [box for box, size in right if box[1] > relation[1] + largest * 0.35]
        below = [box for box, size in right if box[1] < relation[1] - largest * 0.35]
        if any(min(a[2], b[2]) > max(a[0], b[0]) for a in above for b in below):
            return "stacked_geometry"
    return None


def small_ink_crop(box, ink) -> bool:
    """Allow at most 5pt inward and 2pt outward correction, retaining >=75% dimensions."""
    original = (box.l, box.b, box.r, box.t)
    return (
        all(abs(actual - previous) <= 5 for actual, previous in zip(ink, original, strict=True))
        and ink[0] >= box.l - 2
        and ink[1] >= box.b - 2
        and ink[2] <= box.r + 2
        and ink[3] <= box.t + 2
        and ink[2] - ink[0] >= (box.r - box.l) * 0.75
        and ink[3] - ink[1] >= (box.t - box.b) * 0.75
    )


def recover_native_formulas(document, source, formula_label) -> dict[str, dict]:
    """Promote bounded text items with independently observed math geometry.

    Only native text is examined. Scanned pages and ambiguous one-line
    assignments retain the layout model's original classification.
    """
    recovered: dict[str, dict] = {}
    candidates: dict[int, list] = {}
    for item, _ in document.iterate_items():
        if len(recovered) + sum(map(len, candidates.values())) >= 200:
            break
        if str(item.label.value) not in ("text", "formula") or not getattr(item, "prov", None):
            continue
        if str(item.label.value) == "formula" or plausible_math(getattr(item, "text", "")):
            candidates.setdefault(item.prov[0].page_no - 1, []).append(item)
    if not candidates:
        return recovered
    with pdfium.PdfDocument(source) as pdf:
        for page_index, items in candidates.items():
            if page_index < 0 or page_index >= len(pdf):
                continue
            page = pdf[page_index]
            textpage = page.get_textpage()
            try:
                if page.get_rotation() != 0:
                    continue  # Native text coordinates on rotated pages need a separate transform.
                count = textpage.count_chars()
                if count > 100000:
                    continue
                glyphs = [
                    (
                        textpage.get_text_range(i, 1),
                        textpage.get_charbox(i),
                        pdfium_raw.FPDFText_GetFontSize(textpage, i),
                    )
                    for i in range(count)
                ]
                for item in items:
                    box = item.prov[0].bbox.to_bottom_left_origin(page_height=page.get_height())
                    selected = [
                        (char, rect, size)
                        for char, rect, size in glyphs
                        if box.l - 2 <= (rect[0] + rect[2]) / 2 <= box.r + 2
                        and box.b - 2 <= (rect[1] + rect[3]) / 2 <= box.t + 2
                    ]
                    native_text = "".join(char for char, _, _ in selected)
                    if not plausible_math(native_text):
                        continue
                    reason = structural_evidence(selected)
                    if reason:
                        detected = str(item.label.value) == "formula"
                        recovered[item.self_ref] = {
                            "formula_detection": "docling_layout"
                            if detected
                            else "native_geometry",
                            "formula_geometry": reason,
                            "original_text": item.text,
                            "native_text": native_text,
                        }
                        item.label = formula_label
                        visible = [rect for char, rect, _ in selected if char.strip()]
                        ink = (
                            min(r[0] for r in visible),
                            min(r[1] for r in visible),
                            max(r[2] for r in visible),
                            max(r[3] for r in visible),
                        )
                        # Refine small font-metric discrepancies, not the region itself.
                        # Keeping glyph ink bounds avoids descender whitespace changing
                        # the visual formula crop while tables retain the native parser.
                        if small_ink_crop(box, ink):
                            item.prov[0].bbox = box.model_copy(
                                update=dict(zip(("l", "b", "r", "t"), ink, strict=True))
                            )
                            recovered[item.self_ref]["formula_crop"] = "native_ink"
            finally:
                textpage.close()
                page.close()
    return recovered
