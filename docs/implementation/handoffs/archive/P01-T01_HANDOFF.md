# P01-T01 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `agent/p01-t01-reproduce-latest-ci-failure`
- Evidence implementation commit: `b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4`
- Parent/base commit: `7f3b66c2c4ecf10028be6bbee4a68c64f651b8d0`
- Diagnostic workflow run: `30982260932`
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
9. P01-T01 evidence and workflow run `30982260932`

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
