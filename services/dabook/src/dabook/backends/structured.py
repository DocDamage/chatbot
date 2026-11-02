"""Optional Phase 5 backends sharing the page/Book Graph contract."""

from __future__ import annotations

import math
import posixpath
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

from defusedxml.ElementTree import fromstring as parse_xml

from dabook.backends.pdfium import PdfiumExtractor
from dabook.ir.models import PageData, RawBlock, TocItem


class EpubExtractor:
    """Read EPUB spine order without extracting files or fetching external resources."""

    def __init__(self, source: Path):
        self.pages: list[PageData] = []
        self.toc: list[TocItem] = []
        self.title = source.stem
        with zipfile.ZipFile(source) as archive:
            infos = archive.infolist()
            names = [posixpath.normpath(unquote(i.filename)) for i in infos]
            if len(set(names)) != len(names):
                raise ValueError("EPUB contains duplicate member names")
            if len(infos) > 10000 or sum(i.file_size for i in infos) > 128 * 1024 * 1024:
                raise ValueError("EPUB exceeds archive limits")

            def read(name: str):
                parts = urlsplit(name)
                name = posixpath.normpath(unquote(parts.path))
                if parts.scheme or parts.netloc or name.startswith(("/", "../")) or "\\" in name:
                    raise ValueError("Unsafe EPUB member path")
                if archive.getinfo(name).file_size > 8 * 1024 * 1024:
                    raise ValueError("EPUB member exceeds size limit")
                data = archive.read(name)
                if b"<!ENTITY" in data.upper():
                    raise ValueError("EPUB XML declarations are not supported")
                return parse_xml(data)

            container = read("META-INF/container.xml")
            package_path = next(
                e.attrib["full-path"] for e in container.iter() if e.tag.endswith("rootfile")
            )
            package = read(package_path)
            self.title = next(
                ("".join(e.itertext()).strip() for e in package.iter() if e.tag.endswith("}title")),
                source.stem,
            )
            manifest = {e.attrib["id"]: e.attrib for e in package.iter() if e.tag.endswith("}item")}
            spine = [
                e.attrib["idref"]
                for e in package.iter()
                if e.tag.endswith("}itemref") and e.attrib.get("linear", "yes") != "no"
            ]
            for ref in spine:
                item = manifest[ref]
                if item.get("media-type") not in ("application/xhtml+xml", "text/html"):
                    continue
                href = posixpath.join(posixpath.dirname(package_path), item["href"])
                root = read(href)
                for parent in root.iter():
                    for child in list(parent):
                        if child.tag.rsplit("}", 1)[-1].lower() in ("script", "style", "nav"):
                            parent.remove(child)
                blocks: list[RawBlock] = []
                page_idx = len(self.pages)

                def visit(element, href=href, page_idx=page_idx, blocks=blocks):
                    tag = element.tag.rsplit("}", 1)[-1].lower()
                    if tag in ("script", "style", "nav", "head", "header", "footer"):
                        return
                    if tag in (
                        "h1",
                        "h2",
                        "h3",
                        "h4",
                        "h5",
                        "h6",
                        "p",
                        "pre",
                        "table",
                        "math",
                        "li",
                    ):
                        text = " ".join("".join(element.itertext()).split())
                        if tag == "pre":
                            text = "".join(element.itertext()).strip()
                        kind = (
                            "heading"
                            if tag.startswith("h")
                            else {
                                "pre": "code",
                                "table": "table",
                                "math": "equation",
                                "li": "list_item",
                            }.get(tag, "paragraph")
                        )
                        if tag == "table":
                            text = "\n".join(
                                " | ".join(
                                    " ".join("".join(c.itertext()).split())
                                    for c in row
                                    if c.tag.rsplit("}", 1)[-1] in ("td", "th")
                                )
                                for row in element.iter()
                                if row.tag.endswith("}tr") or row.tag == "tr"
                            )
                        if text:
                            metadata = {
                                "epub_href": href,
                                "backend": "epub",
                                "structured_type": True,
                            }
                            if tag == "math":
                                metadata["mathml"] = ET.tostring(element, encoding="unicode")
                            if kind == "heading":
                                metadata["level"] = int(tag[1]) - 1
                                self.toc.append(
                                    TocItem(title=text, level=int(tag[1]) - 1, page_idx=page_idx)
                                )
                            blocks.append(
                                RawBlock(
                                    block_id=f"epub:{page_idx}:{len(blocks)}",
                                    page_idx=page_idx,
                                    bbox=[0, len(blocks) * 20, 600, len(blocks) * 20 + 18],
                                    raw_text=text,
                                    block_type=kind,
                                    metadata=metadata,
                                )
                            )
                        return
                    for child in element:
                        visit(child)

                visit(root)
                self.pages.append(
                    PageData(
                        page_idx=page_idx,
                        width=612,
                        height=max(792, len(blocks) * 20 + 40),
                        blocks=blocks,
                        char_count=sum(len(b.raw_text) for b in blocks),
                    )
                )
        if not self.pages or not any(p.char_count for p in self.pages):
            raise ValueError("EPUB has no readable spine content")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def page_count(self):
        return len(self.pages)

    def page_char_count(self, index):
        return self.pages[index].char_count

    def extract_title(self):
        return self.title

    def extract_toc(self):
        return self.toc

    def extract_page(self, index):
        return self.pages[index].model_copy(deep=True)


