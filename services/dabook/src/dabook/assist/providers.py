"""
LLM providers for assisted SFT generation.

* ``ollama:<model>``  local Ollama server (free). Default endpoint http://127.0.0.1:11434.
* ``openai:<model>``  any OpenAI-compatible ``/chat/completions`` endpoint (paid). The API key is read
                      from the environment variable named by ``assist.api_key_env``; it is never
                      stored in config, the cache or the logs.
* ``fake:<kind>``     deterministic test doubles, only with DABOOK_ENABLE_FAKE_PROVIDER=1.

Only the standard library is used for HTTP, so enabling assist adds no dependencies.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
EXCERPT_START = "<<<EXCERPT"
EXCERPT_END = "EXCERPT>>>"


class ProviderError(RuntimeError):
    """The model could not be reached or returned an unusable HTTP response."""


@dataclass(frozen=True)
class LLMResult:
    text: str
    prompt_tokens: int
    completion_tokens: int
    model: str


class LLMProvider(Protocol):
    name: str  # e.g. "ollama:qwen3:8b"
    is_paid: bool

    def complete(
        self, system: str, user: str, *, temperature: float, max_tokens: int, timeout_s: float
    ) -> LLMResult: ...


@dataclass(frozen=True)
class ProviderSettings:
    spec: str
    base_url: str | None = None
    api_key_env: str = "DABOOK_ASSIST_API_KEY"


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout_s: float) -> dict[str, Any]:
    if not url.lower().startswith(("http://", "https://")):
        raise ProviderError(f"Refusing non-HTTP endpoint: {url}")
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:  # noqa: S310 (scheme checked)
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise ProviderError(f"HTTP {exc.code} from {url}: {body}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ProviderError(f"Cannot reach {url}: {getattr(exc, 'reason', exc)}") from None
    except ValueError as exc:
        raise ProviderError(f"Non-JSON response from {url}: {exc}") from None


class OllamaProvider:
    is_paid = False

    def __init__(self, model: str, base_url: str | None = None) -> None:
        self.model = model
        self.name = f"ollama:{model}"
        self.base_url = (base_url or DEFAULT_OLLAMA_URL).rstrip("/")

    def complete(self, system: str, user: str, *, temperature: float, max_tokens: int, timeout_s: float) -> LLMResult:
        data = _post_json(
            f"{self.base_url}/api/chat",
            {
                "model": self.model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "stream": False,
                "format": "json",
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
            {},
            timeout_s,
        )
        text = (data.get("message") or {}).get("content")
        if not isinstance(text, str):
            raise ProviderError("Ollama response had no message content")
        return LLMResult(text, int(data.get("prompt_eval_count") or 0), int(data.get("eval_count") or 0), self.model)


class OpenAICompatProvider:
    is_paid = True

    def __init__(self, model: str, base_url: str | None, api_key_env: str) -> None:
        if not base_url:
            raise ProviderError("openai:* providers need assist.base_url (e.g. https://api.openai.com/v1)")
        self.model = model
        self.name = f"openai:{model}"
        self.base_url = base_url.rstrip("/")
        self.api_key_env = api_key_env

    def complete(self, system: str, user: str, *, temperature: float, max_tokens: int, timeout_s: float) -> LLMResult:
        key = os.environ.get(self.api_key_env, "")
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        data = _post_json(
            f"{self.base_url}/chat/completions",
            {
                "model": self.model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
            headers,
            timeout_s,
        )
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise ProviderError("Chat completion response had no message content") from None
        usage = data.get("usage") or {}
        return LLMResult(str(text), int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0), self.model)


# --------------------------------------------------------------------------- test doubles
def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.replace("\n", " ")) if s.strip()]


def extract_excerpt(user_prompt: str) -> str:
    start = user_prompt.find(EXCERPT_START)
    end = user_prompt.find(EXCERPT_END)
    if start < 0 or end < 0:
        return user_prompt
    return user_prompt[start + len(EXCERPT_START) : end].strip()


class FakeProvider:
    """Deterministic stand-in for a model: ``grounded`` | ``hallucinate`` | ``garbage`` | ``error``."""

    is_paid = False

    def __init__(self, kind: str) -> None:
        if kind not in ("grounded", "hallucinate", "garbage", "error"):
            raise ProviderError(f"Unknown fake provider kind {kind!r}")
        self.kind = kind
        self.name = f"fake:{kind}"
        self.calls = 0

    def complete(self, system: str, user: str, *, temperature: float, max_tokens: int, timeout_s: float) -> LLMResult:
        self.calls += 1
        if self.kind == "error":
            raise ProviderError("fake provider failure")
        if self.kind == "garbage":
            text = "this is not json at all"
        elif self.kind == "hallucinate":
            text = json.dumps({"pairs": [{
                "category": "qa",
                "question": "How does the zorblax protocol use quantum flux capacitors?",
                "answer": "The zorblax protocol relies on quantum flux capacitors to stabilise the interdimensional "
                          "gateway so that glimmering photonic lattices can synchronise across every dimension.",
                "evidence": "The zorblax protocol relies on quantum flux capacitors",
            }]})
        else:
            text = json.dumps({"pairs": self._grounded_pairs(extract_excerpt(user))})
        return LLMResult(text, len(user.split()), len(text.split()), self.name)

    @staticmethod
    def _grounded_pairs(excerpt: str) -> list[dict[str, Any]]:
        pairs: list[dict[str, Any]] = []
        sentences = _sentences(re.sub(r"```.*?```", " ", excerpt, flags=re.DOTALL))
        i = 0
        while i < len(sentences) and len(pairs) < 2:
            chunk: list[str] = []
            j = i
            while j < len(sentences) and len(" ".join(chunk).split()) < 16:
                chunk.append(sentences[j])
                j += 1
            if len(" ".join(chunk).split()) < 16:
                break
            topic = " ".join(chunk[0].split()[:4]).rstrip(".,;:")
            pairs.append({
                "category": "qa",
                "question": f"What does the excerpt explain about {topic}?",
                "answer": " ".join(chunk),
                "evidence": chunk[0],
            })
            i = j
        fence = re.search(r"```[^\n`]*\n(.*?)```", excerpt, flags=re.DOTALL)
        if fence and sentences:
            code = fence.group(1).strip()
            lead = " ".join(sentences[:2])
            pairs.append({
                "category": "code_walkthrough",
                "question": "What does the following command or code do in this section?",
                "answer": f"{lead}\n\n```\n{code}\n```",
                "evidence": sentences[0],
            })
        return pairs


ProviderFactory = Callable[[ProviderSettings], LLMProvider]
_CUSTOM: dict[str, ProviderFactory] = {}


def register_provider(kind: str, factory: ProviderFactory) -> None:
    """Hook for tests and embedders to add or replace a provider kind."""
    _CUSTOM[kind] = factory


def create_provider(settings: ProviderSettings) -> LLMProvider:
    kind, _, model = settings.spec.partition(":")
    if kind in _CUSTOM:
        return _CUSTOM[kind](settings)
    if kind == "ollama":
        return OllamaProvider(model, settings.base_url)
    if kind == "openai":
        return OpenAICompatProvider(model, settings.base_url, settings.api_key_env)
    if kind == "fake":
        if os.environ.get("DABOOK_ENABLE_FAKE_PROVIDER") != "1":
            raise ProviderError("fake:* providers are for tests only (set DABOOK_ENABLE_FAKE_PROVIDER=1)")
        return FakeProvider(model)
    raise ProviderError(f"Unknown provider {settings.spec!r}")
