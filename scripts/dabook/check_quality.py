"""Check detected regions, LaTeX structure, table rows, and negative controls."""

import argparse
import json
import re
from pathlib import Path


def normalize_formula(text):
    text = re.sub(r"\\(?:left|right|displaystyle|textstyle)\b", "", text)
    text = re.sub(r"\\(?:[,!;:]|qquad\b|quad\b| )", "", text)
    text = re.sub(r"\s+", "", text).replace("−", "-")
    text = re.sub(r"\\(?:mathrm|mathit)\{([^{}]+)\}", r"\1", text)
    left, relation, right = text.partition("=")
    while right.startswith("{") and right.endswith("}"):
        depth = 0
        for index, char in enumerate(right):
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
            if depth == 0:
                break
        if depth != 0 or index != len(right) - 1:
            break
        right = right[1:-1]
    return left + relation + right


def overlap_fraction(actual, expected):
    left, top = max(actual[0], expected[0]), max(actual[1], expected[1])
    right, bottom = min(actual[2], expected[2]), min(actual[3], expected[3])
    area = max(0, actual[2] - actual[0]) * max(0, actual[3] - actual[1])
    return max(0, right - left) * max(0, bottom - top) / area if area else 0


def evaluate(benchmark, expected):
    result = next(row for row in benchmark["results"] if row["backend"] == "docling")
    if result.get("error"):
        return {"passed": False, "error": result["error"]}
    equations = [block for block in result["blocks"] if block["type"] == "equation"]
    used, matches, missing = set(), [], []
    for case in expected["equations"]:
        candidates = [
            (i, block)
            for i, block in enumerate(equations)
            if i not in used
            and block["page"] == case["page"]
            and overlap_fraction(block["bbox"], case["bbox"]) >= 0.5
        ]
        if not candidates:
            missing.append(case["id"])
            continue
        i, block = max(
            candidates,
            key=lambda entry: overlap_fraction(entry[1]["bbox"], case["bbox"]),
        )
        used.add(i)
        matches.append(
            {
                "id": case["id"],
                "text": block["text"],
                "correct_latex": bool(
                    re.fullmatch(case["pattern"], normalize_formula(block["text"]))
                ),
                "detection": block.get("metadata", {}).get("formula_detection"),
            }
        )
    false_positives = [
        {"page": block["page"], "text": block["text"]}
        for i, block in enumerate(equations)
        if i not in used
    ]
    table_rows = expected.get("table_rows", [])
    table_ok = not table_rows
    for block in result["blocks"]:
        if block["type"] != "table":
            continue
        rows = [
            [
                re.sub(r"\s+", " ", cell).strip()
                for cell in line.strip().strip("|").split("|")
            ]
            for line in block["text"].splitlines()
            if "|" in line and not re.fullmatch(r"[-:|\s]+", line)
        ]
        if all(row in rows for row in table_rows):
            table_ok = True
    return {
        "passed": not missing
        and not false_positives
        and all(match["correct_latex"] for match in matches)
        and table_ok,
        "expected_equations": len(expected["equations"]),
        "detected_equations": len(equations),
        "matches": matches,
        "missing": missing,
        "false_positives": false_positives,
        "table_rows_preserved": table_ok,
        "scope": "generated display-math fixture; not a population accuracy estimate",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("benchmark", type=Path)
    parser.add_argument("expectations", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    report = evaluate(
        json.loads(args.benchmark.read_text(encoding="utf-8")),
        json.loads(args.expectations.read_text(encoding="utf-8")),
    )
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
