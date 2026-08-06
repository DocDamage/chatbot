# P03-T01 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `agent/p03-t01-split-harden-ci-jobs`
- Parent commit: `9c5394cafa0e015fbf75cae58b52d125ba02dbaa`
- Implementation commit: `34f01ce7f8aa52b4579b6aa883c8c9c6c7a1a594`
- Pull request: `#158`
- Verification CI: `31062952540` — success
- Date: `2026-08-05`

## Authorized task

- Task ID: `P03-T01`
- Title: Split and harden CI jobs
- Status: `VERIFIED`

## Scope completed

- Replaced grouped type-check, lint, server-test, and client-test matrices with 18 independently executing required jobs.
- Added an aggregate `required-gate` that executes unconditionally and rejects every non-success result.
- Added Node 22 and Node 24 lockfile/install/type-compatibility coverage.
- Preserved all current type, lint, security, route, service, client, E2E-smoke, coverage, accessibility, packaging, and Phase 2 policy commands.
- Added isolated current migration coverage, Docker image build/liveness smoke, and release-evidence validation jobs.
- Hardened CI graph validation against dependencies between independent jobs, floating action branches, missing commands, and incomplete aggregation.
- Added a multi-stage production image and deterministic smoke harness.
- Kept the documentation job read-only and currentness-enforcing.

## Files changed

- `.dockerignore`: excludes local and generated build state from container context.
- `.github/workflows/ci.yml`: defines the independent job graph and aggregate gate.
- `Dockerfile`: builds and runs the production server/client image as a non-root user.
- `docs/architecture/generated/reachability-map.json`: refreshed generated inventory evidence.
- `docs/architecture/generated/repository-inventory.json`: refreshed generated inventory evidence.
- `docs/architecture/generated/repository-inventory.md`: refreshed generated inventory evidence.
- `package.json`: restores lint toolchain declarations and exposes inventory generation.
- `scripts/release/check-release-evidence.mjs`: validates tracker/index/evidence consistency.
- `scripts/release/smoke-container.sh`: verifies image build and application liveness.
- `scripts/release/verify-ci-graph.mjs`: enforces the required CI structure.

## Behavior implemented

- A failure in one CI concern no longer prevents unrelated required diagnostics from running.
- Node 22 and Node 24 compatibility are both checked from lockfiles.
- The final required gate cannot pass if a required job fails, is cancelled, or is skipped.
- Repository inventory is regenerated and diff-checked without granting write access.
- The production image must build and expose the live health endpoint.
- Verified-task metadata must agree across tracker, evidence index, and committed results.

## Tests added or changed

- Expanded `verify-ci-graph.mjs` into a deterministic CI topology/policy validator.
- Added `check-release-evidence.mjs` for current and legacy evidence schemas.
- Added Docker build/liveness smoke execution.
- Added isolated current migration-test execution.

## Verification commands and results

| Command or gate | Exit code | Result |
|---|---:|---|
| GitHub Actions CI run `31062952540` | 0 | Passed |
| Repository integrity and CI graph | 0 | Passed |
| Dependency/lockfile integrity — Node 22 | 0 | Passed |
| Dependency/lockfile integrity — Node 24 | 0 | Passed |
| Server, client, and test type checks | 0 | Passed |
| Server and client lint | 0 | Passed |
| Server route/service tests and client tests | 0 | Passed |
| Current E2E and accessibility scripts | 0 | Passed with documented transitional scope |
| Server and client coverage | 0 | Passed at current thresholds |
| Current SQLite migration test | 0 | Passed |
| Docker build and liveness smoke | 0 | Passed |
| Package smoke | 0 | Passed |
| Documentation and repository policy validation | 0 | Passed |
| Release evidence validation | 0 | Passed |
| Aggregate required gate | 0 | Passed |

## Runtime QA

- Environment: GitHub-hosted Ubuntu runner, Node 22/24 matrix, Docker Engine.
- Steps: built the production image, started it with test-safe configuration, polled `/health/live`, and verified a successful response.
- Result: Passed.
- Evidence: CI run `31062952540`, Docker job `92494611728`.

## Security and data review

- CI has repository-level read-only permissions.
- No `continue-on-error` or skipped required-gate behavior was introduced.
- Container runs as the non-root `node` user.
- No schema or user-data changes were made.

## Known limitations or blockers

- P03-T02 must implement risk-based server coverage thresholds.
- P03-T03 must implement final client coverage thresholds.
- P03-T04 must replace the current TypeScript-only accessibility script with actual accessibility tests.
- P03-T05 must replace the current smoke harness with real browser E2E tests.
- P03-T06 must implement supply-chain, secret, license, SBOM, and image scanning gates.
- P03-T07 must implement PostgreSQL and full migration CI; P03-T01 executes only the current SQLite migration test.
- P03-T08 must expand container/package smoke to migrations, readiness, authentication, restart, persistence, and clean shutdown.
- P01-T07 remains owner-waived; `main` is intentionally unprotected.

## Evidence bundle

- `docs/implementation/evidence/PHASE-03/P03-T01/2026-08-05_34f01ce7`

## Next authorized task after merge

- `P03-T02 — Implement meaningful server coverage policy`

## NEW THREAD START PROMPT

```text
You are working on repository DocDamage/chatbot.

AUTHORIZED TASK ONLY:
P03-T02 — Implement meaningful server coverage policy

Read before editing:
1. docs/implementation/handoffs/CURRENT_HANDOFF.md
2. docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
3. docs/implementation/PRODUCTION_FEATURE_MANIFEST.md
4. the P03-T02 GitHub issue
5. jest.config.js, current coverage reports, and production source manifests

Rules:
- Work only on P03-T02.
- Confirm PR #158 is merged and inspect the exact `main` commit before editing.
- Inventory current coverage by the Phase 3 risk tiers before changing thresholds or tests.
- Implement meaningful server coverage policy without beginning P03-T03 or later tasks.
- Do not lower thresholds, add broad exclusions, delete tests, replace runtime tests with mock-only tests, or hide production source from coverage.
- Raise coverage through risk-focused tests and no-regression enforcement according to the production plan.
- Keep source files below 300 lines where reasonably possible and register justified exceptions.
- Run all task-required verification and record exact commands, exit codes, workflow runs, and commit SHAs.
- Create P03-T02 evidence, update the tracker/index, replace/archive the handoff, and end the thread.
- Do not begin P03-T03 in this thread.
```

## Thread closure

This thread is closed. Do not begin P03-T02 here. After PR #158 is merged, start a new thread using the prompt above.