class OcrPdfExtractor(PdfiumExtractor):
    def __init__(self, source: Path, params: dict):
        super().__init__(source)
        self.params = params
        self.engine = None

    def extract_page(self, index):
        page = super().extract_page(index)
        if page.char_count >= 25:
            return page
        if self.engine is None:
            try:
                from rapidocr_onnxruntime import RapidOCR
            except ImportError as exc:
                raise RuntimeError("RapidOCR unavailable; install dabook[ocr]") from exc
            self.engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=2)
        native = self.doc[index]
        bitmap = None
        try:
            dpi = self.params.get("ocr_dpi", 300)
            if not isinstance(dpi, (int, float)) or not math.isfinite(dpi) or not 72 <= dpi <= 600:
                raise ValueError("OCR DPI must be between 72 and 600")
            scale = dpi / 72
            if native.get_width() * native.get_height() * scale * scale > 40_000_000:
                raise ValueError("OCR page exceeds 40 megapixel limit")
            bitmap = native.render(scale=scale)
            result, _ = self.engine(bitmap.to_numpy())
            blocks = []
            for i, (box, text, confidence) in enumerate(result or []):
                if not text.strip():
                    continue
                xs, ys = [float(p[0]) / scale for p in box], [float(p[1]) / scale for p in box]
                blocks.append(
                    RawBlock(
                        block_id=f"ocr:{index}:{i}",
                        page_idx=index,
                        bbox=[min(xs), min(ys), max(xs), max(ys)],
                        raw_text=text.strip(),
                        confidence=float(confidence),
                        metadata={"backend": "rapidocr", "ocr": True},
                    )
                )
            page.blocks = blocks
            page.char_count = sum(len(b.raw_text) for b in blocks)
            page.is_scanned = True
            if not page.char_count:
                raise ValueError("RapidOCR produced no usable text")
            return page
        finally:
            if bitmap is not None:
                bitmap.close()
            native.close()


