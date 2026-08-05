from datetime import datetime, timezone
from pathlib import Path
import json

TASK_ID = 'P01-T04'
BRANCH = 'agent/p01-t04-repair-gitlink-integrity'
IMPLEMENTATION_COMMIT = '7995961b0b6c2f2fc847da8ade16d2df594aee27'
BASE_COMMIT = 'c2ea947b30f514c5c7b32015e8aba82bfc644451'
REMOVAL_COMMIT = '31efa77140e3937aa093d120805e7f8a425aada5'
RUN_ID = '30987598336'
JOB_ID = '92245900469'
PR_NUMBER = '150'
EVIDENCE_PATH = Path('docs/implementation/evidence/PHASE-01/P01-T04/2026-08-05_7995961b')


def write_evidence() -> None:
    EVIDENCE_PATH.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')

    (EVIDENCE_PATH / 'summary.md').write_text(f'''# P01-T04 Verification Summary

## Result

- Task: `P01-T04 — Repair stale gitlink/submodule state`
- Status: `VERIFIED`
- Branch: `{BRANCH}`
- Base commit: `{BASE_COMMIT}`
- Verified implementation commit: `{IMPLEMENTATION_COMMIT}`
- Gitlink-removal commit: `{REMOVAL_COMMIT}`
- Pull request: `#{PR_NUMBER}`
- GitHub Actions run: `{RUN_ID}`
- GitHub Actions job: `{JOB_ID}`

## Reproduced baseline

The base tree contained five mode-`160000` entries under `docs/` and no `.gitmodules` file. A malformed-gitlink fixture reproduced `git submodule status` exit `128` with `fatal: no submodule mapping found in .gitmodules for path ...`, matching the repository cleanup failure mechanism.

The affected paths were `docs/30-seconds-of-code`, `docs/30-seconds-of-csharp`, `docs/C_Sharp_Examples`, `docs/code-snippets`, and `docs/snippets`.

## Repair

All five undocumented gitlinks were removed. The checked-in `docs/all_extracted_snippets.json` and `docs/extracted_snippets.json` datasets remain intact and continue to supply the application; no runtime source imports the removed directories.

A reusable repository-integrity script now executes the mandated index, submodule, and object-database checks and repeats them after an isolated clone and detached checkout. CI runs it immediately after checkout.

## Verification outcome

- `git ls-files --stage`: passed; no mode-`160000` entry remains.
- `git submodule status`: passed with no missing mapping.
- `git fsck --full`: passed.
- Clean clone and detached exact-commit checkout: passed.
- Checkout and post-checkout cleanup: passed without the stale submodule warning.
- Complete existing CI job: passed.

## Scope control

No GitHub Pages, CI job restructuring, branch protection, dependency upgrade, application feature, or later-phase work was performed.
''', encoding='utf-8')

    (EVIDENCE_PATH / 'commands.md').write_text(f'''# P01-T04 Commands and Results

| Command or check | Exit code | Result |
|---|---:|---|
| base-tree mode inspection at `{BASE_COMMIT}` | 0 | Found five mode-`160000` entries and no `.gitmodules` file. |
| malformed-gitlink fixture: `git submodule status` | 128 (expected) | Reproduced the missing `.gitmodules` mapping failure mechanism. |
| `git ls-files --stage` | 0 | Passed at `{IMPLEMENTATION_COMMIT}`; no gitlink entry remained. |
| `git submodule status` | 0 | Passed with no output and no missing mapping. |
| `git fsck --full` | 0 | Passed with no integrity error. |
| `git clone --no-local --no-recurse-submodules . <temp>` | 0 | Created an isolated clone. |
| `git -C <temp> checkout --detach {IMPLEMENTATION_COMMIT}` | 0 | Exact implementation commit checked out. |
| clone `git ls-files --stage` / `git submodule status` / `git fsck --full` | 0 | All clean-clone integrity checks passed. |
| GitHub Actions CI run `{RUN_ID}` | 0 | Repository integrity and the complete existing CI sequence passed. |
''', encoding='utf-8')

    results = {
        'taskId': TASK_ID,
        'commit': IMPLEMENTATION_COMMIT,
        'branch': BRANCH,
        'status': 'VERIFIED',
        'commands': [
            {'command': 'git ls-files --stage', 'exitCode': 0},
            {'command': 'git submodule status', 'exitCode': 0},
            {'command': 'git fsck --full', 'exitCode': 0},
            {'command': 'git clone --no-local --no-recurse-submodules . <temp>', 'exitCode': 0},
            {'command': f'git -C <temp> checkout --detach {IMPLEMENTATION_COMMIT}', 'exitCode': 0},
            {'command': 'clean-clone index/submodule/fsck verification', 'exitCode': 0},
        ],
        'automatedTestsPassed': True,
        'runtimeQaRequired': True,
        'runtimeQaPassed': True,
        'knownLimitations': [],
        'evidenceGeneratedAt': generated_at,
        'workflowRun': RUN_ID,
        'workflowJob': JOB_ID,
        'pullRequest': int(PR_NUMBER),
    }
    (EVIDENCE_PATH / 'results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')

    (EVIDENCE_PATH / 'changed-files.txt').write_text('''.github/workflows/ci.yml
docs/30-seconds-of-code (removed gitlink)
docs/30-seconds-of-csharp (removed gitlink)
docs/C_Sharp_Examples (removed gitlink)
docs/code-snippets (removed gitlink)
docs/snippets (removed gitlink)
scripts/release/verify-repository-integrity.sh
''', encoding='utf-8')

    (EVIDENCE_PATH / 'test-output.txt').write_text(f'''# P01-T04 Test Output Summary

- Base commit index inspection: five mode-`160000` entries; `.gitmodules` absent.
- Malformed fixture: expected exit `128` and missing-mapping fatal message.
- Repository integrity CI step: passed.
- Clean clone and detached checkout: passed.
- `git ls-files --stage`: passed with no gitlinks.
- `git submodule status`: passed with no output.
- `git fsck --full`: passed.
- Checkout post-step: passed without a cleanup warning.
- All existing type-check, lint, security, route/service, E2E, coverage, client, accessibility, and packaging steps passed.
- Verification run: `{RUN_ID}`; job: `{JOB_ID}`.

Raw logs remain in GitHub Actions. This committed summary contains no secrets or private data.
''', encoding='utf-8')

    (EVIDENCE_PATH / 'runtime-checklist.md').write_text(f'''# P01-T04 Runtime Checklist

- Runtime QA type: repository checkout and integrity behavior.
- Exact implementation commit: `{IMPLEMENTATION_COMMIT}`.
- Fresh clone created in a new temporary directory: passed.
- Detached checkout of the exact commit: passed.
- Index inspection in source and clone: passed.
- Submodule status in source and clone: passed without a mapping warning.
- Full object verification in source and clone: passed.
- GitHub Actions checkout and post-checkout cleanup: passed.
- Application runtime QA: not applicable; no application behavior or generated snippet dataset changed.
''', encoding='utf-8')


