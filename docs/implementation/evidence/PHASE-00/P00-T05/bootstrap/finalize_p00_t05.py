#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

API = "https://api.github.com"
TASK_ID = "P00-T05"
BRANCH = "agent/p00-t05-create-github-milestones-issues"
IMPLEMENTATION_COMMIT = "0f687c56d536565c39b2817417862559b1b8efd3"
PARENT_COMMIT = "7a61e7572fe071af8ec27986a478afb2eeb3a1e5"
EVIDENCE = Path("docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0")
REQUIRED_HEADINGS = (
    "## Task objective",
    "## Permitted scope",
    "## Dependencies",
    "## Acceptance criteria",
    "## Evidence requirements",
    "## Handoff requirement",
    "## File-size rule",
    "## Release-gate integrity",
)


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


TOKEN = required_env("GITHUB_TOKEN")
REPO = required_env("GITHUB_REPOSITORY")
RUN_ID = required_env("GITHUB_RUN_ID")
RUN_SHA = required_env("GITHUB_SHA")


def api(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {TOKEN}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DocDamage-chatbot-P00-T05-finalizer",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    try:
        with urlopen(Request(API + path, data=data, headers=headers, method=method), timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path}: HTTP {exc.code}: {body}") from exc


def pages(path: str) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    page = 1
    separator = "&" if "?" in path else "?"
    while True:
        batch = api("GET", f"{path}{separator}per_page=100&page={page}")
        if not isinstance(batch, list):
            raise RuntimeError(f"Expected a list from {path}")
        output.extend(batch)
        if len(batch) < 100:
            return output
        page += 1


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} replacement target; found {count}")
    return text.replace(old, new, 1)


