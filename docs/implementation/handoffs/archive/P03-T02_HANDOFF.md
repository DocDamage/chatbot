# P03-T02 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `agent/p03-t02-server-coverage-policy`
- Parent `main` commit: `34d67d85cfafaedc03cef9da3678c2a19030458d`
- Tested implementation commit: `b7e81e3935185c06cbaab2fb7e2ee199a69dcaca`
- Pull request: `#159`
- Verification CI: `31066377115` — success
- Date: `2026-08-05`

## Authorized task

- Task ID: `P03-T02`
- Title: Meaningful server coverage policy
- Status: `VERIFIED`

## Scope completed

- Replaced the former 1% global Jest threshold with a machine-readable, risk-based server coverage policy.
- Expanded coverage measurement to every server TypeScript source file except declarations and test/spec files.
- Removed and prohibited the broad `src/**/index.ts` exclusion.
- Locked exact global and Tier A no-regression baselines from an expanded audit run.
- Added count-aware and percentage-aware regression enforcement.
- Added 19 explicit Tier A critical-control source records with final 90% line and 85% branch targets.
- Added Tier B production-supported feature/source mapping with 80% line and 70% branch targets.
- Added global progression stages: locked baseline, 55/45, 65/55, and final 75/65.
- Added machine-readable policy reporting and focused policy regression tests.
- Documented uncovered critical controls honestly instead of excluding them.

## Files changed

- `config/server-coverage-policy.json`: machine-readable scope, baselines, tiers, and milestones.
- `jest.config.js`: imports the policy and enforces exact uncovered-count global baselines.
- `package.json`: makes the policy checker part of the canonical coverage command.
- `scripts/release/run-server-coverage.mjs`: runs Jest coverage and policy enforcement as one gate.
- `scripts/release/check-server-coverage.mjs`: evaluates the generated coverage summary and writes the policy report.
- `scripts/release/lib/server-coverage-policy.mjs`: implements scope, baseline, tier, manifest, and target enforcement.
- `scripts/release/__tests__/server-coverage-policy.test.mjs`: verifies regressions, stages, mappings, and exclusions.
- `docs/implementation/SERVER_COVERAGE_POLICY.md`: documents the active policy and ratchet procedure.
- `docs/architecture/generated/*`: refreshed repository inventory and reachability records.
- `docs/implementation/evidence/PHASE-03/P03-T02/2026-08-05_b7e81e39/*`: task evidence.
- `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`: task status reconciliation.
- `docs/implementation/RELEASE_EVIDENCE_INDEX.md`: release evidence registration.
- `docs/implementation/handoffs/archive/P03-T02_HANDOFF.md`: archived closure handoff.
- `docs/implementation/handoffs/CURRENT_HANDOFF.md`: next-task authorization.

## Behavior implemented

- `npm run test:coverage -- --runInBand` now runs Jest coverage and policy enforcement as one required gate.
- New production server source cannot lower the locked percentage or increase uncovered-item counts without tests.
- Every listed Tier A file has its own no-regression baseline.
- Tier A final targets become mandatory at the final global stage.
- A `PRODUCTION_SUPPORTED` feature cannot be introduced without exact Tier B source mapping.
- Tier B mapped files must satisfy 80% line and 70% branch coverage.
- Broad coverage-only exclusions fail the policy checker.
- Coverage results are emitted to `coverage/server-coverage-policy-report.json`.

## Honest baseline and targets

Expanded Stage 1 baseline:

- Lines: `7,879 / 20,918` — `37.6661%`
- Branches: `3,109 / 11,326` — `27.4501%`
- Functions: `1,719 / 4,624` — `37.1756%`
- Statements: `8,319 / 22,562` — `36.8717%`

Final targets remain:

- Global: 75% lines / 65% branches.
- Tier A: 90% lines / 85% branches.
- Tier B: 80% lines / 70% branches.

P03-T02 verifies the policy and baseline enforcement. It does not falsely claim those final targets are already achieved.

## Tests added or changed

- Added coverage-policy unit tests proving:
  - actual repository policy is locked in enforcement mode;
  - expanded scope includes production index files;
  - lower global percentages fail;
  - more uncovered code fails even at the same percentage;
  - Tier A per-file regressions fail;
  - final-stage Tier A targets are enforced;
  - production-supported features require Tier B source mapping;
  - valid Tier B mappings pass;
  - broad `index.ts` exclusions fail.
