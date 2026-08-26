# Master Production Completion Tracker

> Authoritative release-status tracker for the AI Chatbot Hub production-completion plan.

## Tracker metadata

- Repository: `DocDamage/chatbot`
- Baseline branch: `main`
- Original plan baseline commit: `8b963232d72a69c6616667aaf34daadba6056aba`
- Last verified deployment commit: `342b657c6510fc086d11ad19a1c7b62fad9cd725`
- Current task branch: `codex/cf04-cf10-integration`
- Current P03-T04 implementation commit: `bb9d55ea662ed4a22b921ea1e2e08747e196a2a4`
- Current P03-T04 verification CI: `31074967710`
- Current integrated Phase 2 implementation commit: `6e1a019f8eccf5154c6a579d02abb188c6911a9e`
- Exact Phase 2 implementation head: `a0d159dd0eff1991a9a7400664e2eef0286e77a2`
- Phase 2 task-evidence validation commit: `84d981ea5cc951d51cb90996a157280b4b548dde`
- Phase 2 task-evidence validation CI: `31058155647`
- Plan date: `2026-08-04`
- Tracker created: `2026-08-04`
- Tracker last updated: `2026-08-25`
- Last verified `main` head: `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f` (Required CI run `32742006979` passed).
- Current integration checkpoint: `aec8871623870623204bc93e90ebeb52dd51aea0` (`IMPLEMENTED_NOT_VERIFIED`; local release and Required CI pass, independent review pending).
- Current user-facing status: CF-04 through CF-10 are an automated-release-verified integration candidate awaiting independent review; hosted production and public-market certification remain open.
- Status vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED_NOT_VERIFIED`, `BLOCKED`, `WAIVED`, `VERIFIED`, `RELEASED`

### Profile-expansion audit correction (2026-08-25)

All `PX00`–`PX22` records are currently `IMPLEMENTED_NOT_VERIFIED`. Their implementation is in an uncommitted worktree and therefore cannot be attributed to commit `55dbcd0a2af1bd4c26f1f28aae7b3e3d6823f7f2`. The earlier profile-expansion evidence bundles are development records, not release certification. The current worktree passes the complete local release check, enforced Stage 2 server/client coverage, Phase 2 scanners, production builds, browser/Axe workflows, and packaging smoke; its SBOM and notices are regenerated. Native/provider-dependent runtime paths fail closed rather than returning fixture output. On the current local host, real Faster Whisper, SAPI, screen capture, FFmpeg/Tesseract, Ollama, Demucs, Godot, Unreal 5.8, dubbing/narration, and AssetCooker runs passed; Unity is installed but blocked by its missing editor license, and Unity/Unreal gameplay assertions and profiling still require trusted project-side instrumentation. Promotion still requires a new exact implementation commit, exact-head CI, higher promotion coverage stages, immutable upstream/license review, remaining editor/device runs, clean-machine checks, signed manual accessibility results, and completed load/soak, restore, operational-drill, rollout, and post-deploy evidence. See `docs/implementation/PROFILE_EXPANSION_IMPLEMENTATION_AUDIT.md` and `docs/implementation/evidence/profile-expansion/NATIVE_RUNTIME_VALIDATION_2026-08-25.md`.

## Governance rules

1. Only `VERIFIED` tasks count toward production completion.
2. Verification requires implementation, applicable automated checks, runtime QA when required, evidence, documentation, and the task exit gate.
3. Every verified record identifies owner, status, branch, implementation commit, evidence path, blocker, date, and release applicability.
4. Each task runs in a new thread and closes with an archived handoff plus a replacement `CURRENT_HANDOFF.md`.
5. Accepted ADRs define targets and constraints; they do not certify implementation or deployment.
6. A repository-owner waiver may remove an optional governance task as a sequencing blocker, but a waived task does not count as verified.

## Summary

| Phase | Total | Verified | Implemented, not verified | In progress | Blocked | Waived | Not started |
|---|---:|---:|---:|---:|---:|---:|---:|
| PHASE 0 | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| PHASE 1 | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| PHASE 2 | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| PHASE 3 | 8 | 4 | 0 | 0 | 0 | 0 | 4 |
| PHASE 4 | 12 | 0 | 0 | 0 | 0 | 0 | 12 |
| PHASE 5 | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| PHASE 6 | 9 | 0 | 0 | 0 | 0 | 0 | 9 |
| PHASE 7 | 20 | 0 | 0 | 0 | 0 | 0 | 20 |
| PHASE 8 | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| PHASE 9 | 7 | 0 | 0 | 0 | 0 | 0 | 7 |
| PHASE 10 | 7 | 0 | 0 | 0 | 0 | 0 | 7 |
| PHASE 11 | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| PHASE 12 | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| PHASE 13 | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| PHASE 14 | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| **Total** | **124** | **23** | **0** | **0** | **0** | **0** | **101** |

## Capability Fusion integration status

CF-04 through CF-10 are tracked by the Capability Fusion roadmap and final completion plan outside the 124 production-task rows above. The integration candidate at `aec8871623870623204bc93e90ebeb52dd51aea0` passes the complete local release, unchanged server/client coverage, browser, accessibility, packaging, inventory, reachability, environment, and documentation gates. GitHub Required CI run `32877962271` passed on the evidence-bearing head; independent review remains open. No production-task count or feature maturity is changed by this automated verification; maturity remains `LOCAL_ONLY_EXPERIMENTAL`.

## Task records

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P00-T01` | Create the master production completion tracker | Codex/GitHub | `VERIFIED` | `agent/p00-t01-master-production-tracker` | `84ef639bda41d585240041a0657cd21f2e9f8cde` | `docs/implementation/evidence/PHASE-00/P00-T01/2026-08-04_84ef639b` | None | `2026-08-04` | `REQUIRED` |
| `P00-T02` | Create the production feature manifest | Codex/GitHub | `VERIFIED` | `agent/p00-t02-production-feature-manifest` | `027eacd948cadb0f8b749385c51acd13a287051c` | `docs/implementation/evidence/PHASE-00/P00-T02/2026-08-04_027eacd9` | None | `2026-08-04` | `REQUIRED` |
| `P00-T03` | Reconcile existing release documents | Codex/GitHub | `VERIFIED` | `agent/p00-t03-reconcile-release-documents` | `27c225dfae2a9d475331af56e9030ba93f8d42e5` | `docs/implementation/evidence/PHASE-00/P00-T03/2026-08-04_27c225df` | None | `2026-08-04` | `REQUIRED` |
| `P00-T04` | Establish release decisions | Codex/GitHub | `VERIFIED` | `agent/p00-t04-establish-release-decisions` | `923d3a14de0c1b6b9b5aab31cd14663869b3dda7` | `docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14` | None | `2026-08-05` | `REQUIRED` |
| `P00-T05` | Create GitHub milestones and issues | Codex/GitHub | `VERIFIED` | `agent/p00-t05-create-github-milestones-issues` | `0f687c56d536565c39b2817417862559b1b8efd3` | `docs/implementation/evidence/PHASE-00/P00-T05/2026-08-05_fbff3ab0` | None | `2026-08-05` | `REQUIRED` |
| `P01-T01` | Reproduce the latest CI failure locally | Codex/GitHub | `VERIFIED` | `agent/p01-t01-reproduce-latest-ci-failure` | `b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4` | `docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2` | None | `2026-08-05` | `REQUIRED` |
| `P01-T02` | Correct clipboard behavior and tests | Codex/GitHub | `VERIFIED` | `agent/p01-t02-correct-clipboard-tests` | `2882406d0d944ab62aa93c27cbf9a685084d8d5a` | `docs/implementation/evidence/PHASE-01/P01-T02/2026-08-05_2882406d` | None | `2026-08-05` | `REQUIRED` |
| `P01-T03` | Remove the client lint warning | Codex/GitHub | `VERIFIED` | `agent/p01-t03-remove-client-lint-warning` | `12b4088671cf5c828dd8e6b430b5320b5544016c` | `docs/implementation/evidence/PHASE-01/P01-T03/2026-08-05_12b40886` | None | `2026-08-05` | `REQUIRED` |
| `P01-T04` | Repair stale gitlink/submodule state | Codex/GitHub | `VERIFIED` | `agent/p01-t04-repair-gitlink-integrity` | `7995961b0b6c2f2fc847da8ade16d2df594aee27` | `docs/implementation/evidence/PHASE-01/P01-T04/2026-08-05_7995961b` | None | `2026-08-05` | `REQUIRED` |
| `P01-T05` | Decide and repair GitHub Pages | Codex/GitHub | `VERIFIED` | `agent/p01-t05-decide-repair-github-pages` | `fe2782e7e7eb778de8bd25cabaeadb2243a6dfd6` | `docs/implementation/evidence/PHASE-01/P01-T05/2026-08-05_fe2782e7` | None | `2026-08-05` | `REQUIRED` |
| `P01-T06` | Make all current CI stages execute | Codex/GitHub | `VERIFIED` | `agent/p01-t06-make-all-ci-stages-execute` | `7e95e339aa7e5d661bbe67ccad98418cbfbd2960` | `docs/implementation/evidence/PHASE-01/P01-T06/2026-08-05_7e95e339` | None | `2026-08-05` | `REQUIRED` |
| `P01-T07` | Add branch protection | Repository owner/Codex | `VERIFIED` | `agent/p01-t07-add-branch-protection` | `9ec527f3d635fa1bf02d1a8ffbaeeb46048eaeb1` | `docs/implementation/evidence/PHASE-01/P01-T07/2026-08-25_9ec527f3` | None | `2026-08-25` | `REQUIRED` |
| `P02-T01` | Create a complete code and route inventory | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T01/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P02-T02` | Build a reachability map | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T02/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P02-T03` | Remove or isolate legacy and duplicate implementations | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T03/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P02-T04` | Enforce the 300-line source guideline | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T04/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P02-T05` | Consolidate environment templates | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T05/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P02-T06` | Create configuration schemas | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T06/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P02-T07` | Normalize documentation and generated artifacts | Codex/GitHub | `VERIFIED` | `agent/complete-through-phase-02` | `a0d159dd0eff1991a9a7400664e2eef0286e77a2` | `docs/implementation/evidence/PHASE-02/P02-T07/2026-08-05_a0d159dd` | None | `2026-08-05` | `REQUIRED` |
| `P03-T01` | Split and harden CI jobs | Codex/GitHub | `VERIFIED` | `agent/p03-t01-split-harden-ci-jobs` | `34f01ce7f8aa52b4579b6aa883c8c9c6c7a1a594` | `docs/implementation/evidence/PHASE-03/P03-T01/2026-08-05_34f01ce7` | None | `2026-08-05` | `REQUIRED` |
| `P03-T02` | Implement meaningful server coverage policy | Codex/GitHub | `VERIFIED` | `agent/p03-t02-server-coverage-policy` | `b7e81e3935185c06cbaab2fb7e2ee199a69dcaca` | `docs/implementation/evidence/PHASE-03/P03-T02/2026-08-05_b7e81e39` | None | `2026-08-05` | `REQUIRED` |
| `P03-T03` | Implement client coverage thresholds | Codex/GitHub | `VERIFIED` | `agent/p03-t03-client-coverage-thresholds` | `23fcb9b18348bd05cc95c66d29e799ebb03252e8` | `docs/implementation/evidence/PHASE-03/P03-T03/2026-08-05_23fcb9b1` | None | `2026-08-05` | `REQUIRED` |
| `P03-T04` | Replace fake accessibility testing | Codex/GitHub | `VERIFIED` | `agent/p03-t04-real-accessibility-testing` | `bb9d55ea662ed4a22b921ea1e2e08747e196a2a4` | `docs/implementation/evidence/PHASE-03/P03-T04/2026-08-06_bb9d55ea` | None | `2026-08-06` | `REQUIRED` |
| `PX00-T01` | Verify current repository state | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T01/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX00-T02` | Reconcile the four planning layers | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T02/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX00-T03` | Extend the master tracker | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T03/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX00-T04` | Extend feature and route manifests | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T04/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX00-T05` | Create ADR for profile-wide expansion | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T05/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX00-T06` | Create GitHub milestones and issues | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T06/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX00-T07` | Create release-train boundaries | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-00/PX00-T07/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T01` | Build the exact source register | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T01/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T02` | Perform file-level provenance review for native candidates | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T02/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T03` | Decide integration mode for every source | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T03/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T04` | Separate code, models, assets, and service terms | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T04/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T05` | Implement notice and attribution generation | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T05/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T06` | Add source-integrity checks | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T06/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T07` | Create clean-room protocol | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T07/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX01-T08` | Resolve or block ambiguous sources | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-01/PX01-T08/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T01` | Version the Capability Pack schema | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T01/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T02` | Implement server-authoritative registry | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T02/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T03` | Implement installation lifecycle | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T03/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T04` | Implement permission engine | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T04/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T05` | Implement common job orchestration | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T05/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T06` | Implement approval digests | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T06/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T07` | Implement artifact store and lineage | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T07/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T08` | Implement resource budgets | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T08/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T09` | Implement health and dependency diagnostics | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T09/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T10` | Implement configuration and secret boundaries | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T10/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T11` | Add database migrations and repository layer | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T11/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T12` | Create capability SDK and contract tests | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T12/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX02-T13` | Add minimal operator API | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-02/PX02-T13/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T01` | Baseline the current context pipeline | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T01/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T02` | Implement content classification and routing | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T02/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T03` | Implement deterministic compressors | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T03/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T04` | Implement reversible context store | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T04/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T05` | Harden model-based compression | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T05/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T06` | Implement deltas, checkpoints, and cache alignment | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T06/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T07` | Implement context budget planner | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T07/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T08` | Build Context Inspector UI | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T08/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T09` | Add security and isolation tests | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T09/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T10` | Build quality and efficiency evaluation | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T10/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX03-T11` | Add controlled failure learning | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-03/PX03-T11/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T01` | Add byte-offset symbol index | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T01/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T02` | Add incremental tree-sitter symbol updater | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T02/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T03` | Implement deterministic call graph | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T03/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T04` | Implement semantic architecture card provider | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T04/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T05` | Add code-health and risk provider | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T05/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T06` | Implement test-impact analyzer | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T06/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T07` | Implement patch-risk evaluator | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T07/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T08` | Implement unified repository intelligence service | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T08/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T09` | Add repository intelligence evals | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T09/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX04-T10` | Add repository intelligence tools/APIs | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-04/PX04-T10/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T01` | Add branch/worktree/commit memory schema | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T01/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T02` | Implement memory capture pipeline | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T02/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T03` | Implement freshness and staleness engine | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T03/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T04` | Add cross-branch memory reconciliation | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T04/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T05` | Implement memory retrieval and injection layer | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T05/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T06` | Implement human-readable memory export | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T06/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T07` | Add memory isolation and tenant checks | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T07/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T08` | Implement memory evals | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T08/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T09` | Add memory management UI/APIs | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T09/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |
| `PX05-T10` | Add memory benchmark harness | Codex/GitHub | `IMPLEMENTED_NOT_VERIFIED` | `codex/cf04-cf10-integration` | `WORKTREE (uncommitted)` | `docs/implementation/evidence/profile-expansion/PX-05/PX05-T10/2026-08-25_55dbcd0a` | Exact-commit CI/runtime/manual certification pending | `—` | `EXPANSION_TRAIN_A` |


## Waived task records

None. The former P01-T07 waiver was superseded by the repository owner on 2026-08-25; live protection is verified above.
## Implemented-not-verified task records

None.

## Pending task field defaults

- Owner: `Unassigned`
- Status: `NOT_STARTED`
- Branch: `—`
- Implementation commit: `—`
- Evidence path: `—`
- Blocker: `—`
- Date verified: `—`
- Release applicability: `REQUIRED`

## Pending task register

### PHASE 0 — Release Governance, Scope Freeze, and Truthful Status

No pending tasks.

### PHASE 1 — Restore Repository Integrity and a Fully Green `main`

No pending tasks. `P01-T01` through `P01-T07` are verified.

### PHASE 2 — Repository Hygiene, Architecture Boundaries, and Maintainability

No pending tasks. `P02-T01` through `P02-T07` are verified with task-specific evidence.

### PHASE 3 — CI/CD and Verification Gates That Cannot Produce False Confidence

| Task ID | Task |
|---|---|
| `P03-T05` | Add real browser E2E testing |
| `P03-T06` | Add dependency and supply-chain gates |
| `P03-T07` | Add migration CI |
| `P03-T08` | Add container and package smoke tests |

### PHASE 4 — Security Hardening and Abuse Resistance

| Task ID | Task |
|---|---|
| `P04-T01` | Produce a complete threat model |
| `P04-T02` | Harden authentication and session policy |
| `P04-T03` | Formalize route authorization |
| `P04-T04` | Upgrade and harden uploads |
| `P04-T05` | Harden file browsing and workspace access |
| `P04-T06` | Harden local command execution |
| `P04-T07` | Harden SSRF and outbound requests |
| `P04-T08` | Harden Redis and rate limiting |
| `P04-T09` | Security headers and browser policy |
| `P04-T10` | Secrets and API-key lifecycle |
| `P04-T11` | Audit logging |
| `P04-T12` | Independent security review |

### PHASE 5 — Database, Persistence, Migration, Backup, and Recovery

| Task ID | Task |
|---|---|
| `P05-T01` | Select and document the production database |
| `P05-T02` | Centralize migration management |
| `P05-T03` | Test PostgreSQL as a first-class target |
| `P05-T04` | Enforce user ownership and data isolation |
| `P05-T05` | Transaction and consistency review |
| `P05-T06` | Backup implementation |
| `P05-T07` | Restore drill |
| `P05-T08` | Data retention, deletion, and export |

### PHASE 6 — AI Provider, Routing, RAG, Safety, and Evaluation Reliability

| Task ID | Task |
|---|---|
| `P06-T01` | Declare supported providers and models |
| `P06-T02` | Provider contract tests |
| `P06-T03` | Real provider canary tests |
| `P06-T04` | Timeout, retry, circuit breaker, and cancellation |
| `P06-T05` | Token, context, and cost controls |
| `P06-T06` | RAG production hardening |
| `P06-T07` | Grounding and citation release gates |
| `P06-T08` | Domain and safety evals |
| `P06-T09` | Eval regression enforcement |

### PHASE 7 — Feature-by-Feature Production Completion

| Task ID | Task |
|---|---|
| `P07-T01` | Core chat and streaming |
| `P07-T02` | Authentication, setup, and settings |
| `P07-T03` | Conversations and sharing |
| `P07-T04` | Modes and specialist routing |
| `P07-T05` | Coding workflow |
| `P07-T06` | File Explorer |
| `P07-T07` | Audio browser and analysis |
| `P07-T08` | Document, image, and video ingestion |
| `P07-T09` | Knowledge Base and RAG UI |
| `P07-T10` | Knowledge Online approval workflow |
| `P07-T11` | Knowledge OS |
| `P07-T12` | Local tools |
| `P07-T13` | Sprite Lab |
| `P07-T14` | SEC ingestion |
| `P07-T15` | Gaming and game-development features |
| `P07-T16` | Creative writing and roleplay |
| `P07-T17` | Music, FL Studio, and desktop bridges |
| `P07-T18` | GIS |
| `P07-T19` | Administration and exports |
| `P07-T20` | Webhooks, automation, notifications, and real-time features |

### PHASE 8 — UX, Accessibility, Onboarding, and Product Polish

| Task ID | Task |
|---|---|
| `P08-T01` | Information architecture review |
| `P08-T02` | Unified state design |
| `P08-T03` | Dangerous-action UX |
| `P08-T04` | First-run onboarding |
| `P08-T05` | WCAG 2.2 AA implementation |
| `P08-T06` | Manual assistive-technology test |
| `P08-T07` | Responsive and browser matrix |
| `P08-T08` | Product copy and diagnostics |

### PHASE 9 — Performance, Capacity, Resilience, and Failure Testing

| Task ID | Task |
|---|---|
| `P09-T01` | Define service objectives |
| `P09-T02` | Build representative load profiles |
| `P09-T03` | Load and soak tests |
| `P09-T04` | Resource and abuse caps |
| `P09-T05` | Dependency failure matrix |
| `P09-T06` | Startup and shutdown reliability |
| `P09-T07` | Performance regression gate |

### PHASE 10 — Observability, Auditability, and Operational Readiness

| Task ID | Task |
|---|---|
| `P10-T01` | Structured logging standard |
| `P10-T02` | Metrics |
| `P10-T03` | Distributed tracing |
| `P10-T04` | Health endpoints |
| `P10-T05` | Dashboards and alerts |
| `P10-T06` | Runbooks |
| `P10-T07` | Operational support bundle |

### PHASE 11 — Production Deployment Engineering

| Task ID | Task |
|---|---|
| `P11-T01` | Select the production hosting architecture |
| `P11-T02` | Harden the Docker image |
| `P11-T03` | Correct Docker Compose defaults |
| `P11-T04` | Reverse proxy and TLS |
| `P11-T05` | Staging environment |
| `P11-T06` | Automated deployment pipeline |
| `P11-T07` | Migration and rollback strategy |
| `P11-T08` | Production smoke suite |

### PHASE 12 — Full Manual QA and Release Candidate Certification

| Task ID | Task |
|---|---|
| `P12-T01` | Clean-machine installation |
| `P12-T02` | Manual workflow matrix |
| `P12-T03` | Cross-configuration matrix |
| `P12-T04` | Long-running and large-data scenarios |
| `P12-T05` | Security acceptance |
| `P12-T06` | Documentation acceptance |
| `P12-T07` | Release evidence reconciliation |
| `P12-T08` | Final release candidate sign-off |

### PHASE 13 — Versioning, Release Packaging, and Launch

| Task ID | Task |
|---|---|
| `P13-T01` | Version and tag |
| `P13-T02` | Release artifacts |
| `P13-T03` | Controlled rollout |
| `P13-T04` | Post-deploy verification |
| `P13-T05` | Initial operating review |

### PHASE 14 — Post-Release Maintenance Baseline

| Task ID | Task |
|---|---|
| `P14-T01` | Dependency update policy |
| `P14-T02` | Vulnerability response SLA |
| `P14-T03` | Regression and eval maintenance |
| `P14-T04` | Quarterly restore and incident drills |
| `P14-T05` | Feature lifecycle policy |

### Profile-Wide Capability Expansion Pending Register (Train A, B, C, D)

#### PHASE PX-04 — Repository Intelligence, Code Health, and Impact Analysis (Train A)
| Task ID | Task |
|---|---|
| `PX04-T01` | Add byte-offset symbol index |
| `PX04-T02` | Add incremental tree-sitter symbol updater |
| `PX04-T03` | Implement deterministic call graph |
| `PX04-T04` | Implement semantic architecture card provider |
| `PX04-T05` | Add code-health and risk provider |
| `PX04-T06` | Implement test-impact analyzer |
| `PX04-T07` | Implement patch-risk evaluator |
| `PX04-T08` | Implement unified repository intelligence service |
| `PX04-T09` | Add repository intelligence evals |
| `PX04-T10` | Add repository intelligence tools/APIs |

#### PHASE PX-05 — Provenance-Preserving Project Memory and Git Integration (Train A)
| Task ID | Task |
|---|---|
| `PX05-T01` | Add branch/worktree/commit memory schema |
| `PX05-T02` | Implement memory capture pipeline |
| `PX05-T03` | Implement freshness and staleness engine |
| `PX05-T04` | Add cross-branch memory reconciliation |
| `PX05-T05` | Implement memory retrieval and injection layer |
| `PX05-T06` | Implement human-readable memory export |
| `PX05-T07` | Add memory isolation and tenant checks |
| `PX05-T08` | Implement memory evals |
| `PX05-T09` | Add memory management UI/APIs |
| `PX05-T10` | Add memory benchmark harness |

#### PHASE PX-06 — Multi-Agent Operations, Scoped Communication, and Workspaces (Train A)
| Task ID | Task |
|---|---|
| `PX06-T01` | Formalize agent session schema |
| `PX06-T02` | Implement structured event stream |
| `PX06-T03` | Implement scoped agent threads |
| `PX06-T04` | Implement workspace claim service |
| `PX06-T05` | Implement agent handoff protocol |
| `PX06-T06` | Implement agent activity console |
| `PX06-T07` | Add concurrency and collision tests |
| `PX06-T08` | Add multi-agent evals |
| `PX06-T09` | Add agent safety and kill-switch API |
| `PX06-T10` | Add agent team presets |

#### PHASE PX-07 — Local Model Routing, Resource Management, and Inference Adapters (Train A)
| Task ID | Task |
|---|---|
| `PX07-T01` | Implement hardware discovery and capability profiler |
| `PX07-T02` | Implement dynamic local model router |
| `PX07-T03` | Add Ollama adapter hardening |
| `PX07-T04` | Add LM Studio / vLLM / llama.cpp adapters |
| `PX07-T05` | Add Picchio disk-streamed MoE adapter |
| `PX07-T06` | Add resource exhaustion protection |
| `PX07-T07` | Add local model benchmark suite |
| `PX07-T08` | Add local model diagnostic panel |

#### PHASE PX-10 — Sprite, Image, and Game Asset Studio (Train B)
| Task ID | Task | Status | Evidence |
|---|---|---|---|
| `PX10-T01` | Versioned 12-stage image-processing pipeline | `IMPLEMENTED_NOT_VERIFIED` | `docs/implementation/evidence/profile-expansion/PX-10/PX10-T01/` |
| `PX10-T02` | Ingest hardening and decompression-bomb protection | `IMPLEMENTED_NOT_VERIFIED` | `ImageIngestValidator.ts`, `SpriteStudio.eval.test.ts` |
| `PX10-T03` | Pixel grid estimation and nearest-neighbor resampling | `IMPLEMENTED_NOT_VERIFIED` | `PixelGridRefiner.ts` |
| `PX10-T04` | Border color estimation and background removal | `IMPLEMENTED_NOT_VERIFIED` | `SpriteBackgroundTool.ts` |
| `PX10-T05` | Retro palettes, Oklab distance, and dithering | `IMPLEMENTED_NOT_VERIFIED` | `SpritePaletteEngine.ts` |
| `PX10-T06` | Outlines, finishing, and collision masks | `IMPLEMENTED_NOT_VERIFIED` | `SpriteOutlineFinisher.ts` |
| `PX10-T07` | Batch processing queues and preset management | `IMPLEMENTED_NOT_VERIFIED` | `SpriteBatchPresetService.ts` |
| `PX10-T08` | Quality regression fixtures and evaluation | `IMPLEMENTED_NOT_VERIFIED` | `SpriteQualityEvaluator.ts` |
| `PX10-T09` | Engine handoffs for Godot and Unity | `IMPLEMENTED_NOT_VERIFIED` | `SpriteEngineHandoff.ts` |
| `PX10-T10` | Sprite Studio REST API Routes | `IMPLEMENTED_NOT_VERIFIED` | `spriteStudioRoutes.ts` |
| `PX10-T11` | Security and performance test suite | `IMPLEMENTED_NOT_VERIFIED` | `SpriteStudio.eval.test.ts` |

#### PHASE PX-11 — Local Stem Separation, Mixer, and Audio Analysis Lab (Train B)
| Task ID | Task | Status | Evidence |
|---|---|---|---|
| `PX11-T01` | Audio rights governance model and preflight checks | `IMPLEMENTED_NOT_VERIFIED` | `AudioJobRightsModel.ts`, `docs/implementation/evidence/profile-expansion/PX-11/PX11-T01/` |
| `PX11-T02` | Isolated Demucs worker adapter & hardware probing | `IMPLEMENTED_NOT_VERIFIED` | `DemucsWorkerAdapter.ts` |
| `PX11-T03` | Audio format ingest normalizer & DRM rejection | `IMPLEMENTED_NOT_VERIFIED` | `AudioIngestNormalizer.ts` |
| `PX11-T04` | 4/6 stem extraction & complement backing tracks | `IMPLEMENTED_NOT_VERIFIED` | `StemSeparationEngine.ts` |
| `PX11-T05` | Waveform envelopes & multitrack mixer math | `IMPLEMENTED_NOT_VERIFIED` | `WaveformMixerEngine.ts` |
| `PX11-T06` | Audio track analysis (BPM, key, LUFS, dynamics) | `IMPLEMENTED_NOT_VERIFIED` | `AudioTrackAnalyzer.ts` |
| `PX11-T07` | Stem export packages & mixdown rendering | `IMPLEMENTED_NOT_VERIFIED` | `AudioExportMixdownService.ts` |
| `PX11-T08` | FL Studio & DAW routing layout handoffs | `IMPLEMENTED_NOT_VERIFIED` | `DAWIntegrationHandoff.ts` |
| `PX11-T09` | Worker cancellation and cleanup | `IMPLEMENTED_NOT_VERIFIED` | `DemucsWorkerAdapter.ts` |
| `PX11-T10` | Music Studio REST API Routes | `IMPLEMENTED_NOT_VERIFIED` | `musicStudioRoutes.ts` |
| `PX11-T11` | Audio quality evaluation fixtures & test suite | `IMPLEMENTED_NOT_VERIFIED` | `MusicStudio.eval.test.ts` |

### PHASE PX-12 — Local Desktop Voice Companion
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX12-T01` | Desktop companion architecture & loopback session | `IMPLEMENTED_NOT_VERIFIED` | `ADR_PX12_LOCAL_DESKTOP_VOICE_COMPANION.md`, `FloatingAssistantService.ts` |
| `PX12-T02` | Local STT provider abstraction, model checksums & VAD | `IMPLEMENTED_NOT_VERIFIED` | `LocalSTTProvider.ts` |
| `PX12-T03` | Local TTS provider, Kokoro/OS voice engine & synthetic disclosure | `IMPLEMENTED_NOT_VERIFIED` | `LocalTTSProvider.ts` |
| `PX12-T04` | Recording state machine, push-to-talk, hotkeys & audio device selection | `IMPLEMENTED_NOT_VERIFIED` | `VoiceRecordingService.ts` |
| `PX12-T05` | Dictation modes (raw, cleanup, translate, instruction draft, paste safeguards) | `IMPLEMENTED_NOT_VERIFIED` | `VoiceDictationEngine.ts` |
| `PX12-T06` | Floating assistant panel session, dialog turns & speech interruption | `IMPLEMENTED_NOT_VERIFIED` | `FloatingAssistantService.ts` |
| `PX12-T07` | On-demand screen context capture, region crop & credential redaction | `IMPLEMENTED_NOT_VERIFIED` | `ScreenContextCaptureService.ts` |
| `PX12-T08` | Clipboard transformations, secret detection & safe write gating | `IMPLEMENTED_NOT_VERIFIED` | `ClipboardActionService.ts` |
| `PX12-T09` | Daily briefings, memory recap, reminders & hardware telemetry | `IMPLEMENTED_NOT_VERIFIED` | `DesktopCompanionBriefingService.ts` |
| `PX12-T10` | Strict OS action policy sandbox (allowlist vs arbitrary commands) | `IMPLEMENTED_NOT_VERIFIED` | `DesktopOSActionPolicy.ts` |
| `PX12-T11` | Privacy manager, temporary artifact purge & support bundle sanitizer | `IMPLEMENTED_NOT_VERIFIED` | `DesktopPrivacyManager.ts` |
| `PX12-T12` | Windows companion packaging & installer manifest | `IMPLEMENTED_NOT_VERIFIED` | `DesktopPackagingManifest.ts` |
| `PX12-T13` | Voice companion evaluation test suite | `IMPLEMENTED_NOT_VERIFIED` | `VoiceCompanion.eval.test.ts` |

