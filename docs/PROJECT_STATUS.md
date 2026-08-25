# AI Chatbot Hub — Current Project Status

Updated: 2026-08-25

## Executive status

The canonical `main` branch is verified for the merged Capability Fusion scope through CF-03. CF-04 through CF-10 pass the complete local release and GitHub Required CI gates on `codex/cf04-cf10-integration`; independent human review remains required before merge. Maturity remains `LOCAL_ONLY_EXPERIMENTAL`.

Current classification:

- Local development on `main`: supported.
- Capability Fusion CF-01 through CF-03: merged and locally experimental.
- Capability Fusion CF-04 through CF-10: automated-release-verified integration candidate; human review pending.
- Hosted production: not certified.
- Public commercial launch: not ready.

## Verified baseline

- `main` commit `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f` passed the complete GitHub Required CI gate in run `32742006979`.
- That run passed type checks, lint, server/client tests, coverage, security, browser E2E, accessibility, migration checks, package/container smoke, repository policy, and release-evidence validation.
- CF-03 remains `LOCAL_ONLY_EXPERIMENTAL`; findings are evidence-backed signals rather than vulnerability proof.
- `main` branch protection is enabled with strict Required CI, pull-request enforcement, administrator enforcement, conversation resolution, and force-push/deletion denial.

## Current integration checkpoint

- Branch: `codex/cf04-cf10-integration`.
- Implementation and local-release checkpoint: `aec8871623870623204bc93e90ebeb52dd51aea0`.
- Server type checks, test type checks, server/client lint, security/routes/services/E2E, browser E2E, accessibility, build, and package smoke: passed.
- Full server suite under coverage: 186 suites / 841 tests passed, 2 tests skipped.
- Full client suite under coverage: 33 files / 105 tests passed.
- Server coverage policy: passed at 55.54% lines and 47.53% branches; all uncovered-count caps pass unchanged.
- Client coverage policy: passed at 62.26% lines and 54.96% branches; all uncovered-count caps pass unchanged.
- Repository inventory, production reachability, file-size, environment, and documentation validation: passed after governed inventory regeneration.
- GitHub PR: PR `#171` is ready for independent review but must not merge before that review is complete.
- GitHub CI: Required CI run `32877962271` passed on evidence-bearing head `cff8c72db7d3eb815cefcc40ef76f6dca31a397f`, including the final Required CI gate.

Automated verification does not replace human review. CF-04 through CF-10 must not be merged or maturity-promoted until the required independent review is complete.

## Immediate work

1. Obtain independent human review and resolve every review conversation before merge.
2. Keep capability routes local-only and maturity at `LOCAL_ONLY_EXPERIMENTAL`.
3. Complete the real hardware, cross-platform, consent/media-quality, manual accessibility, staging, backup/restore, performance, security, and release-owner gates described by the final completion plan before any hosted-production promotion.

## Source of truth

- Feature boundaries: [PRODUCTION_FEATURE_MANIFEST.md](implementation/PRODUCTION_FEATURE_MANIFEST.md)
- Task sequencing and status: [MASTER_PRODUCTION_COMPLETION_TRACKER.md](implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md)
- Final sequence and external gates: [FINAL_COMPLETION_IMPLEMENTATION_PLAN.md](implementation/FINAL_COMPLETION_IMPLEMENTATION_PLAN.md)
- Current task handoff: [CURRENT_HANDOFF.md](implementation/handoffs/CURRENT_HANDOFF.md)
- Exact-commit release evidence: [RELEASE_EVIDENCE_INDEX.md](implementation/RELEASE_EVIDENCE_INDEX.md)

Historical planning and completion documents are retained for audit context. They do not establish current production support.
