from src.cart import line_total


def test_negative_quantity_is_rejected():
    try:
        line_total(-1, 3.5)
    except ValueError:
        return
    raise AssertionError("negative quantities must be rejected")
