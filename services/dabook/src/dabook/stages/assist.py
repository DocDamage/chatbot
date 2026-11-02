"""
S13: LLM-assisted SFT generation (runs on the ``llm`` worker lane when a provider is configured).

With ``assist.provider = none`` the stage still runs (instantly, on the cpu lane) and commits an empty
result, so the stage graph is the same for every configuration and caching stays simple.

Outputs (in the stage directory):
  assist_sft.jsonl   accepted, grounded pairs (canonical fields; compile expands them)
  rejections.jsonl   every rejected pair with its reason code
  stats.json         calls, cache hits, tokens, cost, budget status, rejection counts
"""

from __future__ import annotations

import json
import logging
import time
from collections import Counter
from pathlib import Path
from typing import Any

from dabook.assist.cache import LLMCache
from dabook.assist.generate import (
    MAX_CONSECUTIVE_FAILURES,
    AssistParams,
    Budget,
    build_units,
    run_unit,
)
from dabook.assist.providers import ProviderError, ProviderSettings, create_provider
from dabook.core.atomic import write_file, write_json
from dabook.core.datasets import is_boilerplate_node
from dabook.core.store.db import connect
from dabook.core.store.tasks import log_event
from dabook.stages.common import read_live_dataset_settings
from dabook.stages.registry import StageContext, stage

logger = logging.getLogger("dabook.stages.assist")

MAX_REJECTION_EVENTS = 200


def _jsonl(records: list[dict[str, Any]]) -> bytes:
    return "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records).encode("utf-8")


def _log_events(workspace: Path, ctx: StageContext, rejections: list[dict[str, Any]], stats: dict[str, Any]) -> None:
    """Surface rejections in the dashboard's event log (capped; the full list is in rejections.jsonl)."""
    db_path = workspace / "state.db"
    if not db_path.is_file():
        return
    try:
        con = connect(db_path)
        try:
            book_id, task_id = ctx.task.get("book_id"), ctx.task.get("id")
            for r in rejections[:MAX_REJECTION_EVENTS]:
                log_event(con, "WARNING", "assist_rejected", f"{r['reason']}: {r.get('question', '')[:120]}",
                          book_id=book_id, task_id=task_id, data={"unit_id": r["unit_id"], "reason": r["reason"]})
            level = "WARNING" if stats.get("budget_exhausted") else "INFO"
            log_event(con, level, "assist_summary",
                      f"assist: {stats['accepted']} accepted, {stats['rejected']} rejected, "
                      f"{stats['cache_hits']} cached, ${stats['cost_usd']:.4f} spent"
                      + (" (budget exhausted)" if stats.get("budget_exhausted") else ""),
                      book_id=book_id, task_id=task_id, data=stats)
        finally:
            con.close()
    except Exception as exc:  # observability must never fail the stage
        logger.warning("Could not write assist events: %s", exc)


@stage("s13_assist_sft", "0.1.0")
def stage_s13_assist_sft(ctx: StageContext) -> None:
    spec = ctx.param("assist_provider", "none")
    if spec == "none":
        write_file(ctx.out_dir / "assist_sft.jsonl", b"")
        write_file(ctx.out_dir / "rejections.jsonl", b"")
        write_json(ctx.out_dir / "stats.json", {
            "provider": "none", "skipped": "assist.provider is none", "accepted": 0, "rejected": 0,
            "units": 0, "calls": 0, "cache_hits": 0, "cost_usd": 0.0, "budget_exhausted": False,
        })
        ctx.progress(1, "Assist disabled (assist.provider is none).")
        return

    nodes = ctx.read_json("s12_semantic", "semantic_graph.json")["nodes"]
    total_pages = ctx.read_json("s01_inspect", "inspection.json")["page_count"]
    source = json.loads((ctx.work_dir / "source.json").read_text(encoding="utf-8"))
    book_sha = source["sha256"]
    workspace = ctx.work_dir.parent.parent

    provider = create_provider(ProviderSettings(spec, ctx.param("assist_base_url"), ctx.param("assist_api_key_env", "DABOOK_ASSIST_API_KEY")))
    prices = ctx.param("assist_prices", [0.0, 0.0])
    budget = Budget(
        max_usd=float(ctx.param("assist_max_cost_usd", 5.0)),
        price_prompt=float(prices[0]),
        price_completion=float(prices[1]),
        paid=provider.is_paid,
    )
    params = AssistParams(
        max_pairs=int(ctx.param("assist_max_pairs", 3)),
        min_words=int(ctx.param("assist_min_words", 60)),
        max_words=int(ctx.param("assist_max_words", 900)),
        grounding_threshold=float(ctx.param("assist_grounding", 0.6)),
        temperature=float(ctx.param("assist_temperature", 0.2)),
        max_tokens=int(ctx.param("assist_max_tokens", 1024)),
        timeout_s=float(ctx.param("assist_timeout_s", 120.0)),
    )

    filter_boilerplate = read_live_dataset_settings(workspace).filter_boilerplate
    units, skipped_small = build_units(
        nodes,
        min_words=params.min_words,
        max_words=params.max_words,
        skip_node=(lambda n: is_boilerplate_node(n, n.get("page_idx", 0), total_pages)) if filter_boilerplate else (lambda n: False),
    )

    cache = LLMCache(workspace / "cache" / "llm")
    accepted: list[dict[str, Any]] = []
    rejections: list[dict[str, Any]] = []
    calls = cache_hits = prompt_tokens = completion_tokens = processed = consecutive_failures = 0
    budget_exhausted = False
    t0 = time.time()

    for index, unit in enumerate(units, start=1):
        if ctx.should_abort():
            raise RuntimeError("Aborted")
        if budget.exhausted():
            budget_exhausted = True
            break
        try:
            outcome = run_unit(unit, provider=provider, cache=cache, params=params, budget=budget, book_sha256=book_sha)
            consecutive_failures = 0
        except ProviderError as exc:
            consecutive_failures += 1
            rejections.append({"unit_id": unit.unit_id, "reason": "provider_error", "detail": str(exc)[:200]})
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                # Answers already received are cached, so the retry resumes where this left off.
                raise ProviderError(f"{consecutive_failures} consecutive provider failures; last: {exc}") from None
            continue
        processed += 1
        calls += outcome.called
        cache_hits += outcome.cache_hit
        prompt_tokens += outcome.prompt_tokens
        completion_tokens += outcome.completion_tokens
        accepted.extend(outcome.pairs)
        rejections.extend(outcome.rejections)
        ctx.progress(index, f"Assisted unit {index}/{len(units)}: {len(accepted)} pairs, ${budget.spent:.4f}")

    by_reason = Counter(r["reason"] for r in rejections)
    stats = {
        "provider": provider.name,
        "units": len(units),
        "units_processed": processed,
        "units_skipped_small": skipped_small,
        "calls": calls,
        "cache_hits": cache_hits,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": round(budget.spent, 6),
        "budget_usd": budget.max_usd if provider.is_paid else None,
        "budget_exhausted": budget_exhausted,
        "accepted": len(accepted),
        "rejected": len(rejections),
        "rejected_by_reason": dict(by_reason),
        "duration_s": round(time.time() - t0, 2),
    }
    write_file(ctx.out_dir / "assist_sft.jsonl", _jsonl(accepted))
    write_file(ctx.out_dir / "rejections.jsonl", _jsonl(rejections))
    write_json(ctx.out_dir / "stats.json", stats)
    _log_events(workspace, ctx, rejections, stats)
    ctx.progress(len(units), f"Assist done: {len(accepted)} accepted, {len(rejections)} rejected.")