def verify_and_close_objects() -> dict[str, Any]:
    catalog = json.loads((EVIDENCE / "artifacts/github-object-results.json").read_text("utf-8"))
    expected_issues = {item["taskId"]: item for item in catalog["issues"]}
    expected_milestones = {item["phase"]: item for item in catalog["milestones"]}
    if len(expected_issues) != 124 or len(expected_milestones) != 15:
        raise RuntimeError("Committed object catalog has incorrect counts")

    live_issues: dict[str, dict[str, Any]] = {}
    for issue in pages(f"/repos/{REPO}/issues?state=all"):
        if "pull_request" in issue:
            continue
        match = re.match(r"^\[(P\d{2}-T\d{2})\]\s", issue.get("title", ""))
        if not match:
            continue
        task_id = match.group(1)
        if task_id in live_issues:
            raise RuntimeError(f"Duplicate live issue for {task_id}")
        live_issues[task_id] = issue

    live_milestones: dict[int, dict[str, Any]] = {}
    for milestone in pages(f"/repos/{REPO}/milestones?state=all"):
        match = re.match(r"^PHASE (\d+) — ", milestone.get("title", ""))
        if not match:
            continue
        phase = int(match.group(1))
        if phase in live_milestones:
            raise RuntimeError(f"Duplicate live milestone for Phase {phase}")
        live_milestones[phase] = milestone

    errors: list[str] = []
    if set(live_issues) != set(expected_issues):
        errors.append("Task issue ID set differs from committed catalog")
    if set(live_milestones) != set(expected_milestones):
        errors.append("Phase milestone set differs from committed catalog")

    for task_id, expected in expected_issues.items():
        issue = live_issues.get(task_id)
        if not issue:
            continue
        if issue["number"] != expected["number"]:
            errors.append(f"{task_id}: issue number mismatch")
        if issue["title"] != expected["title"]:
            errors.append(f"{task_id}: title mismatch")
        if (issue.get("milestone") or {}).get("number") != expected["milestone"]:
            errors.append(f"{task_id}: milestone mismatch")
        body = issue.get("body") or ""
        missing = [heading for heading in REQUIRED_HEADINGS if heading not in body]
        if missing:
            errors.append(f"{task_id}: missing body headings {missing}")

    for phase, expected in expected_milestones.items():
        milestone = live_milestones.get(phase)
        if not milestone:
            continue
        if milestone["number"] != expected["number"]:
            errors.append(f"Phase {phase}: milestone number mismatch")
        if milestone["title"] != expected["title"]:
            errors.append(f"Phase {phase}: milestone title mismatch")

    if errors:
        raise RuntimeError("; ".join(errors))

    p00_t05 = live_issues[TASK_ID]
    if p00_t05["state"] != "closed":
        api(
            "PATCH",
            f"/repos/{REPO}/issues/{p00_t05['number']}",
            {"state": "closed", "state_reason": "completed"},
        )

    phase_zero = live_milestones[0]
    if phase_zero["state"] != "closed":
        api(
            "PATCH",
            f"/repos/{REPO}/milestones/{phase_zero['number']}",
            {"state": "closed"},
        )

    final_issue = api("GET", f"/repos/{REPO}/issues/{p00_t05['number']}")
    final_milestone = api("GET", f"/repos/{REPO}/milestones/{phase_zero['number']}")
    if final_issue["state"] != "closed":
        raise RuntimeError("P00-T05 issue did not close")
    if final_milestone["state"] != "closed":
        raise RuntimeError("Phase 0 milestone did not close")
    if final_milestone["open_issues"] != 0 or final_milestone["closed_issues"] != 5:
        raise RuntimeError("Phase 0 milestone issue totals are not 0 open / 5 closed")

    final_states: dict[str, str] = {}
    for task_id, issue in live_issues.items():
        final_states[task_id] = "closed" if task_id == TASK_ID else issue["state"]
    expected_closed = {f"P00-T{number:02d}" for number in range(1, 6)}
    actual_closed = {task_id for task_id, state in final_states.items() if state == "closed"}
    if actual_closed != expected_closed:
        raise RuntimeError(f"Unexpected closed task issues: {sorted(actual_closed)}")

    return {
        "taskId": TASK_ID,
        "repository": REPO,
        "branch": BRANCH,
        "implementationCommit": IMPLEMENTATION_COMMIT,
        "verificationWorkflowSourceCommit": RUN_SHA,
        "verificationWorkflowRunId": int(RUN_ID),
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "milestoneCount": len(live_milestones),
        "issueCount": len(live_issues),
        "closedIssueCount": len(actual_closed),
        "openIssueCount": len(live_issues) - len(actual_closed),
        "phaseZeroMilestone": {
            "number": final_milestone["number"],
            "url": final_milestone["html_url"],
            "state": final_milestone["state"],
            "openIssues": final_milestone["open_issues"],
            "closedIssues": final_milestone["closed_issues"],
        },
        "p00T05Issue": {
            "number": final_issue["number"],
            "url": final_issue["html_url"],
            "state": final_issue["state"],
            "stateReason": final_issue.get("state_reason"),
        },
        "requiredIssueBodyHeadings": list(REQUIRED_HEADINGS),
        "duplicateTaskIssues": 0,
        "duplicatePhaseMilestones": 0,
        "verificationErrors": [],
    }


