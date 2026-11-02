"""Conservative native-text warnings for sideways structured table regions."""

import math

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_raw


def warn_rotated_tables(pages, source):
    """Retain table output/provenance, but require review for mostly sideways text.

    This checks native text only. It does not certify scanned tables or attempt
    to rotate content and silently change source coordinates. Explicit PDF page
    rotations are left to the upstream renderer because their coordinates need
    a separate transform.
    """
    candidates = [page for page in pages if any(b.block_type == "table" for b in page.blocks)]
    if not candidates:
        return
    with pdfium.PdfDocument(source) as document:
        for output in candidates:
            if not 0 <= output.page_idx < len(document):
                continue
            page = document[output.page_idx]
            try:
                if page.get_rotation() != 0:
                    continue
                text = page.get_textpage()
                try:
                    count = text.count_chars()
                    tables = [b for b in output.blocks if b.block_type == "table"]
                    if count > 100000:
                        for block in tables:
                            block.metadata["quality_warning"] = (
                                "table_orientation_unchecked_char_limit"
                            )
                        continue
                    glyphs = []
                    for index in range(count):
                        if not text.get_text_range(index, 1).strip():
                            continue
                        box = text.get_charbox(index)
                        angle = math.degrees(pdfium_raw.FPDFText_GetCharAngle(text, index)) % 180
                        glyphs.append(
                            (
                                (box[0] + box[2]) / 2,
                                page.get_height() - (box[1] + box[3]) / 2,
                                angle,
                            )
                        )
                    for block in tables:
                        left, top, right, bottom = block.bbox
                        angles = [
                            angle
                            for x, y, angle in glyphs
                            if left <= x <= right and top <= y <= bottom
                        ]
                        if (
                            len(angles) >= 12
                            and sum(75 <= angle <= 105 for angle in angles) / len(angles) >= 0.75
                        ):
                            block.metadata["quality_warning"] = "rotated_table_requires_review"
                            block.metadata["orientation_check"] = "native_glyph_angles"
                finally:
                    text.close()
            finally:
                page.close()
