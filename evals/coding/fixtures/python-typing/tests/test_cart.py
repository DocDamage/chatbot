from src.cart import line_total


def test_line_total():
    assert line_total(2, 3.5) == 7


def test_negative_quantity_is_rejected():
    try:
        line_total(-1, 3.5)
    except ValueError:
        return
    raise AssertionError("negative quantities must be rejected")