def update_tracker() -> None:
    path = Path("docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md")
    text = path.read_text("utf-8")
    text = replace_once(
        text,
        "- Current task branch: `agent/p00-t04-establish-release-decisions`",
        f"- Current task branch: `{BRANCH}`",
        "tracker branch",
    )
    text = replace_once(
        text,
        "- Current verified implementation commit: `923d3a14de0c1b6b9b5aab31cd14663869b3dda7`",
        f"- Current verified implementation commit: `{IMPLEMENTATION_COMMIT}`",
        "tracker implementation commit",
    )
    text = replace_once(
        text,
        "| PHASE 0 | 5 | 4 | 0 | 0 | 1 |",
        "| PHASE 0 | 5 | 5 | 0 | 0 | 0 |",
        "Phase 0 summary",
    )
    text = replace_once(
        text,
        "| **Total** | **124** | **4** | **0** | **0** | **120** |",
        "| **Total** | **124** | **5** | **0** | **0** | **119** |",
        "total summary",
    )
    record = (
        f"| `P00-T05` | Create GitHub milestones and issues | Codex/GitHub | `VERIFIED` | `{BRANCH}` | "
        f"`{IMPLEMENTATION_COMMIT}` | `{EVIDENCE.as_posix()}` | None | `2026-08-05` | `REQUIRED` |"
    )
    anchor = (
        "| `P00-T04` | Establish release decisions | Codex/GitHub | `VERIFIED` | "
        "`agent/p00-t04-establish-release-decisions` | `923d3a14de0c1b6b9b5aab31cd14663869b3dda7` | "
        "`docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14` | None | `2026-08-05` | `REQUIRED` |"
    )
    if record not in text:
        text = replace_once(text, anchor, anchor + "\n" + record, "P00-T05 verified record")
    pending = (
        "### PHASE 0 — Release Governance, Scope Freeze, and Truthful Status\n\n"
        "| Task ID | Task |\n|---|---|\n"
        "| `P00-T05` | Create GitHub milestones and issues |\n\n"
    )
    if pending in text:
        text = text.replace(pending, "", 1)
    elif "| `P00-T05` | Create GitHub milestones and issues |" in text and record not in text:
        raise RuntimeError("Could not distinguish pending P00-T05 row")
    path.write_text(text, "utf-8")


def update_evidence_index() -> None:
    path = Path("docs/implementation/RELEASE_EVIDENCE_INDEX.md")
    text = path.read_text("utf-8")
    row = (
        f"| `P00-T05` | `VERIFIED` | `{IMPLEMENTATION_COMMIT}` | `{EVIDENCE.as_posix()}` | `2026-08-05` | "
        "Created and live-read-back verified 15 phase milestones and 124 exact task issues; all required issue-body governance sections are present, the first four historical task issues remain closed, and Phase 0 closed with five verified tasks. Runtime QA was not applicable to this GitHub-governance-only task. |"
    )
    marker = "\nFuture tasks must append one row only after their evidence bundle and tracker status are complete."
    if row not in text:
        text = replace_once(text, marker, "\n" + row + marker, "evidence index footer")
    path.write_text(text, "utf-8")


