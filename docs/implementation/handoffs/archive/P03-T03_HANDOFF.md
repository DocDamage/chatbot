# P03-T03 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `agent/p03-t03-client-coverage-thresholds`
- Parent `main` commit: `9c7db84590be3eb5955eae732308ee574171f731`
- Tested implementation commit: `23fcb9b18348bd05cc95c66d29e799ebb03252e8`
- Clean verification commit: `fd996d8e0843efb9f4f7ff28245d6542586686cf`
- Pull request: `#160`
- Verification CI: `31069162209` — success
- Date: `2026-08-05`

## Authorized task

- Task ID: `P03-T03`
- Title: Implement client coverage thresholds
- Status: `VERIFIED`

## Scope completed

- Replaced the former 5% client coverage threshold with an auditable policy.
- Expanded coverage to all production TypeScript/TSX client sources.
- Restored the application entry point to coverage scope.
- Locked exact global and 29-file critical-workflow baselines.
- Added count-aware and percentage-aware no-regression enforcement.
- Mapped production components, every API client, mode routing, authentication-related states, dangerous actions, file/audio/Sprite Lab/local-tool workflows, accessibility status, and error paths.
- Added global stages ending at 80% lines / 70% branches.
- Added a final per-critical-file minimum of 80% lines / 70% branches.
- Added eight coverage-policy regression tests and machine-readable reporting.
- Refreshed generated repository inventory and committed task evidence.

## Files changed

- `config/client-coverage-policy.json`: scope, exact baselines, critical files, workflows, and staged targets.
- `client/package.json`: canonical client coverage command now runs policy tests and enforcement.
- `client/vite.config.ts`: imports the policy while preserving existing runtime and Pages safeguards.
- `client/tsconfig.node.json`: enables typed JSON configuration imports.
- `scripts/release/check-client-coverage.mjs`: generates the policy report and fails violations.
- `scripts/release/lib/client-coverage-policy.mjs`: implements scope, baseline, workflow, and target enforcement.
- `scripts/release/__tests__/client-coverage-policy.test.mjs`: verifies locked baselines and negative cases.
- `docs/architecture/generated/*`: canonical generated inventory refresh.
- `docs/implementation/evidence/PHASE-03/P03-T03/2026-08-05_23fcb9b1/*`: task evidence.
- `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`: task status reconciliation.
- `docs/implementation/RELEASE_EVIDENCE_INDEX.md`: evidence registration.
- `docs/implementation/handoffs/archive/P03-T03_HANDOFF.md`: archived closure handoff.
- `docs/implementation/handoffs/CURRENT_HANDOFF.md`: next-task authorization.

## Behavior implemented

- `npm --prefix client run coverage` now runs policy tests, full production-source client coverage, and the policy checker as one gate.
- New uncovered production code cannot reduce global or critical-file percentages or increase uncovered counts.
- Broad production exclusions fail the checker.
- Missing workflow mappings fail the checker.
- Final-stage critical files below 80% line or 70% branch coverage fail.
- Reports include text, LCOV, JSON summary, and `client/coverage/client-coverage-policy-report.json`.

## Honest baseline and targets

Expanded Stage 1 baseline:

- Lines: `912 / 1,549` — `58.8767%`
- Branches: `589 / 1,210` — `48.6777%`
- Functions: `261 / 574` — `45.4704%`
- Statements: `970 / 1,744` — `55.6193%`

Staged targets:

- Stage 2: 65% lines / 55% branches.
- Stage 3: 75% lines / 65% branches.
- Final global: 80% lines / 70% branches.
- Final critical workflow file: 80% lines / 70% branches.

P03-T03 verifies policy enforcement. It does not claim the final target is already achieved.

## Tests added or changed

- Added eight policy tests proving:
  - the repository policy is locked in enforcement mode;
  - production entry points remain in scope;
  - global percentage regression fails;
  - added uncovered code fails even without a percentage drop;
  - critical-file regression fails;
  - final 80% per-file line coverage is enforced;
  - missing workflow mappings fail;
  - broad production exclusions fail.