### PHASE PX-13 — Media Accessibility, Subtitle OCR, Dubbing, Narration, and Read-Along
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX13-T01` | Media project model, streams & cryptographic provenance | `IMPLEMENTED_NOT_VERIFIED` | `MediaProjectModel.ts` |
| `PX13-T02` | Burned-in subtitle OCR, bounding-box crop & frame deduplication | `IMPLEMENTED_NOT_VERIFIED` | `SubtitleOcrEngine.ts` |
| `PX13-T03` | Subtitle editor, frame nudge, snap to grid & SRT/VTT/ASS/TXT formats | `IMPLEMENTED_NOT_VERIFIED` | `SubtitleEditorService.ts` |
| `PX13-T04` | Speech-to-text alignment, timestamping & transcript diffs | `IMPLEMENTED_NOT_VERIFIED` | `MediaTranscriptionAligner.ts` |
| `PX13-T05` | Translation variant tracks, glossary locks & CPS limits | `IMPLEMENTED_NOT_VERIFIED` | `TranslationVariantService.ts` |
| `PX13-T06` | Voice dubbing consent gate, rights validation & synthetic disclosures | `IMPLEMENTED_NOT_VERIFIED` | `VoiceDubbingConsentGate.ts` |
| `PX13-T07` | Audio timing fit, ducking & multitrack reconstruction | `IMPLEMENTED_NOT_VERIFIED` | `AudioTimingFitReconstructor.ts` |
| `PX13-T08` | Document narration, chapter detection & chaptered audio packages | `IMPLEMENTED_NOT_VERIFIED` | `DocumentNarrationEngine.ts` |
| `PX13-T09` | Synchronized read-along artifacts & EPUB 3 Media Overlays (SMIL 3.0) | `IMPLEMENTED_NOT_VERIFIED` | `SynchronizedReadAlongService.ts` |
| `PX13-T10` | Authorized media URL ingest adapter & DRM/credential blockers | `IMPLEMENTED_NOT_VERIFIED` | `AuthorizedMediaIngestAdapter.ts` |
| `PX13-T11` | Accessibility exports & WCAG compliance | `IMPLEMENTED_NOT_VERIFIED` | `mediaAccessibilityRoutes.ts` |
| `PX13-T12` | Media storage lifecycle & temp cleanup on job completion/cancellation | `IMPLEMENTED_NOT_VERIFIED` | `MediaStorageLifecycleManager.ts` |
| `PX13-T13` | Media accessibility evaluation test suite | `IMPLEMENTED_NOT_VERIFIED` | `MediaAccessibility.eval.test.ts` |

### PHASE PX-14 — Lossless Writing, Proofreading, and Review Studio
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX14-T01` | Canonical document model, BOM, line ending, and metadata parsing | `IMPLEMENTED_NOT_VERIFIED` | `CanonicalDocumentModel.ts` |
| `PX14-T02` | Byte-exact round-trip, CRLF/LF/CR preservation, 3-way reconciliation | `IMPLEMENTED_NOT_VERIFIED` | `CanonicalDocumentModel.ts` |
| `PX14-T03` | Editor AST parsing, headings hierarchy, outline, Flesch-Kincaid metrics | `IMPLEMENTED_NOT_VERIFIED` | `DocumentEditorEngine.ts` |
| `PX14-T04` | Import/export engine (Markdown, HTML, DOCX, PDF) & provenance | `IMPLEMENTED_NOT_VERIFIED` | `DocumentImportExportService.ts` |
| `PX14-T05` | Local proofreading engine, spelling, grammar, punctuation, dictionary | `IMPLEMENTED_NOT_VERIFIED` | `ProofreadingEngine.ts` |
| `PX14-T06` | AI change proposals, diffs, freshness/stale rebase validation | `IMPLEMENTED_NOT_VERIFIED` | `AIProposalService.ts` |
| `PX14-T07` | Comments and tracked changes, CriticMarkup export, accept all | `IMPLEMENTED_NOT_VERIFIED` | `TrackedChangesManager.ts` |
| `PX14-T08` | Writing AI provider router, sensitivity enforcement, data egress notices | `IMPLEMENTED_NOT_VERIFIED` | `WritingAIProviderRouter.ts` |
| `PX14-T09` | Autosave caching, crash recovery, version history timeline | `IMPLEMENTED_NOT_VERIFIED` | `DocumentRecoveryManager.ts` |
| `PX14-T10` | WritingStudioService integrated workflow and accessibility preferences | `IMPLEMENTED_NOT_VERIFIED` | `WritingStudioService.ts` |
| `PX14-T11` | Writing quality evaluator and long-document throughput benchmark | `IMPLEMENTED_NOT_VERIFIED` | `WritingQualityEvaluator.ts` |
| `PX14-T12` | Writing studio evaluation test suite | `IMPLEMENTED_NOT_VERIFIED` | `WritingStudio.eval.test.ts` |