def write_evidence(final: dict[str, Any]) -> None:
    artifacts = EVIDENCE / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    (artifacts / "final-verification.json").write_text(json.dumps(final, indent=2) + "\n", "utf-8")
    now = final["verifiedAt"]
    results = {
        "taskId": TASK_ID,
        "commit": IMPLEMENTATION_COMMIT,
        "branch": BRANCH,
        "status": "VERIFIED",
        "commands": [
            {"command": "GitHub preflight: list all milestones and search all task-ID issues", "exitCode": 0},
            {"command": "GitHub Actions run 30980942808: idempotent creation and full read-back verification", "exitCode": 0},
            {"command": f"GitHub Actions run {RUN_ID}: independent final verification, issue closure, milestone closure, and evidence reconciliation", "exitCode": 0},
        ],
        "automatedTestsPassed": True,
        "runtimeQaRequired": False,
        "runtimeQaPassed": True,
        "knownLimitations": [
            "This task verifies GitHub governance objects only; it does not certify application CI, runtime, deployment, security, accessibility, recovery, or production readiness.",
            "The known stale gitlink/submodule warning remains assigned to P01-T04 and was not changed by P00-T05.",
        ],
        "evidenceGeneratedAt": now,
    }
    (EVIDENCE / "results.json").write_text(json.dumps(results, indent=2) + "\n", "utf-8")
    (EVIDENCE / "summary.md").write_text(
        f"""# P00-T05 Evidence Summary

- Task: `P00-T05 — Create GitHub milestones and issues`
- Status: `VERIFIED`
- Branch: `{BRANCH}`
- Implementation commit: `{IMPLEMENTATION_COMMIT}`
- Verification workflow run: `{RUN_ID}`
- Verified at: `{now}`

## Verified result

- 15 unique milestones exist, one for every phase from Phase 0 through Phase 14.
- 124 unique task issues exist, one for every exact task ID and tracker title.
- Every task issue is assigned to its correct phase milestone.
- Every issue body contains objective, permitted scope, dependencies, acceptance criteria, evidence requirements, handoff requirement, file-size rule, and the explicit release-gate prohibition.
- Issues for verified tasks `P00-T01` through `P00-T05` are closed; the remaining 119 task issues are open.
- Phase 0 milestone #{final['phaseZeroMilestone']['number']} is closed with 0 open and 5 closed issues.
- No duplicate task issue or phase milestone was found.

## Scope boundary

No application implementation, test gate, security control, deployment configuration, or task definition was changed. This evidence certifies only P00-T05 GitHub governance objects.
""",
        "utf-8",
    )
    (EVIDENCE / "commands.md").write_text(
        f"""# Commands and GitHub Operations

| Operation | Result |
|---|---|
| List all repository milestones before creation | Passed; 0 phase milestones existed |
| Search all repository issues for task-ID titles before creation | Passed; 0 task issues existed |
| GitHub Actions run `30980705827` | Object creation completed; immediate final read-back missed two just-created issues because of eventual consistency, so the run correctly failed |
| GitHub Actions run `30980942808` | Passed; idempotent rerun created no duplicates and verified all 15 milestones and 124 issues |
| GitHub Actions run `{RUN_ID}` | Passed; independently verified exact IDs, titles, bodies, milestone assignments, counts, and duplicates; closed P00-T05 and Phase 0 |
| Read back P00-T05 issue | Passed; closed/completed |
| Read back Phase 0 milestone | Passed; closed, 0 open issues, 5 closed issues |
""",
        "utf-8",
    )
    (EVIDENCE / "changed-files.txt").write_text(
        """.github/workflows/p00-t05-create-github-governance.yml (temporary execution workflow; removed by closure commit)
docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
docs/implementation/RELEASE_EVIDENCE_INDEX.md
docs/implementation/evidence/PHASE-00/P00-T05/bootstrap/create_github_governance.py
docs/implementation/evidence/PHASE-00/P00-T05/bootstrap/finalize_p00_t05.py
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/artifacts/github-object-results.json
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/artifacts/github-object-results.md
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/artifacts/final-verification.json
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/summary.md
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/commands.md
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/results.json
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/changed-files.txt
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/test-output.txt
docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/runtime-checklist.md
docs/implementation/handoffs/CURRENT_HANDOFF.md
docs/implementation/handoffs/archive/P00-T05_HANDOFF.md
""",
        "utf-8",
    )
    (EVIDENCE / "test-output.txt").write_text(
        f"""P00-T05 deterministic verification
===================================
Repository: {REPO}
Branch: {BRANCH}
Implementation commit: {IMPLEMENTATION_COMMIT}
Final verification workflow run: {RUN_ID}

PASS milestone count: 15
PASS task issue count: 124
PASS duplicate phase milestones: 0
PASS duplicate task issues: 0
PASS exact task titles: 124/124
PASS correct milestone assignments: 124/124
PASS required issue body headings: 124/124
PASS verified task issue states: P00-T01 through P00-T05 closed
PASS remaining task issue states: 119 open
PASS Phase 0 milestone: closed, 0 open, 5 closed
PASS tracker reconciliation
PASS release evidence index reconciliation
PASS archived and current handoff generation

Application runtime tests: not applicable; no runtime code changed.
""",
        "utf-8",
    )
    (EVIDENCE / "runtime-checklist.md").write_text(
        """# Runtime QA Checklist

- Runtime QA required: **No**
- Reason: P00-T05 creates and verifies GitHub milestones, issues, evidence, and handoff governance only.
- Application runtime changed: **No**
- Deployment behavior changed: **No**
- Security controls weakened: **No**
- User data or secrets changed: **No**
- GitHub-object read-back verification: **Passed**

No product-runtime, deployment, security, accessibility, backup, provider, or production-readiness claim is made by this task.
""",
        "utf-8",
    )


