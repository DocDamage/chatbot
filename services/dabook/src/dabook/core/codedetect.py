"""
Language-agnostic code detection for typed-content (S08) and dataset export.

Two questions are answered here:

* ``classify_code(text, is_mono)``: is this block code, and if so in which language?
* ``detect_language(text)``: which fence tag fits this block (``text`` when unsure)?

Monospace blocks are trusted as code (the extractor saw a fixed-pitch font). Proportional-font
blocks only count as code on *strong* syntactic evidence, so prose is not swallowed.
"""

from __future__ import annotations

import json
import re

# --- shell ------------------------------------------------------------------------------
_SHELL_PROMPT = re.compile(r"^\s*(?:\$|%|>|PS>|[A-Za-z]:\\[^>\n]*>)\s+\S")
_SHELL_COMMANDS = (
    "sudo apt apt-get yum dnf brew pip pip3 python python3 npm npx yarn pnpm git docker cd ls cat "
    "chmod chown curl wget make cmake gcc g++ ssh scp mkdir rm mv cp echo export dd mount umount "
    "fdisk systemctl tar unzip grep sed awk kubectl cargo go java node powershell pwsh"
).split()
_SHELL_COMMAND = re.compile(
    r"^\s*(?:" + "|".join(re.escape(c) for c in _SHELL_COMMANDS) + r")\s+"
    # a flag, path, variable or assignment must follow, so prose like "make sure ..." is ignored
    r"(?:-{1,2}\w|[/~.]\S|\$\w|\w+=|\w+\s+[-/~])"
)

# --- other languages --------------------------------------------------------------------
_PY_LINE = re.compile(
    r"^\s*(?:def\s+\w+\(|class\s+\w+[\(:]|import\s+\w|from\s+[\w.]+\s+import\s|"
    r"if\s+__name__|@\w+|print\(|for\s+\w+\s+in\s+.+:|elif\s|except\s|with\s+.+\sas\s)"
)
_JS_LINE = re.compile(
    r"(?:\b(?:const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|=>\s*[{(]|console\.log\(|"
    r"\brequire\(['\"]|\bimport\s+.+\s+from\s+['\"])"
)
# Upper-case keywords only: prose often starts with "Select ..." or "Create ...".
_SQL_LINE = re.compile(
    r"^\s*(?:SELECT\s.+\sFROM\s|INSERT\s+INTO\s|UPDATE\s+\w+\s+SET\s|DELETE\s+FROM\s|"
    r"CREATE\s+(?:TABLE|INDEX|VIEW)\s|ALTER\s+TABLE\s|DROP\s+TABLE\s)"
)
# Lower-case SQL is believable only inside a monospace block.
_SQL_LOWER_LINE = re.compile(
    r"^\s*(?:select\s.+\sfrom\s|insert\s+into\s|update\s+\w+\s+set\s|delete\s+from\s|"
    r"create\s+(?:table|index|view)\s|alter\s+table\s|drop\s+table\s)"
)
_C_LINE = re.compile(
    r"(?:^\s*#\s*(?:include|define|ifdef|ifndef|pragma)\b|\btypedef\s|\bstruct\s+\w+\s*\{|"
    r"^\s*(?:static\s+|const\s+|unsigned\s+)*(?:void|int|char|long|size_t|u?int\d+_t|float|double)"
    r"\s*\**\s*\w+\s*\([^;]*\)\s*\{?\s*$|\bsizeof\s*\()"
)
_JAVA_LINE = re.compile(r"\b(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+\w+\s*\(")
_HTML_LINE = re.compile(r"^\s*</?[a-zA-Z!?][^>]*>")
_ASM_REG = re.compile(
    r"\b(?:e?[abcd]x|[abcd][lh]|e?[sd]i|e?[sb]p|r(?:[abcd]x|[sd]i|[sb]p|\d{1,2}))\b", re.IGNORECASE
)
_ASM_OPS = re.compile(
    r"^\s*(?:[0-9a-f]{4,16}[:\s]+)?(?:mov|push|pop|call|retn?|jmp|j[a-z]{1,3}|cmp|test|lea|xor|"
    r"sub|add|nop|int)\b\s*",
    re.IGNORECASE | re.MULTILINE,
)
_ASM_ADDR = re.compile(r"\[[^\]]+\]|0x[0-9a-fA-F]{4,16}")
_LINE_NUMBERED = re.compile(r"^\s*\d{2,4}:\s+\S", re.MULTILINE)

_C_KEYWORD_BOOST = re.compile(r"\b(?:typedef|struct|sizeof|volatile|uint\d+_t|DWORD|QWORD|NTSTATUS)\b")


def _lines(text: str) -> list[str]:
    return [ln for ln in text.splitlines() if ln.strip()]


def _frac(pattern: re.Pattern[str], lines: list[str]) -> float:
    return sum(1 for ln in lines if pattern.search(ln)) / len(lines) if lines else 0.0


def _is_json(text: str) -> bool:
    stripped = text.strip()
    if not stripped or stripped[0] not in "{[" or stripped[-1] not in "}]":
        return False
    try:
        json.loads(stripped)
    except ValueError:
        return False
    return len(stripped) > 2


def _asm_score(text: str, lines: list[str]) -> bool:
    ops = len(_ASM_OPS.findall(text))
    if ops == 0:
        return False
    has_operands = bool(_ASM_REG.search(text) or _ASM_ADDR.search(text))
    return has_operands and ops / max(1, len(lines)) >= 0.4


def detect_language(text: str) -> str:
    """Fence tag for a code block; ``text`` when no language fits."""
    lines = _lines(text)
    if not lines:
        return "text"
    if _is_json(text):
        return "json"
    if _frac(_SHELL_PROMPT, lines) >= 0.5 or _frac(_SHELL_COMMAND, lines) >= 0.5:
        return "bash"
    if _frac(_SQL_LINE, lines) >= 0.4:
        return "sql"
    if _frac(_HTML_LINE, lines) >= 0.5:
        return "html"
    if _asm_score(text, lines):
        return "x64_asm" if re.search(r"\br(?:[abcd]x|[sd]i|[sb]p|\d{1,2})\b", text, re.I) else "x86_asm"
    c_hits = sum(1 for ln in lines if _C_LINE.search(ln))
    if c_hits >= 1 and (c_hits / len(lines) >= 0.15 or _C_KEYWORD_BOOST.search(text)):
        return "c"
    if _frac(_JAVA_LINE, lines) >= 0.15:
        return "java"
    if _frac(_PY_LINE, lines) >= 0.3:
        return "python"
    if _frac(_JS_LINE, lines) >= 0.3:
        return "javascript"
    return "text"


def classify_code(text: str, is_mono: bool = False) -> str | None:
    """Return the language tag when *text* is code, else ``None``."""
    stripped = text.strip()
    if not stripped:
        return None
    lang = detect_language(stripped)
    if is_mono:
        if lang == "text" and _frac(_SQL_LOWER_LINE, _lines(stripped)) >= 0.4:
            return "sql"
        return lang
    lines = _lines(stripped)
    # Proportional-font text must show strong syntax. Plain "text" is never enough.
    if lang == "text":
        return "text" if _LINE_NUMBERED.search(stripped) and len(lines) >= 2 else None
    if lang in ("bash", "sql", "html", "json", "x86_asm", "x64_asm"):
        return lang
    # c / java / python / javascript need at least two corroborating lines in prose fonts
    hits = {
        "c": _C_LINE,
        "java": _JAVA_LINE,
        "python": _PY_LINE,
        "javascript": _JS_LINE,
    }[lang]
    return lang if sum(1 for ln in lines if hits.search(ln)) >= 2 else None