def update_tracker() -> None:
    path = Path('docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md')
    text = path.read_text(encoding='utf-8')
    replacements = {
        '- Current task branch: `agent/p01-t03-remove-client-lint-warning`': f'- Current task branch: `{BRANCH}`',
        '- Current verified implementation commit: `12b4088671cf5c828dd8e6b430b5320b5544016c`': f'- Current verified implementation commit: `{IMPLEMENTATION_COMMIT}`',
        '| PHASE 1 | 7 | 3 | 0 | 0 | 4 |': '| PHASE 1 | 7 | 4 | 0 | 0 | 3 |',
        '| **Total** | **124** | **8** | **0** | **0** | **116** |': '| **Total** | **124** | **9** | **0** | **0** | **115** |',
        '| `P01-T04` | Repair stale gitlink/submodule state |\n': '',
    }
    for old, new in replacements.items():
        if text.count(old) != 1:
            raise SystemExit(f'Tracker replacement count for {old!r}: {text.count(old)}')
        text = text.replace(old, new)
    anchor = '| `P01-T03` | Remove the client lint warning | Codex/GitHub | `VERIFIED` | `agent/p01-t03-remove-client-lint-warning` | `12b4088671cf5c828dd8e6b430b5320b5544016c` | `docs/implementation/evidence/PHASE-01/P01-T03/2026-08-05_12b40886` | None | `2026-08-05` | `REQUIRED` |\n'
    row = f'| `P01-T04` | Repair stale gitlink/submodule state | Codex/GitHub | `VERIFIED` | `{BRANCH}` | `{IMPLEMENTATION_COMMIT}` | `{EVIDENCE_PATH.as_posix()}` | None | `2026-08-05` | `REQUIRED` |\n'
    if text.count(anchor) != 1:
        raise SystemExit('P01-T03 tracker anchor missing or duplicated')
    path.write_text(text.replace(anchor, anchor + row), encoding='utf-8')


def update_index() -> None:
    path = Path('docs/implementation/RELEASE_EVIDENCE_INDEX.md')
    text = path.read_text(encoding='utf-8')
    anchor = 'Future tasks must append one row only after their evidence bundle and tracker status are complete.'
    if text.count(anchor) != 1:
        raise SystemExit('Evidence index anchor missing or duplicated')
    row = f'| `P01-T04` | `VERIFIED` | `{IMPLEMENTATION_COMMIT}` | `{EVIDENCE_PATH.as_posix()}` | `2026-08-05` | Removed five malformed undocumented gitlinks, preserved the checked-in runtime datasets, and passed index, submodule, fsck, clean-clone, checkout-cleanup, and full CI verification. |\n'
    path.write_text(text.replace(anchor, row + anchor), encoding='utf-8')