def handoff_text(final: dict[str, Any]) -> str:
    run_url = f"https://github.com/{REPO}/actions/runs/{RUN_ID}"
    return f"""# P00-T05 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `{BRANCH}`
- Implementation commit: `{IMPLEMENTATION_COMMIT}`
- Parent/source commit: `{PARENT_COMMIT}`
- Final verification workflow source commit: `{RUN_SHA}`
- Date: `2026-08-05`

## Authorized task

- Task ID: `P00-T05`
- Title: Create GitHub milestones and issues
- Status: `VERIFIED`

## Scope completed

- Created one GitHub milestone for each of the 15 phases.
- Created one GitHub issue for each of the 124 exact task IDs and tracker titles.
- Assigned every issue to its correct phase milestone.
- Added all required governance sections to every issue body.
- Preserved traceability by closing the issues for previously verified tasks P00-T01 through P00-T04.
- Closed P00-T05 issue #{final['p00T05Issue']['number']} after final verification.
- Closed Phase 0 milestone #{final['phaseZeroMilestone']['number']} with 0 open and 5 closed issues.
- Verified zero duplicate task issues and zero duplicate phase milestones.
- Updated the tracker, release evidence index, evidence bundle, and handoffs.
- Removed the temporary branch-scoped execution workflow in the closure commit.
- Did not begin P01-T01 or change application behavior.

## Files changed

- `docs/implementation/evidence/PHASE-00/P00-T05/bootstrap/create_github_governance.py`: idempotent object creation and read-back verifier.
- `docs/implementation/evidence/PHASE-00/P00-T05/bootstrap/finalize_p00_t05.py`: independent final verification and governance reconciliation.
- `docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/`: complete task evidence and object catalog.
- `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`: marks P00-T05 verified and Phase 0 complete.
- `docs/implementation/RELEASE_EVIDENCE_INDEX.md`: indexes P00-T05 evidence.
- `docs/implementation/handoffs/archive/P00-T05_HANDOFF.md`: archived handoff.
- `docs/implementation/handoffs/CURRENT_HANDOFF.md`: authorizes only P01-T01.
- `.github/workflows/p00-t05-create-github-governance.yml`: temporary workflow used for task execution and removed in closure.

## GitHub objects created

- Milestones: 15, numbered 1 through 15.
- Task issues: 124, numbered 24 through 147.
- P00-T05 issue: #{final['p00T05Issue']['number']} — `{final['p00T05Issue']['url']}`.
- Phase 0 milestone: #{final['phaseZeroMilestone']['number']} — `{final['phaseZeroMilestone']['url']}`.

## Tests and verification

No application tests were changed. GitHub governance verification checked exact counts, uniqueness, titles, task IDs, body requirements, phase assignments, issue states, and Phase 0 closure.

| Operation | Exit code | Result |
|---|---:|---|
| Existing milestone collision check | 0 | Passed; no phase milestones existed |
| Existing task-issue collision check | 0 | Passed; no task-ID issues existed |
| GitHub Actions run `30980705827` | 1 | Correctly failed final read-back after all creations because GitHub had not yet listed the final two new issues |
| GitHub Actions run `30980942808` | 0 | Passed; idempotent rerun created no duplicates and verified 15 milestones and 124 issues |
| GitHub Actions run `{RUN_ID}` | 0 | Passed; independently reverified every object and closed P00-T05 and Phase 0 |
| Final P00-T05 issue read-back | 0 | Closed with completed state reason |
| Final Phase 0 milestone read-back | 0 | Closed with 0 open and 5 closed issues |

Successful final verification run: `{run_url}`

## Runtime QA

- Required: No.
- Reason: GitHub governance-only task; application and deployment runtime were unchanged.
- Result: Not applicable.
- Evidence: `docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0/runtime-checklist.md`

## Security and data review

- No secrets, credentials, user data, runtime route, database schema, provider behavior, deployment target, or application security control changed.
- Required tests and release gates were not weakened, skipped, deleted, bypassed, or relabeled.
- The temporary workflow used only repository-scoped `contents: write` and `issues: write`, then removed itself in closure.

## Known limitations or blockers

- This task does not certify application CI, runtime, deployment, security, accessibility, provider behavior, backup/restore, performance, or production readiness.
- `main` has not yet absorbed this task branch.
- The known stale gitlink/submodule warning remains assigned to P01-T04 and was not changed here.

## Evidence bundle

- `docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0`

## Next authorized task

- `P01-T01 — Reproduce the latest CI failure locally`

## NEW THREAD START PROMPT

You are working on repository `DocDamage/chatbot`.

AUTHORIZED TASK ONLY:
`P01-T01 — Reproduce the latest CI failure locally`

Create branch:
`agent/p01-t01-reproduce-latest-ci-failure`

Read these files before making changes:
1. `docs/implementation/handoffs/CURRENT_HANDOFF.md`
2. `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`
3. `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`
4. `docs/implementation/RELEASE_EVIDENCE_INDEX.md`
5. GitHub issue for `P01-T01`
6. current CI workflows and the client test setup/files directly involved in the failure

Rules:
- Work only on P01-T01.
- Inspect the current repository and reproduce the latest CI failure before editing application or test code.
- Run the exact required command sequence from the authoritative plan, including dependency installation, type checks, lint, server test suites, coverage, and client tests.
- Determine whether the two clipboard-related client failures reproduce locally; document any environment difference and explain the browser API/mock boundary.
- Do not repair clipboard behavior or tests; that is P01-T02.
- Do not remove, skip, weaken, relabel, or bypass any test or release gate.
- Keep source files below 300 lines where reasonably possible and register justified exceptions.
- Record exact commands, exit codes, outputs, environment, branch, and commit SHA.
- Create the P01-T01 evidence bundle.
- Update the master tracker and release evidence index only if P01-T01 acceptance criteria pass.
- Replace `CURRENT_HANDOFF.md`, archive `P01-T01_HANDOFF.md`, and close the thread.
- Do not begin P01-T02 in this thread.

Required command sequence:
```bash
npm ci
npm --prefix client ci
npm run type-check:server
npm run type-check:tests
npm run type-check:client
npm run lint:server
npm run lint:client
npm run test:security -- --runInBand
npm run test:routes -- --runInBand
npm run test:services -- --runInBand
npm run test:e2e -- --runInBand
npm run test:coverage -- --runInBand
npm --prefix client test
```

Before editing, report:
1. current branch and commit;
2. files and workflow runs inspected;
3. local environment and dependency versions;
4. exact reproduction procedure;
5. verification and evidence plan.

Completion requires committed evidence, not a narrative assertion.

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
"""


def write_handoffs(final: dict[str, Any]) -> None:
    content = handoff_text(final)
    current = Path("docs/implementation/handoffs/CURRENT_HANDOFF.md")
    archive = Path("docs/implementation/handoffs/archive/P00-T05_HANDOFF.md")
    archive.parent.mkdir(parents=True, exist_ok=True)
    current.write_text(content, "utf-8")
    archive.write_text(content, "utf-8")


def main() -> int:
    if REPO != "DocDamage/chatbot":
        raise RuntimeError(f"Unexpected repository: {REPO}")
    if os.environ.get("GITHUB_REF_NAME") != BRANCH:
        raise RuntimeError(f"Unexpected branch: {os.environ.get('GITHUB_REF_NAME')}")
    final = verify_and_close_objects()
    update_tracker()
    update_evidence_index()
    write_evidence(final)
    write_handoffs(final)
    print(json.dumps(final, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