- Preserved the existing client, server, security, migration, package, container, documentation, and E2E matrix.

## Verification commands and results

| Command or gate | Exit code | Result |
|---|---:|---|
| GitHub Actions run `31069162209` | 0 | Passed |
| `node --test scripts/release/__tests__/client-coverage-policy.test.mjs` | 0 | 8 tests passed |
| `npm --prefix client run coverage` | 0 | 29 files / 76 tests passed; policy passed |
| Client/server/test type checks and lint | 0 | Passed |
| Security, route, service, and E2E smoke | 0 | Passed |
| Repository inventory and docs validation | 0 | Passed |
| Package and container smoke | 0 | Passed |
| Migration and evidence validation | 0 | Passed |
| Aggregate required gate | 0 | Passed |

## Runtime QA

- Direct user-facing runtime QA was not required because this task changes verification policy, not application behavior.
- Existing E2E, package, and container smoke checks passed as regression protection.

## Security and data review

- No authentication, authorization, persistence, migration, or user-data behavior changed.
- No tests or release gates were weakened.
- No production source was hidden to raise the percentage.
- Authentication-related coverage maps to actual runtime and API error/state code because the client has no dedicated authentication module.

## Known limitations or blockers

- Current global coverage remains at the honest Stage 1 baseline.
- Several critical workflows remain below the final 80/70 target and must gain meaningful tests before the final stage is activated.
- The current accessibility script remains a TypeScript-only check; P03-T04 must replace it with real accessibility testing.
- P03-T05 through P03-T08 remain separate tasks.
- P01-T07 remains owner-waived; `main` is intentionally unprotected.

## Evidence bundle

- `docs/implementation/evidence/PHASE-03/P03-T03/2026-08-05_23fcb9b1`

## Next authorized task after merge

- `P03-T04 — Replace fake accessibility testing`
- GitHub issue: `#46`

## NEW THREAD START PROMPT

```text
You are working on repository DocDamage/chatbot.

AUTHORIZED TASK ONLY:
P03-T04 — Replace fake accessibility testing

Read these files before making changes:
1. docs/implementation/handoffs/CURRENT_HANDOFF.md
2. docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
3. docs/implementation/PRODUCTION_FEATURE_MANIFEST.md
4. config/client-coverage-policy.json
5. the P03-T04 GitHub issue and all accessibility scripts, client tests, rendered panels, Playwright/browser configuration, and CI files directly relevant to this task

Rules:
- Work only on P03-T04.
- Confirm PR #160 is merged and inspect the exact current `main` commit before editing.
- Replace the TypeScript-only accessibility label with real accessibility testing; retain TypeScript checking under its own truthful script.
- Add automated Axe checks for major rendered panels.
- Add Playwright accessibility scans for complete workflows.
- Add keyboard-only E2E tests, focus restoration tests, and accessible live-region tests for asynchronous results.
- Add color-contrast scanning where supported and a manual screen-reader checklist.
- Do not weaken, skip, relabel, or make accessibility checks advisory to pass CI.
- Preserve the P03-T03 client coverage policy and add meaningful accessibility/error-path coverage where new tests exercise production code.
- Keep source files below 300 lines where reasonably possible and register justified exceptions.
- Do not begin P03-T05 or any later task.
- Run every required verification command and record exact commands, exit codes, workflow runs, and commit SHAs.
- Create the P03-T04 evidence bundle, update the tracker and evidence index, replace/archive the handoff, and end the thread.

Before editing, report:
1. the current branch and commit;
2. the files and workflows inspected;
3. the exact false-green accessibility behavior reproduced;
4. the precise implementation plan for P03-T04;
5. the verification commands that will be run.

Completion requires committed evidence. End the thread after P03-T04 is verified or formally blocked.
```

## Thread closure

This thread is closed. Do not begin P03-T04 here. After PR #160 is merged, start a new thread using the prompt above.
