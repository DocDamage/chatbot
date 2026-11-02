"""PdfiumExtractor behaviour on generated PDFs: bold, monospace, columns, title."""

from __future__ import annotations

from pathlib import Path

from dabook.backends.pdfium import PdfiumExtractor, _split_columns


def test_bold_headings_split_from_body_and_are_typed(pdf_dir: Path) -> None:
    with PdfiumExtractor(pdf_dir / "technical.pdf") as ext:
        page = ext.extract_page(2)  # first chapter page
    headings = [b for b in page.blocks if b.block_type == "heading"]
    assert [h.raw_text for h in headings] == [
        "Chapter 1 Partition Basics 1",
        "Using the Command Line 1",
    ]
    assert all(h.is_bold for h in headings)
    # the chapter title must not be fused with the paragraph beneath it
    assert not any("Select the partition" in h.raw_text for h in headings)


def test_monospace_blocks_are_code(pdf_dir: Path) -> None:
    with PdfiumExtractor(pdf_dir / "technical.pdf") as ext:
        page = ext.extract_page(2)
    code = [b for b in page.blocks if b.block_type == "code"]
    assert len(code) == 2
    assert code[0].raw_text.startswith("$ sudo testdisk")
    assert code[1].raw_text.startswith("#include <stdio.h>")


def test_two_column_page_yields_column_clean_blocks(pdf_dir: Path) -> None:
    with PdfiumExtractor(pdf_dir / "twocol.pdf") as ext:
        page = ext.extract_page(0)
    body = [b for b in page.blocks if b.block_type == "paragraph" and b.bbox[1] < 700]
    mid = page.width / 2
    # every body block lives entirely in one column; none straddles the gutter
    assert body
    assert all(b.bbox[2] <= mid + 10 or b.bbox[0] >= mid - 10 for b in body)
    left = [b for b in body if b.bbox[2] <= mid + 10]
    right = [b for b in body if b.bbox[0] >= mid - 10]
    assert left and right


def test_single_column_page_is_not_split(pdf_dir: Path) -> None:
    with PdfiumExtractor(pdf_dir / "technical.pdf") as ext:
        page = ext.extract_page(3)
    # two long paragraphs spanning the page width stay whole
    assert any(len(b.raw_text.split()) > 60 for b in page.blocks)


def test_split_columns_leaves_sparse_pages_alone() -> None:
    spans = [{"x0": 70.0, "x1": 500.0, "y0": float(i * 14), "y1": float(i * 14 + 10)} for i in range(20)]
    assert _split_columns(spans, 612.0) == [spans]


def test_title_and_text_layer_probe(pdf_dir: Path) -> None:
    with PdfiumExtractor(pdf_dir / "technical.pdf") as ext:
        assert ext.extract_title() == "Disk Recovery Handbook"
        assert ext.page_char_count(2) > 500
    with PdfiumExtractor(pdf_dir / "scanned.pdf") as ext:
        assert ext.extract_title() is None
        assert all(ext.page_char_count(i) == 0 for i in range(ext.page_count()))


def test_outline_is_extracted_with_levels(pdf_dir: Path) -> None:
    with PdfiumExtractor(pdf_dir / "technical.pdf") as ext:
        toc = ext.extract_toc()
    assert [t.level for t in toc] == [0, 1, 0, 1, 0, 1]
    assert toc[0].title == "Chapter 1 Partition Basics 1"
    with PdfiumExtractor(pdf_dir / "no_outline.pdf") as ext:
        assert ext.extract_toc() == []
