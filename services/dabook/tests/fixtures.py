"""
Deterministic PDF fixtures for DABOOK tests (generated with reportlab, a dev-only dependency).

* ``make_technical_pdf``  born-digital manual: outline, running header/footer, dot-leader TOC
                          page, Courier code, shell commands, prose.
* ``make_two_column_pdf`` academic paper layout (two text columns, no outline).
* ``make_scanned_pdf``    image-only pages: no text layer at all.
"""

from __future__ import annotations

import io
import textwrap
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = letter  # 612 x 792

_SENTENCES = [
    "The recovery tool scans the partition table and rebuilds the boot sector from a backup copy.",
    "Always work on a disk image rather than the failing drive to avoid overwriting recoverable data.",
    "A damaged file system header can usually be repaired when the backup superblock is intact.",
    "Select the partition type that matches the original layout before writing any changes to disk.",
    "Quick search examines cylinder boundaries while deeper search reads every sector in sequence.",
    "Once the structure is confirmed, write the table and reboot so the operating system rescans it.",
    "Logs record every step so that an operation can be audited or reproduced at a later date.",
    "Large volumes take longer to analyse, therefore progress is reported after each completed pass.",
]


def paragraph(seed: int, sentences: int = 4) -> str:
    return " ".join(_SENTENCES[(seed + i) % len(_SENTENCES)] for i in range(sentences))


def _draw_wrapped(
    c: canvas.Canvas, text: str, x: float, y: float, width_chars: int, font: str, size: float
) -> float:
    c.setFont(font, size)
    for line in textwrap.wrap(text, width_chars):
        c.drawString(x, y, line)
        y -= size * 1.35
    return y - size * 0.6


def make_technical_pdf(path: Path, chapters: int = 3, *, with_outline: bool = True) -> Path:
    """A small manual. Page 1 title, page 2 dot-leader TOC, then two pages per chapter."""
    entries = [
        (f"Chapter {ch} Partition Basics {ch}", 3 + (ch - 1) * 2) for ch in range(1, chapters + 1)
    ]
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setTitle("Disk Recovery Handbook")
    c.setAuthor("Fixture Author")
    page_no = 0

    def furniture() -> None:
        c.setFont("Helvetica", 8)
        c.drawString(72, PAGE_H - 36, "Disk Recovery Handbook")
        c.drawCentredString(PAGE_W / 2, 30, str(page_no))

    page_no += 1
    c.setFont("Helvetica-Bold", 26)
    c.drawString(72, PAGE_H - 250, "Disk Recovery Handbook")
    furniture()
    c.showPage()

    # TOC page with dot leaders
    page_no += 1
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, PAGE_H - 100, "Contents")
    y = PAGE_H - 140
    c.setFont("Times-Roman", 11)
    for title, pg in entries:
        c.drawString(72, y, f"{title} " + "." * 40 + f" {pg}")
        y -= 16
        c.drawString(90, y, f"Using the Command Line " + "." * 36 + f" {pg}")
        y -= 16
    furniture()
    c.showPage()

    for ch in range(1, chapters + 1):
        page_no += 1
        key = f"ch{ch}"
        c.bookmarkPage(key)
        title = f"Chapter {ch} Partition Basics {ch}"
        if with_outline:
            c.addOutlineEntry(title, key, level=0)
        y = PAGE_H - 100
        c.setFont("Helvetica-Bold", 18)
        c.drawString(72, y, title)
        y -= 34
        y = _draw_wrapped(c, paragraph(ch * 3, 5), 72, y, 88, "Times-Roman", 11)
        y = _draw_wrapped(c, paragraph(ch * 3 + 1, 4), 72, y, 88, "Times-Roman", 11)

        sec_title = f"Using the Command Line {ch}"
        c.bookmarkPage(f"sec{ch}")
        if with_outline:
            c.addOutlineEntry(sec_title, f"sec{ch}", level=1)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(72, y, sec_title)
        y -= 24
        y = _draw_wrapped(
            c,
            "Run the tool from a shell and pass the image file as the only argument.",
            72,
            y,
            88,
            "Times-Roman",
            11,
        )
        c.setFont("Courier", 10)
        for cmd in (f"$ sudo testdisk /log /dev/sda{ch}", "$ photorec --version"):
            c.drawString(90, y, cmd)
            y -= 13
        y -= 8
        y = _draw_wrapped(c, "Alternatively type the following command:", 72, y, 88, "Times-Roman", 11)
        c.setFont("Times-Roman", 11)
        c.drawString(90, y, f"$ sudo apt install testdisk-{ch}")
        y -= 28
        y = _draw_wrapped(c, paragraph(ch * 3 + 2, 6), 72, y, 88, "Times-Roman", 11)
        c.setFont("Courier", 9)
        for line in (
            "#include <stdio.h>",
            "int main(void) {",
            f'    printf("chapter {ch}");',
            "    return 0;",
            "}",
        ):
            c.drawString(90, y, line)
            y -= 11
        furniture()
        c.showPage()

        page_no += 1
        y = PAGE_H - 100
        y = _draw_wrapped(c, paragraph(ch * 5, 7), 72, y, 88, "Times-Roman", 11)
        y = _draw_wrapped(c, paragraph(ch * 5 + 3, 7), 72, y, 88, "Times-Roman", 11)
        furniture()
        c.showPage()

    c.save()
    return path


def make_two_column_pdf(path: Path, pages: int = 3) -> Path:
    """Academic layout: title block spanning both columns, then two text columns. No outline."""
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setTitle("A Study of Sector Recovery")
    col_x = (60, 320)
    for p in range(1, pages + 1):
        y_top = PAGE_H - 90
        if p == 1:
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(PAGE_W / 2, PAGE_H - 70, "A Study of Sector Recovery")
            y_top = PAGE_H - 120
        for col, x in enumerate(col_x):
            y = y_top
            if col == 0:
                c.setFont("Helvetica-Bold", 12)
                c.drawString(x, y, f"{p}. Section {p}")
                y -= 20
            for k in range(3):
                y = _draw_wrapped(c, paragraph(p * 7 + col * 3 + k, 4), x, y, 46, "Times-Roman", 10)
        c.setFont("Helvetica", 8)
        c.drawCentredString(PAGE_W / 2, 30, str(p))
        c.showPage()
    c.save()
    return path


def make_scanned_pdf(path: Path, pages: int = 3) -> Path:
    """Image-only pages: a rasterised page with no text layer."""
    from PIL import Image, ImageDraw
    from reportlab.lib.utils import ImageReader

    img = Image.new("RGB", (612, 792), "white")
    draw = ImageDraw.Draw(img)
    for i in range(12):
        draw.rectangle([72, 100 + i * 40, 540, 118 + i * 40], fill=(40, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    c = canvas.Canvas(str(path), pagesize=letter)
    for _ in range(pages):
        buf.seek(0)
        c.drawImage(ImageReader(buf), 0, 0, width=PAGE_W, height=PAGE_H)
        c.showPage()
    c.save()
    return path
