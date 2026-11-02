import importlib.util
from pathlib import Path

script = Path(__file__).resolve().parents[4] / "scripts/dabook/check_quality.py"
spec = importlib.util.spec_from_file_location("formula_quality_check", script)
quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)


def test_quality_gate_rejects_correct_count_with_wrong_power_or_extra_formula():
    expected = {
        "equations": [
            {"id": "energy", "page": 0, "bbox": [0, 0, 100, 30], "pattern": r"E=mc\^(?:2|\{2\})"}
        ]
    }
    block = {"page": 0, "bbox": [1, 1, 90, 20], "type": "equation", "text": "E = mc^{3}"}
    benchmark = {"results": [{"backend": "docling", "blocks": [block]}]}
    assert not quality.evaluate(benchmark, expected)["passed"]
    block["text"] = "E=mc^{2"
    assert not quality.evaluate(benchmark, expected)["passed"]
    block["text"] = "E = m c ^ { 2 }"
    assert quality.evaluate(benchmark, expected)["passed"]
    benchmark["results"][0]["blocks"].append({**block, "page": 1, "text": "x = 1"})
    report = quality.evaluate(benchmark, expected)
    assert not report["passed"]
    assert report["false_positives"] == [{"page": 1, "text": "x = 1"}]


def test_quality_gate_requires_the_expected_rows_in_one_structured_table():
    expected = {"equations": [], "table_rows": [["Unit", "Value"], ["km", "42"]]}
    benchmark = {
        "results": [
            {"backend": "docling", "blocks": [{"type": "paragraph", "text": "Unit Value km 42"}]}
        ]
    }
    assert not quality.evaluate(benchmark, expected)["passed"]
    benchmark["results"][0]["blocks"] = [
        {"type": "table", "text": "| Unit | Value |\n|---|---|\n|km|42|"}
    ]
    assert quality.evaluate(benchmark, expected)["passed"]


def test_normalization_keeps_math_operators_and_only_unwraps_a_complete_rhs():
    assert (
        quality.normalize_formula(r"\mathrm { d } y = 2 x \cdot \mathit { d } x") == r"dy=2x\cdotdx"
    )
    assert (
        quality.normalize_formula(r"x = { \frac { -b \, \pm \, \sqrt {b^2-4ac}}{2a} }")
        == r"x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}"
    )
    assert quality.normalize_formula("x={a}+{b}") == "x={a}+{b}"
    expected = {
        "equations": [
            {"id": "speed", "page": 0, "bbox": [0, 0, 100, 30], "pattern": r"v=\\frac\{d\}\{t\}"}
        ]
    }
    wrong = {
        "results": [
            {
                "backend": "docling",
                "blocks": [
                    {
                        "page": 0,
                        "bbox": [1, 1, 90, 20],
                        "type": "equation",
                        "text": r"v={\sqrt{\frac{d}{t}}}",
                    }
                ],
            }
        ]
    }
    assert not quality.evaluate(wrong, expected)["passed"]
