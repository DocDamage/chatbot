#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
TASK_ID = "P01-T01"
BRANCH = "agent/p01-t01-reproduce-latest-ci-failure"
IMPLEMENTATION_COMMIT = "b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4"
BASE_COMMIT = "7f3b66c2c4ecf10028be6bbee4a68c64f651b8d0"
EVIDENCE = ROOT / "docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2"
RUN_ID = 30982260932


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    require(text.count(old) == 1, f"Expected exactly one {label}")
    return text.replace(old, new, 1)


def inspect_root_cause() -> dict[str, object]:
    client_package = json.loads((ROOT / "client/package.json").read_text())
    root_package = json.loads((ROOT / "package.json").read_text())
    tsconfig = json.loads((ROOT / "client/tsconfig.json").read_text())
    test_files = sorted((ROOT / "client/src").rglob("*.test.ts")) + sorted(
        (ROOT / "client/src").rglob("*.test.tsx")
    )
    global_refs: list[dict[str, object]] = []
    for path in test_files:
        for number, line in enumerate(path.read_text().splitlines(), 1):
            if re.search(r"\bglobal\b", line):
                global_refs.append(
                    {"path": str(path.relative_to(ROOT)), "line": number, "text": line.strip()}
                )

    client_deps = {**client_package.get("dependencies", {}), **client_package.get("devDependencies", {})}
    root_deps = {**root_package.get("dependencies", {}), **root_package.get("devDependencies", {})}
    require(client_package.get("scripts", {}).get("build") == "tsc && vite build", "Unexpected client build script")
    require(tsconfig.get("include") == ["src"], "Unexpected client tsconfig include")
    require("@types/node" not in client_deps, "Client now declares @types/node; rerun diagnosis")
    require("@types/node" in root_deps, "Root no longer declares @types/node; rerun diagnosis")
    require(len(global_refs) == 14, f"Expected 14 global references, found {len(global_refs)}")
    return {
        "clientBuildScript": client_package["scripts"]["build"],
        "clientTsconfigInclude": tsconfig["include"],
        "clientTypes": tsconfig.get("compilerOptions", {}).get("types", []),
        "clientDeclaresNodeTypes": False,
        "rootDeclaresNodeTypes": True,
        "globalReferences": global_refs,
    }


def update_results(root_cause: dict[str, object]) -> dict[str, object]:
    path = EVIDENCE / "results.json"
    results = json.loads(path.read_text())
    require(results.get("taskId") == TASK_ID, "Wrong task results")
    require(len(results.get("commands", [])) == 14, "Expected 14 recorded commands")
    require(not results.get("failedCommands"), "Prescribed full-install sequence did not pass")
    results.update(
        {
            "status": "VERIFIED",
            "diagnosticWorkflowRunId": RUN_ID,
            "implementationCommit": IMPLEMENTATION_COMMIT,
            "userSuppliedStandaloneClientBuild": {
                "exitCode": 2,
                "errorCode": "TS2304",
                "message": "Cannot find name 'global'",
                "occurrences": 14,
            },
            "rootCause": root_cause,
            "clipboardFailuresReproduced": False,
            "knownFindings": [
                "Client lint completes with one existing unused err warning assigned to P01-T03.",
                "Repository checkout cleanup still reports the stale docs/30-seconds-of-code gitlink warning assigned to P01-T04.",
                "Dependency installation reports existing vulnerabilities for later security/dependency tasks.",
            ],
        }
    )
    path.write_text(json.dumps(results, indent=2) + "\n")
    return results


