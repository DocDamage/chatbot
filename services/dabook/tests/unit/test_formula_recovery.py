import types

import pytest
from reportlab.pdfgen import canvas

from dabook.backends.formulas import plausible_math, recover_native_formulas, small_ink_crop


class Box:
    def __init__(self, l, b, r, t):
        self.l, self.b, self.r, self.t = l, b, r, t

    def to_bottom_left_origin(self, **kwargs):
        return self

    def model_copy(self, *, update):
        return Box(**{**vars(self), **update})


def test_ink_crop_cannot_shift_inside_by_a_quarter_of_the_region():
    assert not small_ink_crop(Box(0, 0, 100, 100), (25, 25, 100, 100))
    assert small_ink_crop(Box(150, 506.4, 218.5, 558.4), (150.5, 510.8, 219.4, 559.3))


def item(ref, text, left, bottom, right, top):
    box = Box(left, bottom, right, top)
    return types.SimpleNamespace(
        self_ref=ref,
        text=text,
        label=types.SimpleNamespace(value="text"),
        prov=[types.SimpleNamespace(page_no=1, bbox=box)],
    )


def test_native_math_recovery_requires_independent_structure(tmp_path):
    source = tmp_path / "math.pdf"
    pdf = canvas.Canvas(str(source))
    pdf.setFont("Times-Italic", 16)
    pdf.drawString(20, 700, "E = mc")
    pdf.setFont("Times-Roman", 10)
    pdf.drawString(64, 708, "2")
    pdf.setFont("Times-Italic", 16)
    pdf.drawString(20, 600, "v =")
    pdf.drawString(62, 613, "d")
    pdf.line(59, 607, 73, 607)
    pdf.drawString(62, 586, "t")
    pdf.drawString(20, 500, "x = 2")
    pdf.setFont("Courier", 12)
    pdf.drawString(20, 450, "result = m * c ** 2")
    pdf.setFont("Times-Roman", 12)
    pdf.drawString(20, 400, "Set mode = safe before startup.")
    pdf.save()
    items = [
        item("energy", "E = mc 2", 18, 697, 85, 725),
        item("speed", "v = d t", 18, 580, 80, 635),
        item("assignment", "x = 2", 18, 495, 85, 520),
        item("code", "result = m * c ** 2", 18, 445, 250, 470),
        item("prose", "Set mode = safe before startup.", 18, 395, 300, 420),
    ]
    document = types.SimpleNamespace(iterate_items=lambda: ((entry, 0) for entry in items))
    label = types.SimpleNamespace(value="formula")
    recovered = recover_native_formulas(document, source, label)
    assert set(recovered) == {"energy", "speed"}
    assert recovered["energy"]["formula_geometry"] == "script_geometry"
    assert recovered["energy"]["original_text"] == "E = mc 2"
    assert recovered["speed"]["formula_geometry"] == "stacked_geometry"
    assert [entry.label.value for entry in items] == ["formula", "formula", "text", "text", "text"]


@pytest.mark.parametrize(
    "text",
    [
        "Set mode = safe",
        "x == 2",
        "def energy(m, c):",
        "result = m * c ** 2",
        "a:=3",
        "a=b; c=d",
        "flag = true",
        "a=b " * 60,
    ],
)
def test_prose_and_code_are_not_formula_candidates(text):
    assert not plausible_math(text)


def test_no_native_text_does_not_promote_ocr_guesses(tmp_path):
    source = tmp_path / "blank.pdf"
    pdf = canvas.Canvas(str(source))
    pdf.showPage()
    pdf.save()
    guessed = item("guessed", "E = mc 2", 18, 697, 85, 725)
    document = types.SimpleNamespace(iterate_items=lambda: iter([(guessed, 0)]))
    assert recover_native_formulas(document, source, types.SimpleNamespace(value="formula")) == {}
    assert guessed.label.value == "text"


def test_existing_formula_crop_uses_native_ink_without_changing_transcription(tmp_path):
    source = tmp_path / "ink.pdf"
    pdf = canvas.Canvas(str(source))
    pdf.setFont("Times-Italic", 16)
    pdf.drawString(20, 700, "E = mc")
    pdf.setFont("Times-Roman", 10)
    pdf.drawString(64, 708, "2")
    pdf.save()
    formula = item("energy", "", 18, 697, 72, 716)
    formula.label = types.SimpleNamespace(value="formula")
    document = types.SimpleNamespace(iterate_items=lambda: iter([(formula, 0)]))
    metadata = recover_native_formulas(document, source, formula.label)
    assert metadata["energy"]["formula_detection"] == "docling_layout"
    assert metadata["energy"]["formula_crop"] == "native_ink"
    assert formula.prov[0].bbox.b > 697
    assert "2" in metadata["energy"]["native_text"]
    assert formula.text == ""


def test_rotated_native_coordinates_do_not_change_layout_labels(tmp_path):
    source = tmp_path / "rotated.pdf"
    pdf = canvas.Canvas(str(source))
    pdf.setPageRotation(90)
    pdf.drawString(20, 700, "E = mc2")
    pdf.save()
    candidate = item("rotated", "E = mc 2", 18, 697, 75, 718)
    document = types.SimpleNamespace(iterate_items=lambda: iter([(candidate, 0)]))
    assert recover_native_formulas(document, source, types.SimpleNamespace(value="formula")) == {}
    assert candidate.label.value == "text"
