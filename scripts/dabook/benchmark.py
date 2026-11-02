"""Compare optional structured backends on local fixtures; no quality claims from timing alone."""

import argparse
import faulthandler
import json
import logging
import time
from pathlib import Path

from dabook.backends.structured import open_source

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--docling", action="store_true")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--timeout-s", type=int, default=300)
    args = parser.parse_args()
    faulthandler.dump_traceback_later(args.timeout_s, exit=True)
    results = []
    for backend in (
        ["pdfium_pdfminer", "docling"] if args.docling else ["pdfium_pdfminer"]
    ):
        started = time.monotonic()
        print(f"Benchmarking {backend}", flush=True)
        try:
            with open_source(args.source, {"backend": backend}) as ext:
                pages = [ext.extract_page(i) for i in range(ext.page_count())]
            result = {
                "backend": backend,
                "pages": len(pages),
                "chars": sum(p.char_count for p in pages),
                "tables": sum(b.block_type == "table" for p in pages for b in p.blocks),
                "equations": sum(
                    b.block_type == "equation" for p in pages for b in p.blocks
                ),
                "text": "\n".join(b.raw_text for p in pages for b in p.blocks),
                "blocks": [
                    {
                        "page": p.page_idx,
                        "bbox": b.bbox,
                        "type": b.block_type,
                        "text": b.raw_text,
                        "metadata": b.metadata,
                    }
                    for p in pages
                    for b in p.blocks
                ],
            }
        except Exception as error:
            logger.exception("Extraction backend failed")
            result = {"backend": backend, "error": str(error)}
        result["seconds"] = round(time.monotonic() - started, 3)
        results.append(result)
        args.out.write_text(
            json.dumps(
                {"source": str(args.source.resolve()), "results": results}, indent=2
            ),
            encoding="utf-8",
        )
    faulthandler.cancel_dump_traceback_later()
    if any("error" in result for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