def write_evidence(results: dict[str, object]) -> None:
    commands = results["commands"]
    command_rows = "\n".join(
        f"| `{row['command']}` | {row['exitCode']} | Passed |" for row in commands
    )
    global_rows = "\n".join(
        f"- `{item['path']}:{item['line']}`" for item in results["rootCause"]["globalReferences"]
    )
    (EVIDENCE / "summary.md").write_text(
        f"""# P01-T01 Reproduction Summary

## Status

`VERIFIED`

## Baseline

- Repository: `DocDamage/chatbot`
- Branch: `{BRANCH}`
- Baseline commit: `{BASE_COMMIT}`
- Evidence implementation commit: `{IMPLEMENTATION_COMMIT}`
- Diagnostic workflow run: `{RUN_ID}`
- Runner: Ubuntu 24.04 x64, Node 20.20.2, npm 10.8.2

## Reproduction result

The user-supplied standalone client build failed before Vite with 14 `TS2304` errors for the Node-style `global` identifier. The exact prescribed monorepo sequence passed after both root and client dependencies were installed. The supplemental client production build also passed and produced the Vite bundle.

The environment comparison identifies a package-isolation defect:

1. `client/tsconfig.json` includes all of `src`, so production `tsc` compiles test files.
2. Fourteen test statements use Node's `global` identifier.
3. The client package does not declare `@types/node`; the root package does.
4. A full root install makes the root Node declarations available during client type resolution and masks the standalone-client failure.

This task records the defect but does not repair it. P01-T02 must make client tests and builds independent of ancestor `node_modules`, while preserving clipboard success and failure coverage.

## Global references reported by the standalone build

{global_rows}

## Other findings

- The previously reported clipboard assertion failures did not reproduce: all 25 client test files and 63 client tests passed.
- Client lint still reports the existing unused `err` warning assigned to P01-T03.
- Server coverage remains approximately 37.83% statements and 28.02% branches.
- The stale `docs/30-seconds-of-code` gitlink cleanup warning remains assigned to P01-T04.
- No application or test source was changed.
"""
    )
    (EVIDENCE / "commands.md").write_text(
        f"""# P01-T01 Commands

| Command | Exit code | Result |
|---|---:|---|
{command_rows}

The user-supplied standalone client-only `npm run build` returned exit code 2 with 14 `TS2304` errors. That environment did not have the root package's Node declarations available.
"""
    )
    (EVIDENCE / "runtime-checklist.md").write_text(
        """# P01-T01 Runtime Checklist

- [x] Clean GitHub-hosted runner used.
- [x] Root and client lockfile installs completed.
- [x] Every prescribed type-check, lint, test, and coverage command executed independently.
- [x] Client tests completed: 25 files and 63 tests passed.
- [x] Supplemental client production build completed and emitted `client/dist`.
- [x] User-supplied standalone client build failure was preserved and explained.
- [x] No repair was performed in this reproduction-only task.
"""
    )
    (EVIDENCE / "changed-files.txt").write_text(
        """.github/workflows/p01-t01-diagnostic.yml (temporary; removed at closure)
docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2/
docs/implementation/evidence/PHASE-01/P01-T01/finalize_p01_t01.py
docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
docs/implementation/RELEASE_EVIDENCE_INDEX.md
docs/implementation/handoffs/archive/P01-T01_HANDOFF.md
docs/implementation/handoffs/CURRENT_HANDOFF.md
"""
    )


def update_tracker() -> None:
    path = ROOT / "docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md"
    text = path.read_text()
    text = re.sub(r"- Current task branch: `[^`]+`", f"- Current task branch: `{BRANCH}`", text, count=1)
    text = re.sub(
        r"- Current verified implementation commit: `[0-9a-f]+`",
        f"- Current verified implementation commit: `{IMPLEMENTATION_COMMIT}`",
        text,
        count=1,
    )
    text = replace_once(
        text,
        "| PHASE 1 | 7 | 0 | 0 | 0 | 7 |",
        "| PHASE 1 | 7 | 1 | 0 | 0 | 6 |",
        "Phase 1 summary row",
    )
    text = replace_once(
        text,
        "| **Total** | **124** | **5** | **0** | **0** | **119** |",
        "| **Total** | **124** | **6** | **0** | **0** | **118** |",
        "total summary row",
    )
    p00_row = "| `P00-T05` | Create GitHub milestones and issues | Codex/GitHub | `VERIFIED` | `agent/p00-t05-create-github-milestones-issues` | `0f687c56d536565c39b2817417862559b1b8efd3` | `docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0` | None | `2026-08-05` | `REQUIRED` |"
    p01_row = f"| `P01-T01` | Reproduce the latest CI failure locally | Codex/GitHub | `VERIFIED` | `{BRANCH}` | `{IMPLEMENTATION_COMMIT}` | `docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2` | None | `2026-08-05` | `REQUIRED` |"
    text = replace_once(text, p00_row, p00_row + "\n" + p01_row, "P00-T05 verified row")
    text = replace_once(
        text,
        "| `P01-T01` | Reproduce the latest CI failure locally |\n",
        "",
        "P01-T01 pending row",
    )
    require(text.count("`P01-T01`") == 1, "Tracker P01-T01 count mismatch")
    path.write_text(text)


def update_index() -> None:
    path = ROOT / "docs/implementation/RELEASE_EVIDENCE_INDEX.md"
    text = path.read_text()
    marker = "Future tasks must append one row only after their evidence bundle and tracker status are complete."
    row = f"| `P01-T01` | `VERIFIED` | `{IMPLEMENTATION_COMMIT}` | `docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2` | `2026-08-05` | Reproduced and explained the standalone-client `global` type failure, executed the complete prescribed command sequence, confirmed the full-install sequence and current clipboard tests pass, and recorded the package-isolation defect for P01-T02. |"
    text = replace_once(text, marker, row + "\n" + marker, "evidence index marker")
    path.write_text(text)