class DoclingExtractor(EpubExtractor):
    def __init__(self, source: Path):
        try:
            from docling.backend.docling_parse_backend import ThreadedDoclingParseDocumentBackend
            from docling.datamodel.backend_options import ThreadedDoclingParseBackendOptions
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import CodeFormulaVlmOptions, PdfPipelineOptions
            from docling.datamodel.vlm_engine_options import TransformersVlmEngineOptions
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
            from docling.utils.accelerator_utils import decide_device
            from docling_core.types.doc import DocItemLabel
        except ImportError as exc:
            raise RuntimeError("Docling unavailable; install dabook[docling]") from exc
        from dabook.backends.formulas import recover_native_formulas

        recovered = {}

        class FormulaRecoveryPipeline(StandardPdfPipeline):
            def _enrich_document(self, conversion):
                recovered.update(
                    recover_native_formulas(conversion.document, source, DocItemLabel.FORMULA)
                )
                return super()._enrich_document(conversion)

        options = PdfPipelineOptions(
            do_table_structure=True, do_formula_enrichment=True, document_timeout=120
        )
        options.code_formula_options = CodeFormulaVlmOptions.from_preset(
            "codeformulav2", expansion_factor=0.08, stop_on_repetition=True
        )
        if decide_device(options.accelerator_options.device) == "cpu":
            # BF16 can be prohibitively slow without native CPU arithmetic;
            # choose FP32 for the CPU fallback and retain accelerator defaults.
            options.code_formula_options.engine_options = TransformersVlmEngineOptions(
                torch_dtype="float32", load_in_8bit=False
            )
        document = (
            DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_cls=FormulaRecoveryPipeline,
                        pipeline_options=options,
                        backend=ThreadedDoclingParseDocumentBackend,
                        backend_options=ThreadedDoclingParseBackendOptions(render_pages=True),
                    )
                }
            )
            .convert(source)
            .document
        )
        self.title, self.toc = source.stem, []
        self.pages = [
            PageData(page_idx=n - 1, width=p.size.width, height=p.size.height)
            for n, p in sorted(document.pages.items())
        ]
        for i, (item, _level) in enumerate(document.iterate_items()):
            if not getattr(item, "prov", None):
                continue
            prov = item.prov[0]
            idx = prov.page_no - 1
            label = str(item.label.value)
            kind = {
                "section_header": "heading",
                "title": "heading",
                "formula": "equation",
                "table": "table",
                "code": "code",
            }.get(label, "paragraph")
            text = (
                item.export_to_markdown(doc=document)
                if kind == "table"
                else getattr(item, "text", "")
            )
            if not text.strip():
                continue
            page = self.pages[idx]
            box = prov.bbox.to_top_left_origin(page_height=page.height)
            metadata = {
                "backend": "docling",
                "pdf_parser": "docling_parse",
                "pdf_renderer": "docling_parse",
                "structured_type": True,
                "level": max(0, (getattr(item, "level", None) or 1) - 1),
            }
            if kind == "equation":
                metadata.update(
                    {
                        "formula_detection": "docling_layout",
                        **recovered.get(getattr(item, "self_ref", ""), {}),
                    }
                )
            page.blocks.append(
                RawBlock(
                    block_id=f"docling:{idx}:{i}",
                    page_idx=idx,
                    bbox=[box.l, box.t, box.r, box.b],
                    raw_text=text,
                    block_type=kind,
                    metadata=metadata,
                )
            )
            page.char_count += len(text)

        from dabook.backends.table_quality import warn_rotated_tables

        warn_rotated_tables(self.pages, source)


def open_source(source: Path, params: dict, *, inspect: bool = False):
    if source.suffix.lower() == ".epub":
        return EpubExtractor(source)
    if not inspect and params.get("backend") == "docling":
        return DoclingExtractor(source)
    if not inspect and params.get("routing", {}).get("scanned") == "ocr":
        return OcrPdfExtractor(source, params)
    return PdfiumExtractor(source)


def typography_levels(pages: list[dict]) -> dict[float, int]:
    """Character-weighted body size and distinct larger heading-size clusters."""
    weights: dict[float, int] = {}
    for page in pages:
        for b in page["blocks"]:
            if b["block_type"] not in ("paragraph", "heading"):
                continue
            size = round(float(b.get("font_size", 10)))
            weights[size] = weights.get(size, 0) + len(b["raw_text"])
    body = max(weights, key=weights.get) if weights else 10
    sizes = sorted((s for s in weights if s >= body * 1.2), reverse=True)
    return {size: min(level, 5) for level, size in enumerate(sizes)}
