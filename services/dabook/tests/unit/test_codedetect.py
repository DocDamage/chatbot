"""Language-agnostic code detection (1.10)."""

from __future__ import annotations

import pytest

from dabook.core.codedetect import classify_code, detect_language
from dabook.core.datasets import is_valid_code_block


@pytest.mark.parametrize(
    ("text", "language"),
    [
        ("$ sudo testdisk /log /dev/sda1\n$ photorec --version", "bash"),
        ("pip install -r requirements.txt\ncd build && make -j4", "bash"),
        ("def add(a, b):\n    return a + b\n\nprint(add(1, 2))", "python"),
        ("const x = 1;\nfunction f(a) { return a; }\nconsole.log(f(x));", "javascript"),
        ("SELECT id, name FROM users WHERE id = 1;", "sql"),
        ('{"name": "dabook", "version": 1}', "json"),
        ("#include <stdio.h>\nint main(void) {\n    return 0;\n}", "c"),
        ("mov eax, [ebp+8]\npush eax\ncall 0x00401000\nret", "x86_asm"),
        ("<html>\n<body>\n</body>\n</html>", "html"),
    ],
)
def test_detects_language(text: str, language: str) -> None:
    assert detect_language(text) == language
    assert classify_code(text, is_mono=True) == language


def test_monospace_plain_text_is_still_code_but_untagged() -> None:
    assert classify_code("alpha beta gamma", is_mono=True) == "text"


@pytest.mark.parametrize(
    "prose",
    [
        "Select the partition type that matches the original layout from the list.",
        "Create a new partition and make sure the boot flag is set before you continue.",
        "Run the tool from a shell and pass the image file as the only argument.",
        "make sure the drive is unmounted. cat is a small animal.",
        "Alternatively type the following command to continue with the recovery.",
    ],
)
def test_prose_in_a_proportional_font_is_not_code(prose: str) -> None:
    assert classify_code(prose, is_mono=False) is None


def test_shell_commands_in_a_proportional_font_are_code() -> None:
    assert classify_code("$ sudo apt install testdisk", is_mono=False) == "bash"
    assert classify_code("sudo apt install -y testdisk\ncd /tmp/work", is_mono=False) == "bash"


def test_lowercase_sql_needs_a_monospace_signal() -> None:
    sql = "select name from users where id = 1;"
    assert classify_code(sql, is_mono=False) is None
    assert classify_code(sql, is_mono=True) == "sql"


def test_single_line_shell_command_is_a_valid_code_block() -> None:
    assert is_valid_code_block("$ sudo testdisk /log /dev/sda1")


@pytest.mark.parametrize("junk", ["www.example.com", "readme.pdf", "info@example.com", "PhotoRec"])
def test_urls_and_filenames_are_not_valid_code_blocks(junk: str) -> None:
    assert not is_valid_code_block(junk)
