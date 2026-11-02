import sys
import types
import zipfile
from pathlib import Path

import pytest

from dabook.backends.structured import EpubExtractor, typography_levels
from tests.conftest import Pipeline


def make_epub(path: Path, href="chapter.xhtml"):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(
            "META-INF/container.xml",
            '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
        )
        z.writestr(
            "OPS/book.opf",
            f'<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Orbit manual</dc:title></metadata><manifest><item id="c1" href="{href}" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>',
        )
        z.writestr(
            "OPS/chapter.xhtml",
            '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Ignore</title></head><body><h1>Orbit basics</h1><p>The observatory tracks satellites in a stable orbit and calibrates instruments every Thursday. This is a source document for testing book ingestion and section preservation.</p><h2>Measurements</h2><table><tr><th>Unit</th><th>Value</th></tr><tr><td>km</td><td>42</td></tr></table><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>E</mi><mo>=</mo><mi>mc</mi><mn>2</mn></math></body></html>',
        )


def test_epub_enters_the_same_book_graph(tmp_path):
    book = tmp_path / "orbit.epub"
    make_epub(book)
    pipeline = Pipeline(tmp_path / "ws")
    try:
        result = pipeline.enqueue(book)
        pipeline.drain()
        assert pipeline.book(result.book_id)["state"] == "done"
        records = pipeline.dataset(result.book_id, "rag")
        assert records
        assert any("Orbit basics" in str(r) for r in records)
        assert any("Unit | Value" in str(r) for r in records)
    finally:
        pipeline.close()


def test_epub_rejects_external_spine_references(tmp_path):
    import pytest

    book = tmp_path / "bad.epub"
    make_epub(book, "https://example.org/evil.xhtml")
    with pytest.raises((ValueError, KeyError)):
        EpubExtractor(book)


def test_epub_rejects_entities_in_utf16_xml(tmp_path):
    import pytest
    from defusedxml.common import DefusedXmlException

    book = tmp_path / "entities.epub"
    with zipfile.ZipFile(book, "w") as archive:
        archive.writestr(
            "META-INF/container.xml",
            (
                '<?xml version="1.0" encoding="utf-16"?><!DOCTYPE container [<!ENTITY x "payload">]><container>&x;</container>'
            ).encode("utf-16"),
        )
    with pytest.raises(DefusedXmlException):
        EpubExtractor(book)


def test_typography_clusters_relative_to_weighted_body():
    def b(text, size):
        return {"block_type": "paragraph", "raw_text": text, "font_size": size}

    assert typography_levels(
        [{"blocks": [b("body " * 100, 10), b("Chapter", 24), b("Section", 16)]}]
    ) == {24: 0, 16: 1}


@pytest.mark.parametrize("device", ["cpu", "cuda:0"])
def test_docling_keeps_table_and_formula_types(tmp_path, monkeypatch, device):
    from dabook.backends.structured import DoclingExtractor

    monkeypatch.setattr("dabook.backends.formulas.recover_native_formulas", lambda *args: {})
    monkeypatch.setattr("dabook.backends.table_quality.warn_rotated_tables", lambda *args: None)

    bbox = types.SimpleNamespace(l=10, t=20, r=200, b=100)
    bbox.to_top_left_origin = lambda **kwargs: bbox
    prov = [types.SimpleNamespace(page_no=1, bbox=bbox)]
    table = types.SimpleNamespace(
        prov=prov,
        label=types.SimpleNamespace(value="table"),
        export_to_markdown=lambda **kwargs: "| Unit | Value |\n| km | 42 |",
    )
    formula = types.SimpleNamespace(
        prov=prov, label=types.SimpleNamespace(value="formula"), text=r"E=mc^2"
    )
    document = types.SimpleNamespace(
        pages={1: types.SimpleNamespace(size=types.SimpleNamespace(width=612, height=792))},
        iterate_items=lambda: [(table, 1), (formula, 1)],
    )

    configuration = {}

    class Converter:
        def __init__(self, **kwargs):
            configuration.update(kwargs["format_options"]["pdf"])

        def convert(self, source):
            return types.SimpleNamespace(document=document)

    monkeypatch.setitem(
        sys.modules,
        "docling.document_converter",
        types.SimpleNamespace(DocumentConverter=Converter, PdfFormatOption=lambda **kwargs: kwargs),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.backend.docling_parse_backend",
        types.SimpleNamespace(ThreadedDoclingParseDocumentBackend=object),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.datamodel.base_models",
        types.SimpleNamespace(InputFormat=types.SimpleNamespace(PDF="pdf")),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.datamodel.backend_options",
        types.SimpleNamespace(
            ThreadedDoclingParseBackendOptions=lambda **kwargs: types.SimpleNamespace(**kwargs)
        ),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.datamodel.pipeline_options",
        types.SimpleNamespace(
            PdfPipelineOptions=lambda **kwargs: types.SimpleNamespace(
                accelerator_options=types.SimpleNamespace(device=device), **kwargs
            ),
            CodeFormulaVlmOptions=types.SimpleNamespace(
                from_preset=lambda *args, **kwargs: types.SimpleNamespace(**kwargs)
            ),
        ),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.datamodel.vlm_engine_options",
        types.SimpleNamespace(TransformersVlmEngineOptions=lambda **kwargs: kwargs),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.utils.accelerator_utils",
        types.SimpleNamespace(decide_device=lambda selected: selected),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling.pipeline.standard_pdf_pipeline",
        types.SimpleNamespace(StandardPdfPipeline=object),
    )
    monkeypatch.setitem(
        sys.modules,
        "docling_core.types.doc",
        types.SimpleNamespace(DocItemLabel=types.SimpleNamespace(FORMULA="formula")),
    )
    page = DoclingExtractor(tmp_path / "unused.pdf").extract_page(0)
    assert [b.block_type for b in page.blocks] == ["table", "equation"]
    assert page.blocks[1].raw_text == r"E=mc^2"
    assert configuration["backend"] is object
    assert configuration["backend_options"].render_pages is True
    formula_options = configuration["pipeline_options"].code_formula_options
    assert formula_options.expansion_factor == 0.08
    if device == "cpu":
        assert formula_options.engine_options == {"torch_dtype": "float32", "load_in_8bit": False}
    else:
        assert not hasattr(formula_options, "engine_options")


