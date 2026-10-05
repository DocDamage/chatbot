"""
Prompt-hash cache for model responses (``<workspace>/cache/llm``).

Keyed by everything that determines the answer (provider+model, both prompts, sampling settings),
so a cache hit is a faithful replay. Re-running a book after a crash, a stage re-plan or a budget
top-up therefore re-uses every answer already paid for.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from dabook.core.atomic import write_file


class LLMCache:
    def __init__(self, root: Path) -> None:
        self.root = root

    @staticmethod
    def key(provider: str, system: str, user: str, temperature: float, max_tokens: int) -> str:
        payload = json.dumps([provider, system, user, round(temperature, 4), max_tokens], ensure_ascii=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _path(self, key: str) -> Path:
        return self.root / key[:2] / f"{key}.json"

    def get(self, key: str) -> dict[str, Any] | None:
        path = self._path(key)
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None  # a corrupt entry is just a miss
        return data if isinstance(data, dict) and isinstance(data.get("text"), str) else None

    def put(self, key: str, value: dict[str, Any]) -> None:
        write_file(self._path(key), json.dumps(value, ensure_ascii=False).encode("utf-8"))
