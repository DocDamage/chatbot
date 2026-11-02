from reportlab.pdfgen import canvas

from dabook.backends.table_quality import warn_rotated_tables
from dabook.ir.models import PageData, RawBlock
from dabook.stages.runner import score_quality


def make_page(tmp_path, angle):
    source = tmp_path / f"table-{angle}.pdf"
    drawing = canvas.Canvas(str(source), pagesize=(400, 400))
    drawing.translate(200, 150)
    drawing.rotate(angle)
    drawing.drawString(0, 0, "County Population Rate")
    drawing.drawString(0, 18, "Autauga 55504 1.48")
    drawing.save()
    block = RawBlock(
        block_id="table:0",
        page_idx=0,
        bbox=[0, 0, 400, 400],
        raw_text="County Population Rate",
        block_type="table",
    )
    return source, PageData(page_idx=0, width=400, height=400, blocks=[block])


def test_sideways_native_table_requires_review_without_changing_content(tmp_path):
    source, page = make_page(tmp_path, 90)
    original = page.blocks[0].raw_text
    warn_rotated_tables([page], source)
    assert page.blocks[0].metadata["quality_warning"] == "rotated_table_requires_review"
    assert page.blocks[0].raw_text == original
    assert page.blocks[0].bbox == [0, 0, 400, 400]


def test_horizontal_native_table_is_not_flagged(tmp_path):
    source, page = make_page(tmp_path, 0)
    warn_rotated_tables([page], source)
    assert "quality_warning" not in page.blocks[0].metadata


def test_table_warning_lowers_confidence_below_default_review_and_export_thresholds():
    values = {
        "pages": 1,
        "words": 500,
        "headings": 1,
        "replacement_chars": 0,
        "chars": 3000,
        "empty_pages": 0,
        "failed_pages": 0,
    }
    assert score_quality(**values)[0] == 1
    score, reasons = score_quality(**values, review_regions=2)
    assert score < 0.70
    assert "2 structured region(s) require review" in reasons[-1]
