"""Prepare version-pinned published-book excerpts for local Docling validation.

Source PDFs and page images stay in the requested local directory. No source
document is uploaded. See each source's license before redistributing excerpts.
"""

import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

import pypdfium2 as pdfium

SOURCES = [
    {
        "id": "calculus-made-easy",
        "title": "Calculus Made Easy, second edition",
        "authors": "Silvanus P. Thompson",
        "url": "https://www.gutenberg.org/files/33283/33283-pdf.pdf",
        "license": "Public domain in the USA; Project Gutenberg distribution terms apply",
        "license_url": "https://www.gutenberg.org/ebooks/33283/",
        "sha256": "0a6957ae86625bbabcb71e070ef32e5dc7197cebb8bf90f0275caab45e71baf6",
        "pdf_pages": [28, 29],
    },
    {
        "id": "openintro-statistics",
        "title": "OpenIntro Statistics, fourth edition, screen reader version (2022-10-21)",
        "authors": "David M. Diez, Mine Cetinkaya-Rundel, Christopher D. Barr",
        "url": "https://www.openintro.org/go?id=os4_for_screen_reader&referrer=%2Fbook%2Fos%2Findex.php",
        "license": "CC BY-SA 3.0; source attribution, exceptions and branding terms apply",
        "license_url": "https://www.openintro.org/license/",
        "sha256": "63323c3afc9d68c84ef130bdfa99e3828f080240251f5b7657480db3e355b3eb",
        "pdf_pages": [14, 16, 17, 47, 54],
    },
]


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def prepare(directory: Path, *, download: bool = False):
    directory.mkdir(parents=True, exist_ok=True)
    records = []
    for source in SOURCES:
        file = directory / f"{source['id']}.pdf"
        if not file.exists() and download:
            # Fixed public URLs, bounded download and timeout; never follows input URLs.
            with urlopen(source["url"], timeout=45) as response:
                data = response.read(32 * 1024 * 1024 + 1)
            if len(data) > 32 * 1024 * 1024:
                raise ValueError("Book download exceeds 32 MiB")
            if hashlib.sha256(data).hexdigest() != source["sha256"]:
                raise ValueError(f"Source edition changed: {source['id']}")
            file.write_bytes(data)
        if file.stat().st_size > 32 * 1024 * 1024 or digest(file) != source["sha256"]:
            raise ValueError(f"Source edition changed: {source['id']}")
        excerpt_file = directory / f"{source['id']}-excerpt.pdf"
        images = []
        with pdfium.PdfDocument(file) as document:
            total_pages = len(document)
            excerpt = pdfium.PdfDocument.new()
            try:
                excerpt.import_pages(document, [n - 1 for n in source["pdf_pages"]])
                excerpt.save(excerpt_file)
            finally:
                excerpt.close()
            for number in source["pdf_pages"]:
                page = document[number - 1]
                try:
                    bitmap = page.render(scale=1.5)
                    try:
                        image = bitmap.to_pil()
                        try:
                            name = f"{source['id']}-{number}.png"
                            image.save(directory / name)
                            images.append({"pdf_page": number, "file": name})
                        finally:
                            image.close()
                    finally:
                        bitmap.close()
                finally:
                    page.close()
        records.append(
            {
                **source,
                "source_pages": total_pages,
                "excerpt_file": excerpt_file.name,
                "excerpt_sha256": digest(excerpt_file),
                "images": images,
            }
        )
    manifest = {
        "scope": "Selected published-book pages; not a full-book accuracy estimate",
        "sources": records,
    }
    (directory / "sources.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--download", action="store_true")
    arguments = parser.parse_args()
    print(
        json.dumps(prepare(arguments.directory, download=arguments.download), indent=2)
    )