def write_handoff() -> None:
    handoff = f'''# P01-T04 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `{BRANCH}`
- Verified implementation commit: `{IMPLEMENTATION_COMMIT}`
- Gitlink-removal commit: `{REMOVAL_COMMIT}`
- Task branch base commit: `{BASE_COMMIT}`
- Pull request: `#{PR_NUMBER}`
- Verification workflow run: `{RUN_ID}`
- Verification workflow job: `{JOB_ID}`
- Date: `2026-08-05`

## Authorized task

- Task ID: `P01-T04`
- Title: Repair stale gitlink/submodule state
- Status: `VERIFIED`

## Scope completed

- Identified five mode-`160000` `docs/` gitlinks with no `.gitmodules` mappings.
- Confirmed the application uses checked-in generated JSON datasets rather than the linked directories.
- Removed all five undocumented external dependencies.
- Added a reusable repository-integrity script and a focused CI step.
- Verified the exact commit, a clean clone, checkout cleanup, and the complete existing CI sequence.
- Did not start P01-T05.

## Files changed

- `.github/workflows/ci.yml`: runs repository integrity verification immediately after checkout.
- `scripts/release/verify-repository-integrity.sh`: runs index, submodule, fsck, and clean-clone checks.
- `docs/30-seconds-of-code`: removed malformed gitlink.
- `docs/30-seconds-of-csharp`: removed malformed gitlink.
- `docs/C_Sharp_Examples`: removed malformed gitlink.
- `docs/code-snippets`: removed malformed gitlink.
- `docs/snippets`: removed malformed gitlink.
- `{EVIDENCE_PATH.as_posix()}/`: committed exact-commit evidence.
- Tracker, evidence index, current handoff, and archived handoff: updated for closure.

## Behavior implemented

Repository checkout no longer encounters undocumented gitlinks lacking `.gitmodules` mappings. The two checked-in snippet JSON datasets and their runtime consumer remain unchanged.

## Tests added or changed

- Added repository-integrity verification covering the mandated commands and a fresh clone/detached checkout.
- No application test was removed, skipped, or weakened.

## Verification commands and results

| Command | Exit code | Result |
|---|---:|---|
| `git ls-files --stage` | 0 | Passed; no mode-`160000` entry remained |
| `git submodule status` | 0 | Passed; no missing mapping |
| `git fsck --full` | 0 | Passed |
| isolated clone and exact detached checkout | 0 | Passed |
| clone index/submodule/fsck checks | 0 | Passed |
| full GitHub Actions CI run `{RUN_ID}` | 0 | Passed, including checkout cleanup |

## Runtime QA

- Environment: GitHub-hosted Ubuntu runner plus isolated temporary clone.
- Result: Clean clone and exact detached checkout passed without the stale submodule warning.
- Application runtime QA: not applicable because no application behavior or generated runtime dataset changed.
- Evidence: `{EVIDENCE_PATH.as_posix()}/runtime-checklist.md`.

## Security and data review

- Removed undocumented external repository references instead of inventing or trusting unknown URLs.
- No secret, user data, database, authorization, provider, or dependency content changed.
- No release gate was weakened.

## Known limitations or blockers

- None for P01-T04.
- GitHub Pages remains assigned to P01-T05.

## Evidence bundle

- `{EVIDENCE_PATH.as_posix()}`

## Next authorized task

- `P01-T05 — Decide and repair GitHub Pages`

## NEW THREAD START PROMPT

You are working on repository `DocDamage/chatbot`.

AUTHORIZED TASK ONLY:
`P01-T05 — Decide and repair GitHub Pages`

Create branch:
`agent/p01-t05-decide-repair-github-pages`

Read before editing:
1. `docs/implementation/handoffs/CURRENT_HANDOFF.md`
2. `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`
3. `docs/implementation/RELEASE_EVIDENCE_INDEX.md`
4. the GitHub issue for `P01-T05`
5. the P01-T05 section of the authoritative production-completion plan
6. the Pages ADR and current Pages workflow
7. current repository Pages settings and latest deployment failure

Requirements:
- Work only on P01-T05.
- Decide whether Pages is disabled, a static demo, or a frontend for a separately hosted API.
- Implement only the selected, documented outcome.
- Do not expose secrets in the client build.
- If Pages remains, add accurate limitation messaging, safe runtime API configuration, and a deployment smoke check.
- If Pages is removed, delete the workflow and all stale claims/links while preserving the real production deployment path.
- Do not restructure general CI, add branch protection, or begin later tasks.
- Record exact commands, settings, workflow/deployment results, commit SHA, and runtime evidence.
- Update tracker/index/handoffs only after all acceptance criteria pass.
- End the thread after P01-T05 is verified or formally blocked; do not begin P01-T06.

Before editing, report the current branch/commit, inspected ADR/workflow/settings/run, reproduced deployment state, selected outcome with rationale, and verification plan.

Completion requires committed evidence, not a narrative assertion.

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
'''
    Path('docs/implementation/handoffs/CURRENT_HANDOFF.md').write_text(handoff, encoding='utf-8')
    archive = Path('docs/implementation/handoffs/archive/P01-T04_HANDOFF.md')
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.write_text(handoff, encoding='utf-8')


def cleanup() -> None:
    for path in [Path('scripts/p01-t04-finalize.py'), Path('.github/workflows/p01-t04-finalize.yml')]:
        if path.exists():
            path.unlink()


def main() -> None:
    write_evidence()
    update_tracker()
    update_index()
    write_handoff()
    cleanup()


if __name__ == '__main__':
    main()
