# Capability Fusion CF-04 through CF-10 — Integration Handoff

## Status

- Repository: `DocDamage/chatbot`
- Verified base: `main` at `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f`
- Integration branch: `codex/cf04-cf10-integration`
- Implementation checkpoint: `315e5db457195f24b0a0d228d4ee5a684d2dfd1f`
- Status: `IMPLEMENTED_NOT_VERIFIED`
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`
- Pull request: not yet opened

## Delivered at the checkpoint

- Ported the existing CF-04 through CF-10 commits onto current `main` without replacing the newer merged CF-03 implementation.
- Integrated local-model routing, typed agent teams/worktrees, authorized browser jobs, consent-aware media localization, Lattice simulation, the Capability Hub UI, and evaluation/observability/promotion components.
- Regenerated repository inventory, reachability, and CycloneDX SBOM artifacts from the integrated tree.
- Preserved local `.capabilities/` telemetry as ignored operator data.

## Verification result

- Type checks passed.
- Server and client lint passed.
- Focused server capability tests passed: 11 suites / 130 tests.
- Focused client tests passed: 2 files / 9 tests.
- Built-server browser E2E passed: 7 tests.
- The full server run passed 182 suites / 696 tests with 2 skipped.
- `npm run verify:release` failed at coverage enforcement: uncovered statements `14520 > 14243`, branches `8853 > 8217`, lines `13132 > 13039`, and functions `2997 > 2905`.

The coverage failure is release-blocking. Thresholds, exclusions, and failure behavior must not be weakened.

## Evidence

`docs/implementation/evidence/capability-fusion/CF-04-10/2026-08-25_315e5db/`

## Next authorized task

Add meaningful tests for uncovered CF-04 through CF-10 behavior, beginning with browser execution, capability routes/registry, evaluation branches, Lattice simulation, team coordination, provider discovery/routing, and media pipeline failure paths. Rerun `npm run verify:release` after each bounded coverage increment.

Do not open a merge-ready PR, promote maturity, close production tasks, or claim CF-04 through CF-10 verification until the exact final head passes the complete local and GitHub gates.

## NEW THREAD START PROMPT

```text
Continue CF-04 through CF-10 integration coverage closure on codex/cf04-cf10-integration. Preserve the unchanged coverage policy and local-only boundary. Add meaningful tests for the highest uncovered capability branches, rerun focused coverage, and update the checkpoint evidence honestly. Do not promote maturity or mark the draft PR merge-ready unless the exact head passes the complete release gate.
```

## Thread closure

End the task after one bounded coverage increment is committed with updated evidence, or after the exact final integration head passes all required local and GitHub gates. Do not begin hosted promotion or later production phases in the same task.

## External gates retained

- Repository-admin branch protection.
- Real local-model hardware canary.
- Native Windows/Linux/macOS process-tree and clean-machine testing.
- Human media-rights/quality and accessibility review.
- Hosted infrastructure, backup/restore, load/failure, security, and release approvals.
