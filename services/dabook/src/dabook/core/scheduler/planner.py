"""
Stage planner — computes the task DAG for a book and inserts/updates tasks in the DB.

For each book, the planner:
1. Walks the stage DAG definition in order.
2. Computes each stage's content-addressed ``stage_key`` from: the stage name, its
   implementation version (owned by the stage registry), its output-affecting parameters,
   the source file sha256 **and the keys of every upstream stage it depends on**.
   Chaining upstream keys means a changed parameter or a bumped stage version invalidates
   that stage and everything downstream of it, and nothing else (defects D4, D5, D7).
3. Marks a task ``skipped`` when a valid committed artifact for that exact key exists,
   otherwise ``pending``.
4. Replaces the dependency edges so they always mirror the current plan.
5. Writes ``books/<sha12>/params.json`` so stages read the very parameters they were keyed by.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dabook.core.atomic import is_valid_commit, write_json
from dabook.core.hashing import stage_key as compute_stage_key
from dabook.core.store.db import write_txn
from dabook.stages.registry import impl_version

# ---------------------------------------------------------------------------
# Stage definition
# ---------------------------------------------------------------------------


@dataclass
class StageSpec:
    """Describes one pipeline stage. Its implementation version lives in the stage registry."""

    name: str
    order: int
    resource_class: str  # cpu | gpu | io | llm
    affects_output: list[str]  # param keys that affect the stage_key
    sharded: bool = False  # True -> one task per page shard (S02)
    deps: list[str] = field(default_factory=list)  # stage names this depends on
    # Runs on the ``llm`` lane only while an assist provider is configured; otherwise a no-op on cpu.
    llm_when_assisted: bool = False

    @property
    def impl_version(self) -> str:
        return impl_version(self.name)

    def resource_for(self, params: dict[str, Any]) -> str:
        if self.llm_when_assisted:
            return "llm" if params.get("assist_provider", "none") != "none" else "cpu"
        return self.resource_class


# Stage DAG definition (S0-S13)
STAGE_DAG: list[StageSpec] = [
    StageSpec("s00_register", 0, "io", []),
    StageSpec("s01_inspect", 1, "cpu", ["backend", "ocr_dpi", "toc_mode"], deps=["s00_register"]),
    StageSpec(
        "s02_extract",
        2,
        "cpu",
        ["backend", "ocr_engine", "ocr_dpi", "layout_model", "render_dpi_assets"],
        sharded=True,
        deps=["s01_inspect"],
    ),
    StageSpec("s03_merge", 3, "cpu", [], deps=["s02_extract"]),
    StageSpec("s04_furniture", 4, "cpu", [], deps=["s03_merge"]),
    StageSpec("s05_reading_order", 5, "cpu", [], deps=["s04_furniture"]),
    StageSpec("s06_structure", 6, "cpu", ["toc_mode", "detect_regions"], deps=["s05_reading_order"]),
    StageSpec(
        "s07_continuity",
        7,
        "cpu",
        ["merge_threshold", "uncertain_threshold"],
        deps=["s06_structure"],
    ),
    StageSpec("s08_typed_content", 8, "cpu", [], deps=["s07_continuity"]),
    StageSpec("s09_graph", 9, "cpu", [], deps=["s08_typed_content"]),
    StageSpec(
        "s10_clean",
        10,
        "cpu",
        ["dehyphenate", "fix_spaced_letters", "ocr_repair", "unicode_normal"],
        deps=["s09_graph"],
    ),
    StageSpec(
        "s11_validate",
        11,
        "cpu",
        ["quality_verified", "quality_good", "quality_review"],
        deps=["s10_clean"],
    ),
    StageSpec("s12_semantic", 12, "cpu", [], deps=["s11_validate"]),
    StageSpec(
        "s13_assist_sft",
        13,
        "llm",
        [
            "assist_provider",
            "assist_base_url",
            "assist_max_cost_usd",
            "assist_max_pairs",
            "assist_min_words",
            "assist_max_words",
            "assist_grounding",
            "assist_temperature",
            "assist_max_tokens",
            "assist_prices",
        ],
        deps=["s12_semantic"],
        llm_when_assisted=True,
    ),
    StageSpec(
        "s14_compile",
        14,
        "io",
        [
            "modes",
            "formats",
            "text_field",
            "tokenizer",
            "chunk_target_tokens",
            "chunk_max_tokens",
            "sft_system_prompt",
            "split_by",
            "split_ratios",
            "split_seed",
            "dedup_exact",
            "dedup_near",
            "dedup_jaccard",
            "include_heuristic_sft",
            "edits_digest",
        ],
        deps=["s13_assist_sft"],
    ),
]

STAGE_BY_NAME = {s.name: s for s in STAGE_DAG}


# ---------------------------------------------------------------------------
# Planner
# ---------------------------------------------------------------------------


def compute_stage_keys(
    book_sha: str,
    page_count: int,
    params: dict[str, Any],
    shard_pages: int = 20,
) -> dict[str, list[str]]:
    """Deterministic ``stage name -> [key per shard]`` for the whole DAG (no DB, no disk)."""
    keys: dict[str, list[str]] = {}
    for spec in STAGE_DAG:
        upstream = [k for dep in spec.deps for k in keys[dep]]
        keys[spec.name] = [
            _key_for(spec, book_sha, shard_idx, shard, params, upstream)
            for shard_idx, shard in enumerate(_build_shards(spec, page_count, shard_pages))
        ]
    return keys


def _key_for(
    spec: StageSpec,
    book_sha: str,
    shard_idx: int,
    shard: tuple[int | None, int | None],
    params: dict[str, Any],
    upstream_keys: list[str],
) -> str:
    affecting = {k: params.get(k) for k in spec.affects_output}
    if spec.sharded:
        affecting.update(shard_idx=shard_idx, page_start=shard[0], page_end=shard[1])
    return compute_stage_key(spec.name, spec.impl_version, affecting, [book_sha, *upstream_keys])


def plan_book(
    con: sqlite3.Connection,
    book_id: int,
    book_sha: str,
    page_count: int,
    workspace: Path,
    params: dict[str, Any],
    shard_pages: int = 20,
    *,
    retry_failed: bool = True,
) -> dict[str, int]:
    """
    Plan all tasks for *book_id*.

    Returns counts: ``{"pending": N, "skipped": N, "unchanged": N}``. With ``retry_failed``
    (the default for an explicit re-run) dead, failed and cancelled tasks are re-queued.
    """
    counts: dict[str, int] = {"pending": 0, "skipped": 0, "unchanged": 0}
    # Review decisions are an input of the compile stage: a new decision must re-compile.
    from dabook.core.governance import edits_digest

    params = {**params, "edits_digest": edits_digest(workspace, book_sha)}
    book12 = book_sha[:12]
    book_dir = workspace / "books" / book12
    book_dir.mkdir(parents=True, exist_ok=True)
    write_json(book_dir / "params.json", params)

    keys: dict[str, list[str]] = {}
    stage_tasks: dict[str, list[int]] = {}

    for spec in STAGE_DAG:
        shards = _build_shards(spec, page_count, shard_pages)
        upstream = [k for dep in spec.deps for k in keys[dep]]
        keys[spec.name] = []
        stage_dir = book_dir / "stages" / spec.name

        for shard_idx, (page_start, page_end) in enumerate(shards):
            key = _key_for(spec, book_sha, shard_idx, (page_start, page_end), params, upstream)
            keys[spec.name].append(key)

            output_path = stage_dir / key
            cached = is_valid_commit(output_path)
            initial_state = "skipped" if cached else "pending"

            with write_txn(con):
                existing = con.execute(
                    """SELECT id, state, stage_key FROM tasks
                        WHERE book_id=? AND stage=? AND shard_idx=?""",
                    (book_id, spec.name, shard_idx),
                ).fetchone()

                if existing and existing["stage_key"] == key:
                    task_id = int(existing["id"])
                    state = existing["state"]
                    heal_to: str | None = None
                    if state in ("done", "skipped") and not cached:
                        heal_to = "pending"  # artifact vanished: rebuild it
                    elif state == "pending" and cached:
                        heal_to = "skipped"
                    elif state in ("dead", "failed", "cancelled") and retry_failed:
                        heal_to = initial_state
                    if heal_to is None:
                        counts["unchanged"] += 1
                    else:
                        con.execute(
                            """UPDATE tasks
                                  SET state=?, attempts=0, not_before=0, error_class=NULL,
                                      error_msg=NULL, worker_id=NULL, lease_expires=NULL,
                                      output_path=?
                                WHERE id=?""",
                            (heal_to, str(output_path) if cached else None, task_id),
                        )
                        counts[heal_to] += 1
                elif existing:
                    # Stage key changed (params, upstream, or implementation changed): reset.
                    con.execute(
                        """UPDATE tasks
                              SET stage_key=?, state=?, output_path=?, output_sha256=NULL,
                                  attempts=0, not_before=0, error_class=NULL, error_msg=NULL,
                                  worker_id=NULL, lease_expires=NULL, units_done=0,
                                  page_start=?, page_end=?, units_total=?, resource_class=?
                            WHERE id=?""",
                        (
                            key,
                            initial_state,
                            str(output_path) if cached else None,
                            page_start,
                            page_end,
                            _units(page_start, page_end),
                            spec.resource_for(params),
                            existing["id"],
                        ),
                    )
                    task_id = int(existing["id"])
                    counts[initial_state] += 1
                else:
                    cur = con.execute(
                        """INSERT INTO tasks
                           (book_id, stage, stage_order, shard_idx, page_start, page_end,
                            stage_key, resource_class, state, max_attempts,
                            units_total, output_path)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                           RETURNING id""",
                        (
                            book_id,
                            spec.name,
                            spec.order,
                            shard_idx,
                            page_start,
                            page_end,
                            key,
                            spec.resource_for(params),
                            initial_state,
                            params.get("max_attempts", 3),
                            _units(page_start, page_end),
                            str(output_path) if cached else None,
                        ),
                    )
                    task_id = int(cur.fetchone()["id"])
                    counts[initial_state] += 1

            stage_tasks.setdefault(spec.name, []).append(task_id)

        # Shards that no longer exist in this plan (shard size or page count changed)
        with write_txn(con):
            con.execute(
                "DELETE FROM tasks WHERE book_id=? AND stage=? AND shard_idx>=? AND state != 'running'",
                (book_id, spec.name, len(shards)),
            )

    _replace_dependencies(con, book_id, stage_tasks)

    # A previously finished/failed book that now has work to do goes back in the queue.
    if counts["pending"]:
        with write_txn(con):
            con.execute(
                """UPDATE books
                      SET state='queued', finished_at=NULL, error=NULL
                    WHERE id=? AND state IN ('done','review','needs_input','failed')""",
                (book_id,),
            )

    from dabook.core.scheduler.outcomes import settle_book

    settle_book(con, book_id, workspace)
    return counts


def _units(page_start: int | None, page_end: int | None) -> int:
    return (page_end - page_start) if page_start is not None and page_end is not None else 1


def _replace_dependencies(
    con: sqlite3.Connection, book_id: int, stage_tasks: dict[str, list[int]]
) -> None:
    """Rebuild the book's dependency edges: every task waits on all tasks of each dep stage."""
    with write_txn(con):
        con.execute(
            "DELETE FROM task_deps WHERE task_id IN (SELECT id FROM tasks WHERE book_id=?)",
            (book_id,),
        )
        for spec in STAGE_DAG:
            for dep_stage in spec.deps:
                for task_id in stage_tasks.get(spec.name, []):
                    for dep_id in stage_tasks.get(dep_stage, []):
                        con.execute(
                            "INSERT OR IGNORE INTO task_deps (task_id, depends_on) VALUES (?, ?)",
                            (task_id, dep_id),
                        )


def _build_shards(
    spec: StageSpec,
    page_count: int,
    shard_pages: int,
) -> list[tuple[int | None, int | None]]:
    """Return list of (page_start, page_end) tuples for the stage."""
    if not spec.sharded or page_count == 0:
        return [(None, None)]
    return [
        (start, min(start + shard_pages, page_count)) for start in range(0, page_count, shard_pages)
    ]
