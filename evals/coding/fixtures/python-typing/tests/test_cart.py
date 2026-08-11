from src.cart import line_total


def test_line_total():
    assert line_total(2, 3.5) == 7
