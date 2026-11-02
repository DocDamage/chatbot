import importlib.util
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[4] / "scripts/dabook"


@pytest.fixture
def checks(monkeypatch):
    monkeypatch.syspath_prepend(str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(
        "real_book_checks", SCRIPTS / "check_real_books.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def cases(**overrides):
    return {"equations": [], "headings": [], "tables": [], "prose_control_pages": [], **overrides}


def benchmark(blocks):
    return {"results": [{"backend": "docling", "pages": 2, "seconds": 1, "blocks": blocks}]}


def test_target_equations_require_semantic_math_and_correct_page(checks):
    target = cases(
        equations=[{"id": "derivative", "page": 0, "bbox": [0, 0, 100, 40], "pattern": r"dy=2xdx"}]
    )
    formula = {"page": 0, "bbox": [1, 1, 90, 30], "type": "equation", "text": "dy=3xdx"}
    assert not checks.evaluate(benchmark([formula]), target)["passed"]
    formula["text"] = "dy=2xdx"
    assert checks.evaluate(benchmark([formula]), target)["passed"]
    formula["page"] = 1
    assert not checks.evaluate(benchmark([formula]), target)["passed"]


def test_table_rows_must_remain_aligned_in_one_table(checks):
    target = cases(tables=[{"id": "data", "page": 0, "rows": [["A", "22000"], ["B", "15000"]]}])
    table = {"page": 0, "type": "table", "text": "|A|22,000.00|\n|B|15000.0|"}
    assert checks.evaluate(benchmark([table]), target)["passed"]
    table["text"] = "|A|15000|\n|B|22000|"
    assert not checks.evaluate(benchmark([table]), target)["passed"]
    assert not checks.evaluate(
        benchmark([{**table, "text": "|A|22000|"}, {**table, "text": "|B|15000|"}]), target
    )["passed"]


def test_unscored_math_does_not_hide_prose_false_positives(checks):
    formula = {"page": 0, "type": "equation", "text": "y=x"}
    target = cases(prose_control_pages=[1], headings=[{"page": 0, "contains": "Methods"}])
    header = {"page": 0, "type": "heading", "text": "2. Methods"}
    report = checks.evaluate(benchmark([formula, header]), target)
    assert report["passed"]
    assert len(report["additional_equation_regions"]) == 1
    assert not checks.evaluate(benchmark([formula]), target)["passed"]
    assert not checks.evaluate(benchmark([formula, header, {**formula, "page": 1}]), target)[
        "passed"
    ]


def test_changed_book_editions_are_rejected_before_parsing(tmp_path):
    spec = importlib.util.spec_from_file_location(
        "real_book_fixtures", SCRIPTS / "real_book_fixtures.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    (tmp_path / "calculus-made-easy.pdf").write_bytes(b"unverified edition")
    with pytest.raises(ValueError, match="Source edition changed"):
        module.prepare(tmp_path)
    assert not (tmp_path / "calculus-made-easy-excerpt.pdf").exists()
