# P01-T06 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Baseline `main` commit: `c0725407eb55575330fcde22e39e784c28395090`
- Task branch: `agent/p01-t06-make-all-ci-stages-execute`
- Verified implementation commit: `7e95e339aa7e5d661bbe67ccad98418cbfbd2960`
- Pull request: `#153`
- Positive CI run: `31017213617`
- Failure-isolation probe run: `31017534074`
- Final restored CI run: `31017624960`
- Date: `2026-08-05`

## Authorized task

- Task ID: `P01-T06`
- Title: Make all current CI stages execute
- Status: `VERIFIED`

## Scope completed

- Replaced the single sequential CI job with independent required jobs.
- Separated repository integrity, type-check, lint, security, server tests, client tests, accessibility, and packaging responsibilities.
- Added non-fail-fast matrices for type-check, lint, server-test, and client-test variants.
- Added an unconditional aggregate required gate.
- Added a repository-enforced CI graph validator.
- Proved failure isolation with a controlled failing run and restored the exact passing workflow.
- Did not begin P01-T07.

## Files changed

- `.github/workflows/ci.yml`: independent jobs, non-fail-fast matrices, and final required gate.
- `scripts/release/verify-ci-graph.mjs`: validates job presence, independence, preserved commands, matrix behavior, and gate logic.
- `docs/implementation/evidence/PHASE-01/P01-T06/2026-08-05_7e95e339/`: task evidence.
- `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`: P01-T06 verified and counts updated.
- `docs/implementation/RELEASE_EVIDENCE_INDEX.md`: P01-T06 evidence indexed.
- Current and archived handoffs: task closure and P01-T07-only authorization.

## Behavior implemented

A failure in one current CI stage no longer prevents unrelated diagnostics from executing. Every current stage runs independently. The `Required CI gate` runs after all required jobs, even when a parent fails, and returns failure unless every parent reports success.

## Tests added or changed

- Added CI graph validation covering required job IDs, job independence, matrix `fail-fast: false`, command preservation, prohibition of `continue-on-error`, and aggregate-gate completeness.
- Executed one positive run, one controlled failure-isolation run, and one final restored positive run.
- No test, threshold, security control, or package check was removed or weakened.

## Verification commands and results

| Command or workflow | Exit/result | Result |
|---|---:|---|
| `bash scripts/release/verify-repository-integrity.sh` | 0 | Passed |
| `node scripts/release/verify-ci-graph.mjs` | 0 | Passed |
| All current type-check commands | 0 | Passed |
| All current lint commands | 0 | Passed |
| Security, routes, services, E2E, and server coverage | 0 | Passed |
| Client tests and coverage | 0 | Passed |
| Current client accessibility command | 0 | Passed |
| `npm run smoke:package` | 0 | Passed |
| CI run `31017213617` | success | All 16 jobs passed |
| CI run `31017534074` | expected failure | One deliberate diagnostic failure; all other diagnostics passed; aggregate gate failed |
| CI run `31017624960` | success | Final restored implementation passed all 16 jobs |

## Runtime QA

- Environment: GitHub Actions on `ubuntu-latest`, Node 20.
- Positive behavior: 15 independent diagnostic job instances executed and the final gate passed.
- Negative behavior: a deliberate security-job failure did not cancel or hide the other diagnostics, and the final gate rejected the workflow.
- Final behavior: probe removed; all jobs and gate passed.
- Evidence: `docs/implementation/evidence/PHASE-01/P01-T06/2026-08-05_7e95e339/runtime-checklist.md`.

## Security and data review

- Workflow permissions are read-only for repository contents.
- No secrets, user data, provider configuration, database schema, or deployment configuration changed.
- No `continue-on-error`, skipped required job, warning-only conversion, or threshold reduction was introduced.

## Known limitations or blockers

- None for P01-T06.
- The existing accessibility script remains TypeScript validation; real accessibility testing is assigned to P03-T04.
- Container build/smoke CI remains assigned to P03-T08.
- Branch protection is not yet configured; that is the next authorized task, P01-T07.

## Evidence bundle

- `docs/implementation/evidence/PHASE-01/P01-T06/2026-08-05_7e95e339`

## Next authorized task

- `P01-T07 — Add branch protection`

## NEW THREAD START PROMPT

You are working on repository `DocDamage/chatbot`.

AUTHORIZED TASK ONLY:
`P01-T07 — Add branch protection`

Create branch:
`agent/p01-t07-add-branch-protection`

Read before changing settings or files:
1. `docs/implementation/handoffs/CURRENT_HANDOFF.md`
2. `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`
3. `docs/implementation/RELEASE_EVIDENCE_INDEX.md`
4. GitHub issue `#35` for P01-T07
5. the P01-T07 section of the authoritative production-completion plan
6. `.github/workflows/ci.yml`
7. `.github/workflows/pages.yml`
8. current repository rules, branch protection, and required-check names through the GitHub API

Requirements:
- Work only on P01-T07.
- Require pull requests before changes reach `main`.
- Require the current aggregate CI check, `Required CI gate`, and any other check that must protect the supported release path.
- Require conversation resolution and an up-to-date branch before merge.
- Block force pushes and branch deletion.
- Require at least one approving review for release-critical changes unless repository-plan limitations require a documented, narrow owner exception.
- Enable signed commits only if practical for this repository and document the decision.
- Preserve the existing Pages protected deployment boundary and do not misclassify Pages as the full product.
- Do not change CI commands or begin Phase 2 work.
- Read back the applied rule/protection configuration through the GitHub API and record exact settings, checks, repository/branch, commit SHA, and evidence.
- Update tracker, evidence index, current handoff, and archived handoff only after verification.
- End the thread after P01-T07 is verified or formally blocked; do not begin P02-T01.

Before changing settings, report the current `main` commit, existing protection/rules configuration, exact required check names from successful runs, proposed protection settings, owner-exception decision, and verification plan.

Completion requires live GitHub settings read-back and committed evidence, not a narrative assertion.

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