### PHASE PX-15 — Source-Grounded Study, Notes, and Examination Studio
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX15-T01` | Study collection & source model, checksums, portable bundle import/export | `IMPLEMENTED_NOT_VERIFIED` | `StudyCollectionModel.ts` |
| `PX15-T02` | Source ingestion, chapter extraction, retrieval chunking, glossary extraction | `IMPLEMENTED_NOT_VERIFIED` | `StudySourceIngestEngine.ts` |
| `PX15-T03` | Structured notes (8 formats), source citations, coverage and completeness | `IMPLEMENTED_NOT_VERIFIED` | `StructuredNotesEngine.ts` |
| `PX15-T04` | Flashcard generation, duplicate scoring, SM-2 spaced repetition review | `IMPLEMENTED_NOT_VERIFIED` | `FlashcardEngine.ts` |
| `PX15-T05` | Quizzes across 6 question types, distractor checks, deterministic grading | `IMPLEMENTED_NOT_VERIFIED` | `QuizEngine.ts` |
| `PX15-T06` | Exam simulation, answer key concealment during active test, topic scores | `IMPLEMENTED_NOT_VERIFIED` | `ExamSimulationEngine.ts` |
| `PX15-T07` | Study plan generation and transparent rule-based topic mastery model | `IMPLEMENTED_NOT_VERIFIED` | `MasteryModelEngine.ts` |
| `PX15-T08` | Socratic inquiry & debate sessions, misconception detection, grounding | `IMPLEMENTED_NOT_VERIFIED` | `SocraticDebateEngine.ts` |
| `PX15-T09` | Audio lessons & podcast scripts, multi-voice dialogue, cue markers | `IMPLEMENTED_NOT_VERIFIED` | `StudyAudioLessonEngine.ts` |
| `PX15-T10` | Educator review controls, answer key locking, assignments, audit trail | `IMPLEMENTED_NOT_VERIFIED` | `EducatorReviewControls.ts` |
| `PX15-T11` | StudyStudioService integrated workflow and accessibility | `IMPLEMENTED_NOT_VERIFIED` | `StudyStudioService.ts` |
| `PX15-T12` | Study assessment integrator automated integrity suite | `IMPLEMENTED_NOT_VERIFIED` | `StudyStudio.eval.test.ts` |

### PHASE PX-16 — Visual Website and Click-to-Code Studio
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX16-T01` | Define versioned website project schema & v1-to-v2 migrations | `IMPLEMENTED_NOT_VERIFIED` | `WebsiteProjectModel.ts` |
| `PX16-T02` | Build block-based editor, block library, templates & undo/redo history | `IMPLEMENTED_NOT_VERIFIED` | `BlockEditorEngine.ts` |
| `PX16-T03` | Implement responsive live preview & sandboxed HTML frame with strict CSP | `IMPLEMENTED_NOT_VERIFIED` | `ResponsivePreviewRenderer.ts` |
| `PX16-T04` | Implement asset manager, WebP variants & remote image blocking | `IMPLEMENTED_NOT_VERIFIED` | `WebsiteAssetManager.ts` |
| `PX16-T05` | Implement element selection, box model metrics & contrast inspector | `IMPLEMENTED_NOT_VERIFIED` | `ElementInspectorService.ts` |
| `PX16-T06` | Implement source-linked inspection & dev-server root confinement | `IMPLEMENTED_NOT_VERIFIED` | `SourceLinkInspectionService.ts` |
| `PX16-T07` | Implement visual edit proposals & SHA-256 approval digest gate | `IMPLEMENTED_NOT_VERIFIED` | `VisualEditProposalService.ts` |
| `PX16-T08` | Implement sandbox, diff, pre-edit backups & transactional undo | `IMPLEMENTED_NOT_VERIFIED` | `WebsiteSandboxUndoManager.ts` |
| `PX16-T09` | Implement clean HTML import, multi-page ZIP export & link validation | `IMPLEMENTED_NOT_VERIFIED` | `WebsiteImportExportService.ts` |
| `PX16-T10` | Build Web Studio UI service orchestrator | `IMPLEMENTED_NOT_VERIFIED` | `WebStudioService.ts` |
| `PX16-T11` | Browser, injection resistance & security evaluation test suite | `IMPLEMENTED_NOT_VERIFIED` | `WebStudio.eval.test.ts` |
| `PX16-T12` | Web accessibility auditor & WCAG 2.1 AA scoring | `IMPLEMENTED_NOT_VERIFIED` | `WebAccessibilityAuditor.ts` |

