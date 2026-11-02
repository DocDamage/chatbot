"""Phase 4A: LLM-assisted SFT generation (grounding, units, cache, budget, providers)."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

import pytest

from dabook.assist.cache import LLMCache
from dabook.assist.generate import (
    SYSTEM_PROMPT,
    AssistParams,
    Budget,
    build_units,
    build_user_prompt,
    pair_id,
    parse_response,
    run_unit,
)
from dabook.assist.grounding import (
    check_pair,
    code_snippets,
    evidence_in_source,
    invented_code,
    token_overlap,
)
from dabook.assist.providers import (
    FakeProvider,
    LLMResult,
    OllamaProvider,
    OpenAICompatProvider,
    ProviderError,
    ProviderSettings,
    create_provider,
    extract_excerpt,
    register_provider,
)

SOURCE = (
    "Run the recovery tool from a shell and pass the image file as the only argument. "
    "The tool scans the partition table and rebuilds the boot sector from a backup copy. "
    "Use the following command to start an analysis of the failing drive:\n\n"
    "```bash\nsudo testdisk /log /dev/sda1\n```\n\n"
    "Always work on a disk image rather than the failing drive to avoid overwriting recoverable data."
)
GOOD = {
    "category": "qa",
    "question": "How does the tool repair a damaged boot sector?",
    "answer": "The tool scans the partition table and rebuilds the boot sector from a backup copy of that sector.",
    "evidence": "The tool scans the partition table and rebuilds the boot sector from a backup copy.",
}


# --------------------------------------------------------------------------- grounding
class TestGrounding:
    def test_a_faithful_pair_passes(self) -> None:
        result = check_pair(GOOD, SOURCE, 0.6)
        assert result.ok and result.reason is None and result.overlap > 0.8

    @pytest.mark.parametrize(
        ("patch", "reason"),
        [
            ({"category": "essay"}, "invalid_shape"),
            ({"question": 5}, "invalid_shape"),
            ({"question": "Why?"}, "short_question"),
            ({"answer": "Too short to be useful."}, "short_answer"),
            ({"evidence": ""}, "evidence_missing"),
            ({"evidence": None}, "evidence_missing"),
            ({"evidence": "The tool uses quantum flux capacitors to repair sectors."}, "evidence_not_in_source"),
            ({"evidence": "short quote"}, "evidence_not_in_source"),
            ({"answer": "Glimmering photonic lattices synchronise interdimensional gateways across every parallel "
                        "universe using zorblax harmonics and quantum resonance."}, "low_overlap"),
        ],
    )
    def test_rejection_reasons(self, patch: dict[str, Any], reason: str) -> None:
        assert check_pair({**GOOD, **patch}, SOURCE, 0.6).reason == reason

    def test_question_may_not_just_repeat_the_answer(self) -> None:
        text = "the tool scans the partition table and rebuilds the boot sector from a backup copy of it"
        pair = {**GOOD, "question": text, "answer": text.upper()}
        assert check_pair(pair, SOURCE, 0.6).reason == "question_equals_answer"

    def test_invented_code_is_rejected_but_quoted_code_is_fine(self) -> None:
        quoted = {**GOOD, "category": "code_walkthrough",
                  "answer": "Start the analysis with this command, which scans the failing drive and writes a log file:\n"
                            "```bash\nsudo testdisk /log /dev/sda1\n```"}
        assert check_pair(quoted, SOURCE, 0.5).ok

        invented = {**quoted, "answer": quoted["answer"].replace("sudo testdisk /log /dev/sda1", "sudo rm -rf /dev/sda1")}
        verdict = check_pair(invented, SOURCE, 0.5)
        assert (verdict.ok, verdict.reason, verdict.code_ok) == (False, "invented_code", False)

    def test_inline_code_spans_must_come_from_the_source(self) -> None:
        answer = "Pass the image file and use `testdisk` to scan the partition table, rebuilding the boot sector."
        assert invented_code(answer, SOURCE) == []  # "testdisk" is in the source
        assert invented_code("Use `fdisk -l` to list partitions and rebuild the boot sector from backups.", SOURCE) == ["fdisk -l"]

    def test_code_in_the_question_is_allowed_in_the_answer(self) -> None:
        assert invented_code("Run `partprobe` afterwards.", SOURCE, "What does partprobe do?") == []

    def test_helpers(self) -> None:
        assert 0.0 < token_overlap("recovery tool scans partition tables", SOURCE) <= 1.0
        assert token_overlap("", SOURCE) == 0.0 and token_overlap("xx", SOURCE) == 0.0
        assert evidence_in_source("The TOOL scans   the partition table!", SOURCE)
        assert code_snippets("a ```py\nx = 1\n\ny = 2\n``` b `inline` c") == ["x = 1", "y = 2", "inline"]


# --------------------------------------------------------------------------- prompts and units
def node(nid: str, ntype: str, text: str, page: int = 0, crumbs: list[str] | None = None, title: str | None = None, lang: str | None = None) -> dict[str, Any]:
    return {"node_id": nid, "node_type": ntype, "text": text, "title": title, "page_idx": page,
            "breadcrumbs": crumbs or [], "metadata": {"language": lang} if lang else {}}


def words(n: int, tag: str = "w") -> str:
    return " ".join(f"{tag}{i}" for i in range(n))


class TestUnits:
    def test_sections_become_units_with_breadcrumbs_pages_and_fenced_code(self) -> None:
        nodes = [
            node("book", "book", ""),
            node("c1", "chapter", "Ch 1", title="Ch 1"),
            node("p1", "paragraph", words(40), page=2, crumbs=["Ch 1"]),
            node("k1", "code", "ls -la", page=3, crumbs=["Ch 1"], lang="bash"),
            node("p2", "paragraph", words(40, "z"), page=3, crumbs=["Ch 1"]),
            node("s1", "section", "Setup", title="Setup", crumbs=["Ch 1"]),
            node("p3", "paragraph", words(70, "q"), page=5, crumbs=["Ch 1", "Setup"]),
        ]
        units, skipped = build_units(nodes, min_words=60, max_words=900)
        assert skipped == 0 and len(units) == 2
        first, second = units
        assert first.breadcrumbs == ["Ch 1"] and (first.page_start, first.page_end) == (3, 4)
        assert first.node_ids == ["p1", "k1", "p2"] and "```bash\nls -la\n```" in first.text
        assert second.breadcrumbs == ["Ch 1", "Setup"] and second.node_ids == ["p3"]

    def test_small_sections_and_non_content_are_skipped(self) -> None:
        nodes = [
            node("c1", "chapter", "Ch", title="Ch"),
            node("p1", "paragraph", words(10)),
            node("t", "toc", "Contents ........ 5 " * 30),
            node("f", "furniture", words(100)),
            node("c2", "chapter", "Ch2", title="Ch2"),
            node("p2", "paragraph", words(80)),
        ]
        units, skipped = build_units(nodes, min_words=60, max_words=900)
        assert [u.node_ids for u in units] == [["p2"]] and skipped == 1

    def test_long_sections_split_at_node_boundaries_and_giant_nodes_are_truncated(self) -> None:
        nodes = [node("c", "chapter", "C", title="C")] + [node(f"p{i}", "paragraph", words(80, f"t{i}_")) for i in range(5)]
        units, _ = build_units(nodes, min_words=60, max_words=200)
        assert all(u.words <= 200 for u in units) and len(units) >= 2
        giant, _ = build_units([node("c", "chapter", "C", title="C"), node("g", "paragraph", words(5000))], min_words=60, max_words=300)
        assert giant[0].words == 300

    def test_skip_node_filter_is_applied(self) -> None:
        nodes = [node("c", "chapter", "C", title="C"), node("a", "paragraph", words(80)), node("b", "paragraph", words(80, "b"))]
        units, _ = build_units(nodes, min_words=60, max_words=900, skip_node=lambda n: n["node_id"] == "a")
        assert units[0].node_ids == ["b"]

    def test_unit_ids_are_stable(self) -> None:
        nodes = [node("c", "chapter", "C", title="C"), node("a", "paragraph", words(80))]
        assert build_units(nodes, min_words=60, max_words=900)[0][0].unit_id == build_units(nodes, min_words=60, max_words=900)[0][0].unit_id

    def test_prompt_contains_the_excerpt_the_schema_and_the_rules(self) -> None:
        unit = build_units([node("c", "chapter", "Ch", title="Ch"), node("a", "paragraph", words(80), page=6)], min_words=60, max_words=900)[0][0]
        prompt = build_user_prompt(unit, 4)
        assert "Book section: Ch (pages 7-7)" in prompt and "up to 4 question-and-answer pairs" in prompt
        assert extract_excerpt(prompt) == unit.text and "never invent details" in prompt

    def test_pair_ids_are_stable_and_order_independent(self) -> None:
        a = pair_id("sha", ["n2", "n1"], "What is X?")
        assert a == pair_id("sha", ["n1", "n2"], "  what is x ")
        assert a != pair_id("sha", ["n1", "n2"], "What is Y?") and a != pair_id("other", ["n1", "n2"], "What is X?")


class TestParseResponse:
    PAIRS = [{"category": "qa", "question": "q", "answer": "a", "evidence": "e"}]

    @pytest.mark.parametrize(
        "text",
        [
            json.dumps({"pairs": PAIRS}),
            "```json\n" + json.dumps({"pairs": PAIRS}) + "\n```",
            "Sure! Here you go:\n" + json.dumps({"pairs": PAIRS}) + "\nHope that helps.",
            json.dumps(PAIRS),
        ],
    )
    def test_accepts_the_shapes_models_actually_produce(self, text: str) -> None:
        assert parse_response(text) == self.PAIRS

    @pytest.mark.parametrize("text", ["", "no json here", "{broken", json.dumps({"pairs": "nope"}), json.dumps({"other": 1}), json.dumps([1, 2])])
    def test_rejects_everything_else(self, text: str) -> None:
        with pytest.raises(ValueError):
            parse_response(text)


# --------------------------------------------------------------------------- run_unit: cache, budget, retries
class CountingProvider:
    """Scripted provider that counts calls and can fail a number of times first."""

    is_paid = False

    def __init__(self, name: str = "ollama:test", reply: dict[str, Any] | str | None = None, fail_times: int = 0) -> None:
        self.name = name
        self.reply = reply if reply is not None else {"pairs": [GOOD]}
        self.fail_times = fail_times
        self.calls = 0

    def complete(self, system: str, user: str, *, temperature: float, max_tokens: int, timeout_s: float) -> LLMResult:
        self.calls += 1
        if self.calls <= self.fail_times:
            raise ProviderError("transient")
        text = self.reply if isinstance(self.reply, str) else json.dumps(self.reply)
        return LLMResult(text, 100, 40, "test")


@pytest.fixture()
def unit():
    nodes = [node("c", "chapter", "Ch", title="Ch"), node("a", "paragraph", SOURCE, page=1, crumbs=["Ch"])]
    return build_units(nodes, min_words=20, max_words=900)[0][0]


def run(unit, provider, tmp_path: Path, budget: Budget | None = None, sleeps: list[float] | None = None, **params):
    return run_unit(
        unit, provider=provider, cache=LLMCache(tmp_path / "cache"), params=AssistParams(min_words=20, **params),
        budget=budget or Budget(max_usd=1.0), book_sha256="b" * 64,
        sleep=(sleeps.append if sleeps is not None else (lambda s: None)),
    )


class TestRunUnit:
    def test_accepted_pairs_carry_provenance_and_the_source_excerpt(self, unit, tmp_path: Path) -> None:
        result = run(unit, CountingProvider(), tmp_path)
        (pair,) = result.pairs
        assert pair["generator"] == "assist:ollama:test" and pair["pages"] == [2, 2] and pair["breadcrumbs"] == ["Ch"]
        assert pair["source_node_ids"] == ["a"] and pair["instruction"] == GOOD["question"] and pair["input"] == ""
        assert pair["evidence"] == GOOD["evidence"] and pair["source_excerpt"].startswith("Run the recovery tool")
        assert pair["grounding"]["overlap"] > 0.8 and pair["pair_id"] and result.called and not result.cache_hit

    def test_second_run_is_a_free_cache_hit(self, unit, tmp_path: Path) -> None:
        provider = CountingProvider()
        first = run(unit, provider, tmp_path)
        second = run(unit, provider, tmp_path)
        assert provider.calls == 1 and second.cache_hit and not second.called and second.cost_usd == 0
        assert [p["pair_id"] for p in second.pairs] == [p["pair_id"] for p in first.pairs]

    def test_cache_is_keyed_by_model_and_prompt(self, unit, tmp_path: Path) -> None:
        run(unit, CountingProvider("ollama:a"), tmp_path)
        other_model = CountingProvider("ollama:b")
        run(unit, other_model, tmp_path)
        assert other_model.calls == 1
        key = LLMCache.key("ollama:a", SYSTEM_PROMPT, build_user_prompt(unit, 3), 0.2, 1024)
        assert LLMCache(tmp_path / "cache").get(key)["provider"] == "ollama:a"

    def test_ungrounded_pairs_are_rejected_with_reasons_and_never_returned(self, unit, tmp_path: Path) -> None:
        bad = [{**GOOD, "evidence": "The tool uses quantum flux capacitors for everything."}, {**GOOD, "answer": "Short."}, GOOD]
        result = run(unit, CountingProvider(reply={"pairs": bad}), tmp_path)
        assert len(result.pairs) == 1
        assert [r["reason"] for r in result.rejections] == ["evidence_not_in_source", "short_answer"]

    def test_pair_count_is_capped(self, unit, tmp_path: Path) -> None:
        many = [{**GOOD, "question": f"How does the tool rebuild the boot sector, variant {i}?"} for i in range(6)]
        assert len(run(unit, CountingProvider(reply={"pairs": many}), tmp_path, max_pairs=2).pairs) == 2

    def test_unparseable_replies_are_rejected_and_not_cached(self, unit, tmp_path: Path) -> None:
        provider = CountingProvider(reply="this is not json")
        first = run(unit, provider, tmp_path)
        assert first.pairs == [] and first.rejections[0]["reason"] == "unparseable_response"
        run(unit, provider, tmp_path)
        assert provider.calls == 2  # a bad reply is retried next time, not replayed from the cache

    def test_transient_failures_are_retried_with_backoff(self, unit, tmp_path: Path) -> None:
        provider, sleeps = CountingProvider(fail_times=2), []
        assert len(run(unit, provider, tmp_path, sleeps=sleeps).pairs) == 1
        assert provider.calls == 3 and sleeps == [2.0, 4.0]

    def test_persistent_failure_raises_after_three_attempts(self, unit, tmp_path: Path) -> None:
        provider = CountingProvider(fail_times=99)
        with pytest.raises(ProviderError, match="transient"):
            run(unit, provider, tmp_path)
        assert provider.calls == 3

    def test_cost_is_charged_only_for_real_calls(self, unit, tmp_path: Path) -> None:
        budget = Budget(max_usd=1.0, price_prompt=0.01, price_completion=0.02, paid=True)
        first = run(unit, CountingProvider(), tmp_path, budget=budget)
        assert first.cost_usd == pytest.approx(100 / 1000 * 0.01 + 40 / 1000 * 0.02)
        run(unit, CountingProvider(), tmp_path, budget=budget)  # cached
        assert budget.spent == pytest.approx(first.cost_usd)


class TestBudget:
    def test_only_paid_providers_can_exhaust_a_budget(self) -> None:
        paid = Budget(max_usd=0.01, price_prompt=1.0, paid=True)
        assert not paid.exhausted()
        paid.charge(1000, 0)
        assert paid.exhausted() and paid.spent == pytest.approx(1.0)
        free = Budget(max_usd=0.0, paid=False)
        free.charge(10**6, 10**6)
        assert not free.exhausted()


# --------------------------------------------------------------------------- providers
class _Handler(BaseHTTPRequestHandler):
    requests: list[dict[str, Any]] = []
    responder = staticmethod(lambda path, body: (200, {}))

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        type(self).requests.append({"path": self.path, "body": body, "auth": self.headers.get("Authorization")})
        status, payload = type(self).responder(self.path, body)
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args: Any) -> None:  # silence
        pass


@pytest.fixture()
def server():
    _Handler.requests = []
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_port}", _Handler
    httpd.shutdown()
    httpd.server_close()


class TestHttpProviders:
    def test_ollama_request_and_token_accounting(self, server) -> None:
        url, handler = server
        handler.responder = staticmethod(lambda p, b: (200, {"message": {"content": '{"pairs": []}'}, "prompt_eval_count": 12, "eval_count": 3}))
        result = OllamaProvider("qwen3:8b", url).complete("SYS", "USER", temperature=0.1, max_tokens=64, timeout_s=5)
        assert (result.text, result.prompt_tokens, result.completion_tokens) == ('{"pairs": []}', 12, 3)
        sent = handler.requests[0]
        assert sent["path"] == "/api/chat" and sent["body"]["model"] == "qwen3:8b" and sent["body"]["stream"] is False
        assert sent["body"]["format"] == "json" and sent["body"]["options"] == {"temperature": 0.1, "num_predict": 64}
        assert [m["role"] for m in sent["body"]["messages"]] == ["system", "user"]

    def test_openai_compatible_request_reads_the_key_from_the_named_env_var(self, server, monkeypatch) -> None:
        url, handler = server
        monkeypatch.setenv("MY_KEY_VAR", "sk-secret")
        handler.responder = staticmethod(lambda p, b: (200, {"choices": [{"message": {"content": "{}"}}], "usage": {"prompt_tokens": 7, "completion_tokens": 5}}))
        provider = OpenAICompatProvider("gpt-x", url + "/v1", "MY_KEY_VAR")
        result = provider.complete("S", "U", temperature=0, max_tokens=10, timeout_s=5)
        assert (result.prompt_tokens, result.completion_tokens) == (7, 5) and provider.is_paid
        assert handler.requests[0]["path"] == "/v1/chat/completions" and handler.requests[0]["auth"] == "Bearer sk-secret"
        assert handler.requests[0]["body"]["response_format"] == {"type": "json_object"}

    def test_http_errors_and_garbage_become_provider_errors(self, server) -> None:
        url, handler = server
        handler.responder = staticmethod(lambda p, b: (500, {"error": "boom"}))
        with pytest.raises(ProviderError, match="HTTP 500"):
            OllamaProvider("m", url).complete("s", "u", temperature=0, max_tokens=1, timeout_s=5)
        handler.responder = staticmethod(lambda p, b: (200, {"unexpected": True}))
        with pytest.raises(ProviderError, match="no message content"):
            OllamaProvider("m", url).complete("s", "u", temperature=0, max_tokens=1, timeout_s=5)
        with pytest.raises(ProviderError, match="no message content"):
            OpenAICompatProvider("m", url, "K").complete("s", "u", temperature=0, max_tokens=1, timeout_s=5)

    def test_unreachable_endpoint_and_bad_schemes(self) -> None:
        with pytest.raises(ProviderError, match="Cannot reach"):
            OllamaProvider("m", "http://127.0.0.1:9").complete("s", "u", temperature=0, max_tokens=1, timeout_s=1)
        with pytest.raises(ProviderError, match="non-HTTP"):
            OllamaProvider("m", "file:///etc/passwd").complete("s", "u", temperature=0, max_tokens=1, timeout_s=1)

    def test_openai_needs_an_endpoint(self) -> None:
        with pytest.raises(ProviderError, match="base_url"):
            OpenAICompatProvider("m", None, "K")


class TestProviderFactory:
    def test_kinds(self, monkeypatch) -> None:
        assert create_provider(ProviderSettings("ollama:llama3")).name == "ollama:llama3"
        assert create_provider(ProviderSettings("openai:gpt-x", "http://h/v1")).is_paid
        with pytest.raises(ProviderError, match="tests only"):
            create_provider(ProviderSettings("fake:grounded"))
        monkeypatch.setenv("DABOOK_ENABLE_FAKE_PROVIDER", "1")
        assert create_provider(ProviderSettings("fake:grounded")).name == "fake:grounded"
        with pytest.raises(ProviderError, match="Unknown"):
            create_provider(ProviderSettings("mystery:x"))
        with pytest.raises(ProviderError, match="Unknown fake"):
            create_provider(ProviderSettings("fake:nope"))

    def test_custom_kinds_can_be_registered(self) -> None:
        register_provider("custom", lambda s: CountingProvider(f"custom:{s.spec}"))
        assert create_provider(ProviderSettings("custom:x")).name == "custom:custom:x"


class TestFakeProviders:
    def prompt(self) -> str:
        nodes = [node("c", "chapter", "Ch", title="Ch"), node("a", "paragraph", SOURCE, page=1)]
        return build_user_prompt(build_units(nodes, min_words=20, max_words=900)[0][0], 3)

    def test_grounded_fake_produces_pairs_that_pass_the_checks(self) -> None:
        reply = FakeProvider("grounded").complete(SYSTEM_PROMPT, self.prompt(), temperature=0, max_tokens=1, timeout_s=1)
        pairs = parse_response(reply.text)
        assert pairs and all(check_pair(p, SOURCE, 0.6).ok for p in pairs)
        assert any(p["category"] == "code_walkthrough" for p in pairs)

    def test_hallucinating_fake_fails_the_checks(self) -> None:
        pairs = parse_response(FakeProvider("hallucinate").complete("s", self.prompt(), temperature=0, max_tokens=1, timeout_s=1).text)
        assert not any(check_pair(p, SOURCE, 0.6).ok for p in pairs)

    def test_garbage_and_error_kinds(self) -> None:
        with pytest.raises(ValueError):
            parse_response(FakeProvider("garbage").complete("s", "u", temperature=0, max_tokens=1, timeout_s=1).text)
        with pytest.raises(ProviderError):
            FakeProvider("error").complete("s", "u", temperature=0, max_tokens=1, timeout_s=1)

    def test_cache_survives_a_corrupt_entry(self, tmp_path: Path) -> None:
        cache = LLMCache(tmp_path)
        key = LLMCache.key("p", "s", "u", 0.2, 10)
        cache.put(key, {"text": "x"})
        assert cache.get(key) == {"text": "x"}
        (tmp_path / key[:2] / f"{key}.json").write_text("{not json")
        assert cache.get(key) is None
        (tmp_path / key[:2] / f"{key}.json").write_text('{"text": 5}')
        assert cache.get(key) is None
