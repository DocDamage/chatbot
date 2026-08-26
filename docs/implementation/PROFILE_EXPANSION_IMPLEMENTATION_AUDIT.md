# Profile-Wide Capability Expansion Implementation Audit

**Audit date:** 2026-08-25
**Plan:** `docs/AI_CHATBOT_HUB_PROFILE_WIDE_CAPABILITY_EXPANSION_IMPLEMENTATION_PLAN.md`
**Branch:** `codex/cf04-cf10-integration`
**Audited state:** uncommitted worktree based on `55dbcd0a2af1bd4c26f1f28aae7b3e3d6823f7f2`
**Canonical status:** `IMPLEMENTED_NOT_VERIFIED`

## Outcome

The worktree contains broad implementations and tests across the planned capability families, but it does not satisfy the plan's production-verification definition. The implementation was not present in the commit cited by the prior PX evidence, and multiple certification/release helpers initially returned successful results from hard-coded fixtures rather than executed evidence.

The audit repaired high-impact security, authorization, path-boundary, exact-scope approval, health, input-bounding, audio-export, fail-closed certification, capability exposure, and release-policy issues. It also downgraded every PX tracker/evidence row from `VERIFIED` to `IMPLEMENTED_NOT_VERIFIED`; the work remains a local experimental candidate rather than a production-certified release.

## Material repairs

- Isolated capability jobs by authenticated requester; removed caller-controlled requester identity and implicit approval fallback.
- Made capability enable/disable operate on one known capability and require exact disable scope.
- Enforced pack profile, role, local-only, permission, disabled-state, and observed-health policies.
- Added path confinement for Godot/Unity mutations and inspections, Web Studio/source inspection, music, games, sprite handoff, and media routes.
- Required stored, exact approval digests before Godot transactions and sprite engine exports.
- Added upload/text/pixel dimension and payload limits to exposed routes.
- Replaced synthetic audio export data with real PCM WAV stem mixing and rejected missing inputs.
- Cleared health-probe timeout handles to avoid leaked Jest handles.
- Changed domain, cross-capability, clean-machine, accessibility, SBOM/license, load/soak, post-deploy, maintenance, operational-drill, backup/restore, release-manifest, release-artifact, and rollout gates to fail closed without supplied evidence.
- Required exact 40-character Git SHAs for release/promotion records and sequential, evidence-backed rollout advancement.
- Added server-authoritative Capability Hub entries and exposure diagnostics for context, memory, agent operations, game bridges, sprite/audio, desktop voice, media accessibility, writing, study, web, and developer utilities.
- Added authenticated Agent Operations, Writing Studio, and Study Studio REST surfaces so their existing service implementations are callable rather than compiled-but-dormant.
- Added an active Expansion Studios workspace for Context Economy, Agent Operations, Game Studio, Sprite Studio, Music Studio, Media Accessibility, Writing Studio, and Study Studio; Capability Hub cards now open the corresponding usable workspace.
- Added a 12-family vertical-slice contract that requires each profile-expansion capability to have a registry API path, guarded readiness-mounted route, and active client exposure.
- Made Memory Center and repository-architecture views reachable from the active Project Intelligence UI without fabricating unavailable source details.
- Replaced reserved/disabled feature-manifest placeholders with truthful `LOCAL_ONLY_EXPERIMENTAL` records for the reachable profile-expansion surfaces.
- Added Stage 2 no-regression baselines for the expanded server/client source scopes and retained the higher Stage 3/final targets for later promotion.
- Fixed repository ingestion so its extension allowlist is enforced and its digest traversal order is deterministic.
- Changed the PX evidence generator so it cannot manufacture `VERIFIED` records without executing verification.
- Removed fabricated native/provider outputs from the exposed runtime paths. STT, TTS, screen capture, Demucs separation, subtitle OCR/translation/dubbing/narration, AI writing/clipboard/dictation transforms, Godot runtime/export, Unity/Unreal editor actions, and AssetCooker now require explicit verified backends and fail closed when absent; hardware/status endpoints disclose backend availability.
- Replaced simulated desktop device/disk/VRAM and project-memory recap data with injected device discovery, real host memory/disk telemetry, omitted unavailable VRAM telemetry, and empty-by-default recap state.
- Implemented and exercised local Faster Whisper, Windows SAPI, Windows screen capture, FFmpeg/Tesseract, Ollama, Demucs, Godot CLI, Unreal CLI, dubbing/narration, and project-owned AssetCooker backends. Unreal discovery now selects the newest complete installation and passed against `D:\Unreal\UE_5.8`; Unity remains truthfully blocked by editor licensing.
- Added an explicit approver-bound Game Studio proposal approval route for Godot, Unity, and Unreal. Unity/Unreal proposals can no longer be applied by echoing their input digest; the route suite now proves propose, reject-unapproved-apply, approve, apply, rollback, and disconnect behavior.
- Removed synthetic Unity/Unreal profiler metrics. A successful editor validation without a trusted project-side profiler bridge now reports instrumentation unavailable.