### PHASE PX-17 — Developer Utility Pack: Mock APIs, Skill Export, and Project Tooling
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX17-T01` | Expand Mock API data model, inferred schemas & relational joins | `IMPLEMENTED_NOT_VERIFIED` | `MockApiEngine.ts` |
| `PX17-T02` | Implement generated CRUD routes, filter, sort & schema validation | `IMPLEMENTED_NOT_VERIFIED` | `MockApiEngine.ts` |
| `PX17-T03` | Add deterministic chaos fault injection, latency & scenario presets | `IMPLEMENTED_NOT_VERIFIED` | `MockChaosSimulator.ts` |
| `PX17-T04` | Add safe OpenAPI 3.0/3.1 parser, ref depth cap & remote ref blocking | `IMPLEMENTED_NOT_VERIFIED` | `OpenApiSchemaImporter.ts` |
| `PX17-T05` | Source-preserving skill export, Book-to-Skill workflow & SHA-256 digests | `IMPLEMENTED_NOT_VERIFIED` | `SourcePreservingSkillExporter.ts` |
| `PX17-T06` | Implement capability pack scaffolder with golden & security negative tests | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityPackScaffolder.ts` |
| `PX17-T07` | Add project doctor diagnostics, contract validation & ranked actions | `IMPLEMENTED_NOT_VERIFIED` | `ProjectDoctorService.ts` |
| `PX17-T08` | Add DeveloperUtilityPackService integrated orchestrator | `IMPLEMENTED_NOT_VERIFIED` | `DeveloperUtilityPackService.ts` |
| `PX17-T09` | Security & evaluation test suite: CSV injection & route isolation | `IMPLEMENTED_NOT_VERIFIED` | `DeveloperUtilityPack.eval.test.ts` |

