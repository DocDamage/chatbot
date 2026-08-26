# Profile Expansion Local Audit Evidence

- **Status:** `IMPLEMENTED_NOT_VERIFIED`
- **Source state:** uncommitted worktree based on `55dbcd0a2af1bd4c26f1f28aae7b3e3d6823f7f2`
- **Branch:** `codex/cf04-cf10-integration`
- **Date:** `2026-08-25`

## Passed local gates

- `npm run release:check`
  - server type-check, test type-check, and lint;
  - release security, route, service, service-E2E, and browser-E2E checks;
  - final full server coverage run: 222 active suites and 1,173 tests passed, with 1 suite/2 tests intentionally skipped;
  - client type-check, lint, 36 test files and 115 tests;
  - Stage 2 server and client coverage enforcement;
  - 16 accessibility unit checks and 6 Chromium/Axe workflows, including Expansion Studios keyboard reachability;
  - server/client production builds and package smoke.
- Vertical-slice exposure contract passed for all 12 profile-expansion families: registry API path, guarded route mount, and active client surface.
- Native/provider fail-closed route tests passed: no production-default path fabricates STT/TTS, screen capture, stems, OCR/translation/dubbing/narration, writing transforms, game-editor runtime/build output, or AssetCooker results.
- Real local runtime smokes passed for Faster Whisper, Windows SAPI, screen capture, FFmpeg/Tesseract, Ollama, Demucs, Godot, Unreal 5.8, dubbing/narration, and the project-owned AssetCooker. Unity is installed but blocked by its missing Editor license; Unity/Unreal gameplay assertions and profiling remain unavailable without reviewed project-side instrumentation.
- `npm run check:phase2`
  - release-tool regression tests;
  - source integrity for 42 records;
  - current generated inventory;
  - 816 reachable and 290 isolated/classified modules;
  - file-size, environment-contract, and release-document validation.
- `npm run generate:sbom` and `npm run generate:notices` refreshed the CycloneDX SBOM and 42-source notice file.
- `npx jest src/core/repository-intelligence/__tests__/RepositoryIntelligence.eval.test.ts --runInBand` passed 8 tests, including extension-boundary enforcement.

## Coverage observed

| Scope | Lines | Branches | Functions | Statements |
|---|---:|---:|---:|---:|
| Server | 61.8884% | 49.9779% | 58.3569% | 61.0157% |
| Client | 67.5862% | 60.2345% | 59.0909% | 64.4428% |

These measurements pass the active Stage 2 no-regression policies. They do not satisfy every Stage 3/final or critical-file promotion target.

## Not certified by this record

This is local worktree evidence, not immutable release evidence. It does not certify exact-head CI, clean-machine behavior, the license-blocked Unity editor, Unity/Unreal project-side assertion or profiler instrumentation, all physical devices, signed manual accessibility, legal approval, load/soak behavior, backup/restore, operational drills, signed artifacts, controlled rollout, or post-deploy health. See `../../NATIVE_RUNTIME_VALIDATION_2026-08-25.md` for the executed runtime matrix.