def test_scanned_pdf_ocr_reaches_searchable_output(tmp_path, pdf_dir, monkeypatch):
    # Installing OCR alone must not make Docling a required dependency.
    monkeypatch.setitem(sys.modules, "docling", None)
    text = (
        "Scanned observatory maintenance instructions include Thursday calibration and satellite orbit measurements. "
        * 8
    )

    class Engine:
        def __init__(self, **kwargs):
            pass

        def __call__(self, image):
            return ([[[[300, 800], [1800, 800], [1800, 1100], [300, 1100]], text, 0.99]], 0.01)

    monkeypatch.setitem(sys.modules, "rapidocr_onnxruntime", types.SimpleNamespace(RapidOCR=Engine))
    pipeline = Pipeline(tmp_path / "ocr-ws", extract={"routing": {"scanned": "ocr"}})
    try:
        result = pipeline.enqueue(pdf_dir / "scanned.pdf")
        pipeline.drain()
        assert pipeline.book(result.book_id)["state"] == "done"
        assert any(
            "Thursday calibration" in str(r) for r in pipeline.dataset(result.book_id, "rag")
        )
    finally:
        pipeline.close()


def test_empty_ocr_is_not_done(tmp_path, pdf_dir, monkeypatch):
    class Engine:
        def __init__(self, **kwargs):
            pass

        def __call__(self, image):
            return (None, 0)

    monkeypatch.setitem(sys.modules, "rapidocr_onnxruntime", types.SimpleNamespace(RapidOCR=Engine))
    pipeline = Pipeline(tmp_path / "empty-ws", extract={"routing": {"scanned": "ocr"}})
    try:
        result = pipeline.enqueue(pdf_dir / "scanned.pdf")
        pipeline.drain()
        assert pipeline.book(result.book_id)["state"] == "needs_input"
    finally:
        pipeline.close()


def test_docling_converts_once_after_replanning_a_multishard_book(tmp_path, tech_pdf, monkeypatch):
    import json

    from dabook.backends.pdfium import PdfiumExtractor
    from dabook.core.scheduler.planner import compute_stage_keys
    from dabook.stages import runner

    calls = []
    original = runner.open_source

    def source(path, params, *, inspect=False):
        if params.get("backend") == "docling" and not inspect:
            calls.append(path)
            return PdfiumExtractor(path)
        return original(path, params, inspect=inspect)

    monkeypatch.setattr(runner, "open_source", source)
    pipeline = Pipeline(tmp_path / "unsharded-ws", limits={"shard_pages": 2})
    try:
        result = pipeline.enqueue(tech_pdf)
        pipeline.drain()
        count = lambda: pipeline.con.execute(
            "SELECT COUNT(*) FROM tasks WHERE book_id=? AND stage='s02_extract'", (result.book_id,)
        ).fetchone()[0]
        assert count() == 4
        pipeline.enqueue(tech_pdf, {**pipeline.params, "backend": "docling"})
        pipeline.drain()
        assert pipeline.book(result.book_id)["state"] == "done"
        assert count() == 1
        assert calls == [tech_pdf]
        task = pipeline.con.execute(
            "SELECT output_path FROM tasks WHERE book_id=? AND stage='s02_extract'",
            (result.book_id,),
        ).fetchone()
        pages = json.loads((Path(task["output_path"]) / "pages.json").read_text(encoding="utf-8"))[
            "pages"
        ]
        assert [page["page_idx"] for page in pages] == list(range(8))
        sha = pipeline.book(result.book_id)["sha256"]
        assert compute_stage_keys(
            sha, 200, {"backend": "docling"}, shard_pages=2
        ) == compute_stage_keys(sha, 200, {"backend": "docling"}, shard_pages=20)
    finally:
        pipeline.close()


def test_docling_native_backend_supplies_a_page_image_without_models(tech_pdf):
    pytest.importorskip("docling")
    pytest.importorskip("docling_parse")
    from docling.backend.docling_parse_backend import ThreadedDoclingParseDocumentBackend
    from docling.datamodel.backend_options import ThreadedDoclingParseBackendOptions
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.document import InputDocument

    document = InputDocument(
        path_or_stream=tech_pdf,
        format=InputFormat.PDF,
        backend=ThreadedDoclingParseDocumentBackend,
        backend_options=ThreadedDoclingParseBackendOptions(render_pages=True, parser_threads=1),
    )
    try:
        assert document.valid
        page = next(document._backend.iter_pages())
        image = page.get_page_image(scale=1)
        try:
            assert image.width > 0 and image.height > 0
            assert any(low < high for low, high in image.getextrema())
        finally:
            image.close()
    finally:
        document._backend.unload()