### PHASE PX-18 — Unified Capability Hub, Setup, Jobs, Artifacts, and Operations UX
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX18-T01` | Define Capability Hub information architecture & section classification | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityHubPanel.tsx` |
| `PX18-T02` | Build capability cards, detail drawers & execution environment badges | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityHubPanel.tsx` |
| `PX18-T03` | Build guided setup doctor, dependency probe & credential masking | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityGuidedDoctor.ts` |
| `PX18-T04` | Build unified job console, lifecycle telemetry & error guidance | `IMPLEMENTED_NOT_VERIFIED` | `UnifiedJobConsoleService.ts` |
| `PX18-T05` | Build exact-scope approval experience with SHA-256 digest validation | `IMPLEMENTED_NOT_VERIFIED` | `ExactScopeConfirmModal.tsx` |
| `PX18-T06` | Build artifact browser, parent lineage navigation & SHA-256 hashes | `IMPLEMENTED_NOT_VERIFIED` | `ArtifactLineageService.ts` |
| `PX18-T07` | Integrate Agent Operations console & multi-agent event stream views | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityHubPanel.tsx` |
| `PX18-T08` | Add pack management, manifest verification, diffs & clean rollback | `IMPLEMENTED_NOT_VERIFIED` | `PackManagerService.ts` |
| `PX18-T09` | Add diagnostics, support bundle generator & secret/PII scrubber | `IMPLEMENTED_NOT_VERIFIED` | `SupportBundleService.ts` |
| `PX18-T10` | Accessibility and responsive design (WCAG 2.1 AA focus trap & ARIA) | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityHubPanel.css` |
| `PX18-T11` | End-to-end setup, job lifecycle & recovery test suite | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityHubOperations.eval.test.ts` |

### PHASE PX-19 — Integrated Security, Privacy, Safety, and Abuse Resistance
| Task ID | Description | Status | Evidence / Implementation Reference |
|---|---|---|---|
| `PX19-T01` | Update comprehensive threat model across all capability vectors | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityThreatModel.ts` |
| `PX19-T02` | Build capability-composition abuse protection & prompt injection defense | `IMPLEMENTED_NOT_VERIFIED` | `CapabilityCompositionDefense.ts` |
| `PX19-T03` | Harden pack supply chain, SBOM scanner, license checks & quarantine | `IMPLEMENTED_NOT_VERIFIED` | `PackSupplyChainGuard.ts` |
| `PX19-T04` | Harden worker process isolation, binary allowlist & env scrubbing | `IMPLEMENTED_NOT_VERIFIED` | `WorkerProcessIsolationGuard.ts` |
| `PX19-T05` | Harden desktop permissions, micro-consents & clipboard credential warning | `IMPLEMENTED_NOT_VERIFIED` | `DesktopPermissionGuard.ts` |
| `PX19-T06` | Harden model, voice & media consent with synthetic disclosure watermarks | `IMPLEMENTED_NOT_VERIFIED` | `MediaConsentGuard.ts` |
| `PX19-T07` | Harden cross-capability artifact handoff revalidation & traversal block | `IMPLEMENTED_NOT_VERIFIED` | `ArtifactHandoffGuard.ts` |
| `PX19-T08` | Harden web security boundary, 169.254.169.254 SSRF & HTML sanitizer | `IMPLEMENTED_NOT_VERIFIED` | `WebSecurityBoundaryGuard.ts` |
| `PX19-T09` | Harden memory & context store against system instruction injection | `IMPLEMENTED_NOT_VERIFIED` | `MemoryInjectionDefense.ts` |
| `PX19-T10` | Data retention, deletion & multi-layer cascading scrub manager | `IMPLEMENTED_NOT_VERIFIED` | `DataRetentionManager.ts` |
| `PX19-T11` | Independent security, composition abuse & privacy evaluation suite | `IMPLEMENTED_NOT_VERIFIED` | `CapabilitySecurityAndAbuse.eval.test.ts` |

#### PHASES PX-20 through PX-22 (Train D)
- `PX-20`: High-Resilience Runtime, Concurrency, and Disaster Recovery (Tasks `PX20-T01`..`T08`)
- `PX-21`: Golden Evaluations, Benchmark Certification, and SLO Proof (Tasks `PX21-T01`..`T08`)
- `PX-22`: Release Certification, Documentation, and Maintenance (Tasks `PX22-T01`..`T08`)

## Pull-request review rule

Any pull request that changes release status must update this tracker, the release evidence index, the relevant feature-manifest entry when applicable, and the current/archived handoffs in the same task closure.