## Verification observed

- Server TypeScript check: passed.
- Server ESLint: passed.
- Focused capability, route, gaming, audio, sprite, repository-intelligence, and UI tests passed, including the new exposure and route suites.
- Final full server coverage execution: 222 active suites and 1,173 tests passed; 1 suite/2 tests remained intentionally skipped.
- Browser E2E: 7 passed.
- Client unit and component tests: 36 files and 115 tests passed.
- Automated accessibility: 16 unit checks and 6 Chromium/Axe workflows passed, including the keyboard-reachable Expansion Studios workspace.
- Production build and packaging smoke: passed.
- Server Stage 2 coverage gate: passed at 61.8884% lines, 49.9779% branches, 58.3569% functions, and 61.0157% statements.
- Client Stage 2 coverage gate: passed at 67.5862% lines, 60.2345% branches, 59.0909% functions, and 64.4428% statements.
- Phase 2 scanners passed: 42 source records, current inventory, 816 reachable modules, 290 isolated/classified modules, 91 registered large files, 240 environment definitions/214 used variables, and 9 release-critical documents.
- CycloneDX SBOM and third-party notices were regenerated; the notice generator emitted 42 capability-source notices.
- Native runtime validation is recorded in `docs/implementation/evidence/profile-expansion/NATIVE_RUNTIME_VALIDATION_2026-08-25.md`.

These are development checks, not production certification.

## Remaining release blockers

1. Commit the audited implementation and run Required CI against that exact commit.
2. Repeat the complete release suite on the exact implementation commit; current unit, build, browser, automated accessibility, packaging, coverage, and Phase 2 runs are local worktree evidence only.
3. Reach the Stage 3/final global and Tier A/Tier B coverage targets before promoting affected capabilities beyond their current `LOCAL_ONLY_EXPERIMENTAL` maturity.
4. Pin every adopted upstream source to an immutable revision and attach license/file-exception review evidence. Generated notices and an SBOM do not substitute for legal review.
5. Complete the remaining runtime canaries: activate a legitimate Unity Editor license; add and review Unity/Unreal project-side assertion and profiler instrumentation; and repeat all applicable editor, model, media-worker, and physical-device runs on an exact committed head. The current host already has successful local Faster Whisper, SAPI, screen capture, OCR, Ollama, Demucs, Godot, Unreal 5.8, dubbing/narration, and AssetCooker smoke evidence.
6. Complete clean-machine and signed manual screen-reader/keyboard/accessibility certification.
7. Execute and retain real load/soak, backup/restore, quarterly operational-drill, signed artifact/provenance, controlled-rollout, and post-deploy evidence.

No PX task may move to `VERIFIED` until its specific exit gate and the applicable blockers above are closed with exact, immutable evidence.
