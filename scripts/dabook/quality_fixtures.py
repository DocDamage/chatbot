"""Generate local display-math and negative-control PDFs for extraction acceptance."""

import argparse
import json
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


def make_fixture(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    pdf = directory / "display-math.pdf"
    c = canvas.Canvas(str(pdf), pagesize=letter, invariant=1)
    c.setTitle("Display math extraction acceptance")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(60, 740, "Physics and algebra reference")
    c.setFont("Times-Roman", 12)
    c.drawString(
        60,
        708,
        "The following displayed equations define familiar physical relationships.",
    )

    c.setFont("Times-Italic", 22)
    c.drawString(150, 640, "E = mc")
    c.setFont("Times-Roman", 14)
    c.drawString(150 + stringWidth("E = mc", "Times-Italic", 22), 650, "2")

    c.setFont("Times-Italic", 22)
    c.drawString(150, 530, "v =")
    c.drawCentredString(213, 544, "d")
    c.line(200, 536, 226, 536)
    c.drawCentredString(213, 511, "t")

    c.drawString(100, 408, "x =")
    c.drawString(150, 426, "-b")
    c.setFont("Times-Roman", 22)
    c.drawString(178, 426, "±")
    radical = c.beginPath()
    radical.moveTo(201, 435)
    radical.lineTo(207, 430)
    radical.lineTo(212, 449)
    radical.lineTo(312, 449)
    c.drawPath(radical)
    c.setFont("Times-Italic", 22)
    c.drawString(218, 426, "b")
    c.setFont("Times-Roman", 14)
    c.drawString(229, 437, "2")
    c.setFont("Times-Italic", 22)
    c.drawString(240, 426, "- 4ac")
    c.line(147, 417, 314, 417)
    c.drawCentredString(229, 389, "2a")
    c.setFont("Times-Roman", 12)
    c.drawString(
        60,
        330,
        "These equations should retain powers and fraction structure in the output.",
    )
    c.showPage()

    c.setFont("Helvetica-Bold", 20)
    c.drawString(60, 740, "Text, code, and table controls")
    c.setFont("Times-Roman", 12)
    c.drawString(
        60, 700, "Set mode = safe before startup; this sentence is explanatory prose."
    )
    c.drawString(
        60,
        678,
        "The expression a = b appears inside a sentence, not as a displayed formula.",
    )
    c.setFillGray(0.94)
    c.rect(58, 540, 490, 90, fill=1, stroke=0)
    c.setFillGray(0)
    c.setFont("Courier", 12)
    for y, text in [
        (610, "def energy(m, c):"),
        (590, "    result = m * c ** 2"),
        (570, "    return result"),
    ]:
        c.drawString(70, y, text)
    c.setFont("Helvetica", 12)
    for y, left, right in [
        (476, "Quantity", "Value"),
        (450, "Distance", "42 km"),
        (424, "Period", "7 days"),
    ]:
        c.drawString(78, y, left)
        c.drawString(252, y, right)
    for y in (494, 468, 442, 416):
        c.line(68, y, 370, y)
    for x in (68, 240, 370):
        c.line(x, 416, x, 494)
    c.save()
    expected = {
        "source": pdf.name,
        "equations": [
            {
                "id": "energy",
                "page": 0,
                "bbox": [140, 125, 260, 165],
                "pattern": r"E=mc\^(?:2|\{2\})",
            },
            {
                "id": "speed",
                "page": 0,
                "bbox": [140, 230, 240, 290],
                "pattern": r"v=\\(?:d?frac)\{d\}\{t\}",
            },
            {
                "id": "quadratic",
                "page": 0,
                "bbox": [90, 332, 325, 410],
                "pattern": r"x=\\(?:d?frac)\{-b\\pm\\sqrt\{b\^(?:2|\{2\})-4ac\}\}\{2a\}",
            },
        ],
        "negative_control_page": 1,
        "table_rows": [
            ["Quantity", "Value"],
            ["Distance", "42 km"],
            ["Period", "7 days"],
        ],
    }
    (directory / "display-math.expected.json").write_text(
        json.dumps(expected, indent=2) + "\n", encoding="utf-8"
    )
    return pdf


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    print(make_fixture(parser.parse_args().directory))