- Preserved and passed the complete existing server, client, migration, package, container, documentation, and E2E matrix.

## Verification commands and results

| Command or gate | Exit code | Result |
|---|---:|---|
| GitHub Actions run `31066377115` | 0 | Passed |
| `npm run test:release-tools` | 0 | Passed |
| `npm run test:coverage -- --runInBand` | 0 | 126 suites and 394 tests passed; policy passed |
| Server/client/test type checks | 0 | Passed |
| Server/client lint | 0 | Passed |
| Security, route, and service tests | 0 | Passed |
| Client tests, coverage, and accessibility | 0 | Passed |
| Browser E2E smoke | 0 | Passed |
| PostgreSQL and SQLite migration jobs | 0 | Passed |
| Package smoke | 0 | Passed |
| Container build and smoke | 0 | Passed |
| Documentation and evidence validation | 0 | Passed |
| Aggregate required gate | 0 | Passed |

## Runtime QA

- Direct user-facing runtime QA was not required because this task changes CI coverage enforcement, not application behavior.
- The production package and container smoke tests passed as regression protection.
- Existing application E2E, security, route, service, client, accessibility, and migration checks passed.

## Security and data review

- No authentication, authorization, persistence, or schema behavior changed.
- No tests or required jobs were deleted, skipped, weakened, or made advisory.
- No production source was hidden to improve the reported percentage.
- Five zero-covered Tier A controls remain explicit release gaps:
  - `src/middleware/apiKeyAuth.ts`
  - `src/middleware/security.ts`
  - `src/core/upload/FileProcessor.ts`
  - `src/core/audit/AuditLogger.ts`
  - `src/core/config/ProfileManager.ts`

## Known limitations or blockers

- Current global coverage remains at the honest Stage 1 baseline, below Stage 2 and final targets.
- Tier A final 90/85 targets are not yet achieved.
- No feature is currently classified `PRODUCTION_SUPPORTED`, so Tier B has no active mappings.
- P03-T03 must implement meaningful client coverage thresholds.
- P03-T04 through P03-T08 remain separate authorized tasks.
- P01-T07 remains owner-waived; `main` is intentionally unprotected.

## Evidence bundle

- `docs/implementation/evidence/PHASE-03/P03-T02/2026-08-05_b7e81e39`

## Next authorized task after merge

- `P03-T03 — Implement client coverage thresholds`
- GitHub issue: `#45`

## NEW THREAD START PROMPT

```text
You are working on repository DocDamage/chatbot.

AUTHORIZED TASK ONLY:
P03-T03 — Implement client coverage thresholds

Read these files before making changes:
1. docs/implementation/handoffs/CURRENT_HANDOFF.md
2. docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
3. docs/implementation/PRODUCTION_FEATURE_MANIFEST.md
4. docs/implementation/SERVER_COVERAGE_POLICY.md for the established no-regression model
5. the P03-T03 GitHub issue and all client coverage configuration, reports, components, API clients, and workflow files directly relevant to this task

Rules:
- Work only on P03-T03.
- Confirm PR #159 is merged and inspect the exact current `main` commit before editing.
- Inspect and record the honest current client coverage baseline before changing thresholds.
- Implement meaningful client coverage thresholds for production components, API clients, mode routing, authentication states, dangerous-action confirmation, file/audio/Sprite Lab/local-tool workflows, accessibility paths, and error paths.
- Ensure no critical client workflow remains below 80% line coverage at final policy state.
- Use staged no-regression enforcement where current coverage cannot honestly meet final targets immediately.
- Do not lower thresholds, add broad exclusions, delete tests, replace runtime tests with mock-only tests, or hide production source from coverage.
- Keep source files below 300 lines where reasonably possible and register justified exceptions.
- Do not begin P03-T04 or any later task.
- Run every required verification command and record exact commands, exit codes, workflow runs, and commit SHAs.
- Create the P03-T03 evidence bundle, update the tracker and evidence index, replace/archive the handoff, and end the thread.

Before editing, report:
1. the current branch and commit;
2. the files inspected;
3. the measured client coverage baseline and exclusions;
4. the precise implementation plan for P03-T03;
5. the verification commands that will be run.

Completion requires committed evidence. End the thread after P03-T03 is verified or formally blocked.
```

## Thread closure

This thread is closed. Do not begin P03-T03 here. After PR #159 is merged, start a new thread using the prompt above.
