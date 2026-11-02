"""Report pre-annotated published-book targets without inventing accuracy claims."""

import argparse
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from check_quality import normalize_formula, overlap_fraction


def cell_value(text):
    text = re.sub(r"\s+", " ", text.replace("_", " ")).strip()
    try:
        number = Decimal(text.replace(",", ""))
        return number if number.is_finite() else text
    except InvalidOperation:
        return text


def table_rows(text):
    return [
        [cell_value(cell) for cell in line.strip().strip("|").split("|")]
        for line in text.splitlines()
        if "|" in line and not re.fullmatch(r"[-:|\s]+", line)
    ]


def evaluate(benchmark, cases):
    result = next(row for row in benchmark["results"] if row["backend"] == "docling")
    if result.get("error"):
        return {"passed": False, "error": result["error"]}
    blocks = result["blocks"]
    equations = [
        (i, block) for i, block in enumerate(blocks) if block["type"] == "equation"
    ]
    used, matches = set(), []
    for case in cases["equations"]:
        candidates = [
            (i, block)
            for i, block in equations
            if i not in used
            and block["page"] == case["page"]
            and overlap_fraction(block["bbox"], case["bbox"]) >= 0.5
        ]
        match = {
            "id": case["id"],
            "page": case["page"],
            "detected": False,
            "correct": False,
        }
        if candidates:
            index, block = max(
                candidates,
                key=lambda entry: overlap_fraction(entry[1]["bbox"], case["bbox"]),
            )
            used.add(index)
            match.update(
                detected=True,
                text=block["text"],
                correct=bool(
                    re.fullmatch(case["pattern"], normalize_formula(block["text"]))
                ),
            )
        matches.append(match)
    tables = []
    for case in cases["tables"]:
        expected = [[cell_value(cell) for cell in row] for row in case["rows"]]
        tables.append(
            {
                "id": case["id"],
                "page": case["page"],
                "rows_preserved": any(
                    all(row in table_rows(block["text"]) for row in expected)
                    for block in blocks
                    if block["page"] == case["page"] and block["type"] == "table"
                ),
            }
        )
    headings = [
        {
            **case,
            "preserved": any(
                block["page"] == case["page"]
                and block["type"] == "heading"
                and case["contains"].casefold() in block["text"].casefold()
                for block in blocks
            ),
        }
        for case in cases["headings"]
    ]
    false_positives = [
        {"page": block["page"], "text": block["text"]}
        for _, block in equations
        if block["page"] in cases["prose_control_pages"]
    ]
    return {
        "passed": all(match["correct"] for match in matches)
        and all(table["rows_preserved"] for table in tables)
        and all(heading["preserved"] for heading in headings)
        and not false_positives,
        "pages": result["pages"],
        "seconds": result["seconds"],
        "target_equations": matches,
        "tables": tables,
        "headings": headings,
        "prose_false_positives": false_positives,
        "additional_equation_regions": [
            {"page": block["page"], "text": block["text"]}
            for index, block in equations
            if index not in used
        ],
        "scope": "Selected page targets; additional math regions are unscored, not false positives. No population accuracy estimate.",
    }


def replay_table_review(benchmark, source):
    """Exercise the production guard on cached regions without rerunning inference."""
    import pypdfium2 as pdfium
    from dabook.backends.table_quality import warn_rotated_tables
    from dabook.ir.models import PageData, RawBlock

    result = next(row for row in benchmark["results"] if row["backend"] == "docling")
    if result.get("error"):
        return {"mode": "cached-region replay", "error": result["error"]}
    pages = []
    with pdfium.PdfDocument(source) as document:
        for index in range(len(document)):
            page = document[index]
            try:
                width, height = page.get_size()
                pages.append(PageData(page_idx=index, width=width, height=height))
            finally:
                page.close()
    for index, block in enumerate(result["blocks"]):
        pages[block["page"]].blocks.append(
            RawBlock(
                block_id=str(index),
                page_idx=block["page"],
                bbox=block["bbox"],
                raw_text=block["text"],
                block_type=block["type"],
                metadata=dict(block.get("metadata", {})),
            )
        )
    warn_rotated_tables(pages, source)
    return {
        "mode": "production native-angle guard replayed on cached extraction; inference not repeated",
        "warnings": [
            {
                "page": page.page_idx,
                "bbox": block.bbox,
                "warning": block.metadata["quality_warning"],
            }
            for page in pages
            for block in page.blocks
            if block.metadata.get("quality_warning")
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    cases = json.loads(
        Path(__file__).with_name("real_book_cases.json").read_text(encoding="utf-8")
    )
    reports = {
        name: evaluate(
            json.loads(
                (args.directory / f"{name}-benchmark.json").read_text(encoding="utf-8")
            ),
            annotations,
        )
        for name, annotations in cases["sources"].items()
    }
    for name, report in reports.items():
        report["table_review_guard"] = replay_table_review(
            json.loads(
                (args.directory / f"{name}-benchmark.json").read_text(encoding="utf-8")
            ),
            args.directory / f"{name}-excerpt.pdf",
        )
    report = {
        "passed": all(row["passed"] for row in reports.values()),
        "scope": cases["scope"],
        "books": reports,
    }
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["passed"] else 1)
