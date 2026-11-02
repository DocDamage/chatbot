"""Bounded, one-shot JSON OCR for Chatbot's flat PDF fallback."""

import argparse
import json
from pathlib import Path

from dabook.backends.structured import OcrPdfExtractor


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--max-pages", type=int, default=25)
    parser.add_argument("--dpi", type=int, default=180)
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 500 or not 72 <= args.dpi <= 600:
        parser.error("max-pages must be 1..500; dpi must be 72..600")
    texts, warnings = [], []
    with OcrPdfExtractor(args.source, {"ocr_dpi": args.dpi}) as ext:
        total = ext.page_count()
        attempted = min(total, args.max_pages)
        for index in range(attempted):
            page = ext.extract_page(index)
            text = "\n".join(b.raw_text for b in page.blocks).strip()
            if text:
                texts.append(f"PDF OCR page {index + 1}:\n{text}")
        if total > attempted:
            warnings.append(f"OCR limited to first {attempted} of {total} pages.")
    print(
        json.dumps(
            {
                "text": "\n\n".join(texts),
                "pages": attempted,
                "totalPages": total,
                "warnings": warnings,
            }
        )
    )


if __name__ == "__main__":
    main()
