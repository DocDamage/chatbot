"""
Stage registry — the single place where a stage's implementation version lives.

The planner hashes ``impl_version`` into every stage key. Keeping the version beside the
function (via the :func:`stage` decorator) means changing a stage's code and bumping its
version are one edit, and the planner can never disagree with the runner (defect D7).

Inputs are resolved by *exact committed stage key* through :class:`StageContext`, never by
"newest directory on disk" (defects D4 and D5).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dabook.core.atomic import is_valid_commit

StageFn = Callable[["StageContext"], None]


class MissingUpstreamError(RuntimeError):
    """A stage's required upstream output is not committed (planner/DB drift or cache loss)."""


class MissingSourceError(RuntimeError):
    """The source PDF is gone or unreadable; retrying cannot help."""


@dataclass(frozen=True)
class StageImpl:
    name: str
    version: str
    fn: StageFn


STAGE_IMPLS: dict[str, StageImpl] = {}


def stage(name: str, version: str) -> Callable[[StageFn], StageFn]:
    """Register *fn* as the implementation of stage *name* at *version*."""

    def deco(fn: StageFn) -> StageFn:
        STAGE_IMPLS[name] = StageImpl(name, version, fn)
        return fn

    return deco


def load_all_stages() -> None:
    """Import every module that registers stages (idempotent)."""
    import dabook.stages.runner  # noqa: F401


def impl_version(name: str) -> str:
    if name not in STAGE_IMPLS:
        load_all_stages()
    try:
        return STAGE_IMPLS[name].version
    except KeyError:
        raise KeyError(f"No implementation registered for stage {name!r}") from None


@dataclass
class StageContext:
    task: dict[str, Any]
    work_dir: Path  # books/<sha12>
    out_dir: Path  # the stage's .partial directory
    pdf_path: Path
    upstream: dict[str, list[str]]  # ancestor stage name -> committed keys, in shard order
    params: dict[str, Any]
    progress: Callable[[int, str], None]
    should_abort: Callable[[], bool]
    log: Any = field(default=None)

    # -- input resolution ---------------------------------------------------------------
    def input_dirs(self, stage_name: str) -> list[Path]:
        keys = self.upstream.get(stage_name)
        if not keys:
            raise MissingUpstreamError(
                f"{self.task['stage']}: no planned upstream key for {stage_name}"
            )
        dirs = [self.work_dir / "stages" / stage_name / key for key in keys]
        for d in dirs:
            if not is_valid_commit(d):
                raise MissingUpstreamError(
                    f"{self.task['stage']}: upstream {stage_name} output {d.name} is not committed"
                )
        return dirs

    def input_dir(self, stage_name: str) -> Path:
        dirs = self.input_dirs(stage_name)
        if len(dirs) != 1:
            raise MissingUpstreamError(
                f"{self.task['stage']}: expected one {stage_name} output, found {len(dirs)}"
            )
        return dirs[0]

    def read_json(self, stage_name: str, filename: str) -> Any:
        return json.loads((self.input_dir(stage_name) / filename).read_text(encoding="utf-8"))

    def param(self, key: str, default: Any = None) -> Any:
        return self.params.get(key, default)