def handoff_text() -> str:
    return f"""# P01-T01 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `{BRANCH}`
- Evidence implementation commit: `{IMPLEMENTATION_COMMIT}`
- Parent/base commit: `{BASE_COMMIT}`
- Diagnostic workflow run: `{RUN_ID}`
- Date: `2026-08-05`

## Authorized task

- Task ID: `P01-T01`
- Title: Reproduce the latest CI failure locally
- Status: `VERIFIED`

## Scope completed

- Executed the complete prescribed installation, type-check, lint, server-test, coverage, and client-test sequence on a clean GitHub-hosted runner.
- Added a supplemental client production build to compare with the user-supplied standalone failure.
- Preserved the standalone build's 14 `TS2304` errors for `global`.
- Confirmed the full monorepo sequence passes because root-installed Node declarations mask a client package-isolation defect.
- Confirmed the earlier LocalRunApprovalPanel and SpriteLabPanel clipboard failures do not reproduce on the current baseline.
- Recorded the remaining lint warning, coverage baseline, dependency findings, and stale gitlink warning without repairing them.
- Did not change application or test source.

## Root cause

`client/tsconfig.json` includes all client `src` files, including tests. Fourteen test statements use Node's `global` identifier. The client package does not declare Node types, while the root package does. A root install therefore masks the standalone client build failure through ancestor type resolution. P01-T02 must remove that environmental dependency rather than merely installing root packages first.

## Verification results

- Prescribed commands: 13/13 passed.
- Supplemental client build: passed in the full-install environment.
- Server coverage: 124 suites passed, 1 skipped; 387 tests passed, 2 skipped.
- Client tests: 25 files and 63 tests passed.
- User-supplied standalone client build: failed with exit code 2 and 14 `TS2304` errors.
- Client lint: completed with one existing unused-variable warning.

## Evidence bundle

- `docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2`

## Next authorized task

- `P01-T02 — Correct clipboard behavior and tests`

## NEW THREAD START PROMPT

You are working on repository `DocDamage/chatbot`.

AUTHORIZED TASK ONLY:
`P01-T02 — Correct clipboard behavior and tests`

Create branch:
`agent/p01-t02-correct-clipboard-tests`

Read before editing:
1. `docs/implementation/handoffs/CURRENT_HANDOFF.md`
2. `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`
3. `docs/implementation/RELEASE_EVIDENCE_INDEX.md`
4. GitHub issue for `P01-T02`
5. `client/package.json`
6. `client/tsconfig.json`
7. all client tests using the `global` identifier
8. `LocalRunApprovalPanel`, `SpriteLabPanel`, and their tests
9. P01-T01 evidence and workflow run `{RUN_ID}`

Requirements:
- Work only on P01-T02.
- Make client test/type declarations package-local and environment-independent.
- Eliminate the 14 standalone-build `TS2304` failures without relying on the root `node_modules` tree.
- Prefer standards-based `globalThis` or a focused browser-test helper over adding broad Node globals to production browser code.
- If production and test TypeScript configurations are separated, keep a required test type-check; do not hide test errors by excluding tests from every gate.
- Preserve and test clipboard success, unavailable-API, permission-rejection, and non-fatal fallback behavior.
- Verify both isolated client installation/build and the complete repository command sequence.
- Do not address the unrelated lint warning, stale gitlink, Pages, CI job architecture, dependency upgrades, or later phase work.
- Do not weaken, skip, delete, bypass, or relabel tests or release gates.
- Keep source files below 300 lines where reasonably possible.
- Record exact commands, exit codes, environment, and commit SHA in the P01-T02 evidence bundle.
- Update tracker/index/handoffs only after all acceptance criteria pass.
- End the thread after P01-T02 is verified or formally blocked; do not begin P01-T03.

Required verification must include at minimum:
```bash
rm -rf node_modules client/node_modules
npm --prefix client ci
npm --prefix client run type-check
npm --prefix client test
npm --prefix client run build
npm ci
npm --prefix client ci
npm run type-check:client
npm --prefix client test
npm --prefix client run build
```

Before editing, report the current branch/commit, inspected files, exact isolated-build reproduction, chosen type-boundary repair, clipboard behavior matrix, and verification plan.

Completion requires committed evidence, not a narrative assertion.

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
"""


def write_handoffs() -> None:
    content = handoff_text()
    archive = ROOT / "docs/implementation/handoffs/archive/P01-T01_HANDOFF.md"
    current = ROOT / "docs/implementation/handoffs/CURRENT_HANDOFF.md"
    require(not archive.exists(), "P01-T01 archive already exists")
    archive.write_text(content)
    current.write_text(content)


def main() -> int:
    root_cause = inspect_root_cause()
    results = update_results(root_cause)
    write_evidence(results)
    update_tracker()
    update_index()
    write_handoffs()
    print("P01-T01 documentation and evidence finalized")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
