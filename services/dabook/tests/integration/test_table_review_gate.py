import json
from pathlib import Path

from dabook.backends.pdfium import PdfiumExtractor
from dabook.core.governance import export_decision
from dabook.stages import runner
from tests.conftest import Pipeline


def test_table_warning_survives_graph_and_blocks_unreviewed_training(
    tmp_path, tech_pdf, monkeypatch
):
    class FlaggedExtractor(PdfiumExtractor):
        def extract_page(self, index):
            page = super().extract_page(index)
            if index == 0:
                block = max(
                    (b for b in page.blocks if b.block_type == "paragraph"),
                    key=lambda b: len(b.raw_text),
                )
                block.block_type = "table"
                block.metadata.update(
                    structured_type=True, quality_warning="rotated_table_requires_review"
                )
            return page

    monkeypatch.setattr(
        runner, "open_source", lambda source, params, **kwargs: FlaggedExtractor(source)
    )
    pipeline = Pipeline(tmp_path / "ws", quality={"review_gate": True})
    try:
        result = pipeline.enqueue(tech_pdf)
        pipeline.drain()
        row = pipeline.book(result.book_id)
        assert row["state"] == "review"
        assert row["quality_score"] < 0.70
        task = pipeline.con.execute(
            "SELECT output_path FROM tasks WHERE book_id=? AND stage='s11_validate'",
            (result.book_id,),
        ).fetchone()
        validation = json.loads((Path(task["output_path"]) / "validation.json").read_text())
        assert validation["review_regions"] == 1
        assert validation["review_required"]
        pipeline.con.execute(
            "UPDATE books SET license_status='owned' WHERE id=?", (result.book_id,)
        )
        pipeline.con.commit()
        decision = export_decision(pipeline.book(result.book_id), quality_verified=0.95)
        assert not decision.eligible
        assert any("review it first" in reason for reason in decision.reasons)
    finally:
        pipeline.close()
