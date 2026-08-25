# AI Chatbot Hub — Current Project Status

Updated: 2026-08-25

## Executive status

The canonical `main` branch is verified for the merged Capability Fusion scope through CF-03. CF-04 through CF-10 have been ported onto `codex/cf04-cf10-integration` from current `main`, but that integration is `IMPLEMENTED_NOT_VERIFIED` and must not be merged or promoted yet.

Current classification:

- Local development on `main`: supported.
- Capability Fusion CF-01 through CF-03: merged and locally experimental.
- Capability Fusion CF-04 through CF-10: integration candidate; not release-verified.
- Hosted production: not certified.
- Public commercial launch: not ready.

## Verified baseline

- `main` commit `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f` passed the complete GitHub Required CI gate in run `32742006979`.
- That run passed type checks, lint, server/client tests, coverage, security, browser E2E, accessibility, migration checks, package/container smoke, repository policy, and release-evidence validation.
- CF-03 remains `LOCAL_ONLY_EXPERIMENTAL`; findings are evidence-backed signals rather than vulnerability proof.
- `main` branch protection is enabled with strict Required CI, pull-request enforcement, administrator enforcement, conversation resolution, and force-push/deletion denial.

## Current integration checkpoint

- Branch: `codex/cf04-cf10-integration`.
- Implementation checkpoint: `315e5db457195f24b0a0d228d4ee5a684d2dfd1f`.
- Coverage checkpoint: `2007291a9b63d821326e95d0618f8df10e9ced6b`.
- Type checks: passed.
- Server and client lint: passed after integration cleanup.
- Focused capability tests: 11 server suites / 154 tests passed.
- Focused Capability Hub client tests: 2 files / 9 tests passed.
- Built-server browser E2E: 7 tests passed during `npm run verify:release`.
- Full server suite under coverage: 182 suites / 720 tests passed, 2 tests skipped.
- Release result: failed at the unchanged uncovered-count policy. The first coverage increment reduced uncovered statements by 130, branches by 125, lines by 113, and functions by 18. Lines now pass; statements remain 147 over budget, branches 511 over, and functions 74 over.
- GitHub PR: draft PR `#171` is open for the integration branch and is intentionally not merge-ready.
- GitHub CI: the initial draft-PR run exposed a handoff-schema defect that was corrected; the unchanged release coverage gate remains the known code blocker on the current integration line.

Passing tests do not override the coverage failure. CF-04 through CF-10 remain `IMPLEMENTED_NOT_VERIFIED` until the exact final PR head passes all gates and receives required review.

## Immediate work

1. Add meaningful branch coverage for the new capability modules without lowering thresholds or broadening exclusions.
2. Keep the capability routes local-only until individual production-promotion gates are satisfied.
3. Run `npm run verify:release` on the corrected integration head, then require the complete GitHub CI matrix to pass on the exact PR head.
4. Reconcile the production feature manifest, tracker, release evidence index, rolling records, and GitHub issues after verification.
5. Complete the real hardware, cross-platform, consent/media-quality, manual accessibility, staging, backup/restore, performance, security, and release-owner gates described by the final completion plan.

## Source of truth

- Feature boundaries: [PRODUCTION_FEATURE_MANIFEST.md](implementation/PRODUCTION_FEATURE_MANIFEST.md)
- Task sequencing and status: [MASTER_PRODUCTION_COMPLETION_TRACKER.md](implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md)
- Final sequence and external gates: [FINAL_COMPLETION_IMPLEMENTATION_PLAN.md](implementation/FINAL_COMPLETION_IMPLEMENTATION_PLAN.md)
- Current task handoff: [CURRENT_HANDOFF.md](implementation/handoffs/CURRENT_HANDOFF.md)
- Exact-commit release evidence: [RELEASE_EVIDENCE_INDEX.md](implementation/RELEASE_EVIDENCE_INDEX.md)

Historical planning and completion documents are retained for audit context. They do not establish current production support.
