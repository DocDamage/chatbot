# G00 implementation and validation — November 3, 2026

Completed: **G00.1, G00.2, G00.3 and G00.4** in the existing application. This slice
does not complete the broader game-development or ROM-engineering plan.

## Baseline and environment

The repository root is `G:\dev\Chatbot`; the nested directory supplied by the user is
the reference kit, not a second application. HEAD matches the reviewed baseline
`c26d767345bd65e5192ed99e1213f8a1a0a7b110`. The existing branch is
`codex/dnd-campaign-integration` and was reused. The initial tracked diff comprised
12 files (156 insertions, nine deletions) for campaign/chat/retrieval integration,
with additional untracked campaign/reference work. Those application changes were
preserved; no dependencies were installed and no branch, commit or publication was made.

Read: the kit's handoff, plan, start/validation documents, and `docs/PROJECT_STATUS.md`.
No applicable `AGENTS.md` was found. The root status document contains pre-existing
non-UTF-8 bytes, so it was left unchanged. The new phase status is
`docs/implementation/GAME_DEVELOPMENT_STATUS.md`.

Actual runtime: Windows x64, Node 24.14.1, npm 11.12.1, TypeScript 5.9.3, Jest 30.5.2.
The native probe used
`C:\Users\dferr\bin\godot-v4.7.1\Godot_v4.7.1-stable_win64_console.exe`, reporting
`4.7.1.stable.official.a13da4feb`. Its byte hash is retained in
[native-observations.json](native-observations.json). No version recollection or
adapter default was used as native version evidence.

## Production callers and changed files

| Task | Change and production caller |
|---|---|
| G00.1 | Compared the checkout with the pinned baseline; recorded the focused baseline checks, current runtime and limits. |
| G00.2 | New `src/core/gaming/engine/CanonicalJson.ts` and `EngineProposalIntegrity.ts` supply the shared validated serializer, complete proposal scope digest, byte hashes and approval checks. Both `GodotTransactionManager.ts` and `ProjectMutationStore.ts` use them. Their create/approve/read/transaction results are detached copies; clients cannot alter server-owned authorization or rollback records. Apply rechecks integrity, expiry, caller/tenant constraints and target hashes. |
| G00.3 | New `EngineTextMutationPolicy.ts` preflights the entire Godot action batch and confines generic writes to explicit text formats with lossless existing UTF-8 bytes. `GodotSceneMutator.ts` and `GodotScriptMutator.ts` reject unsupported direct calls. `ProjectMutationStore.ts` no longer interprets semantic `remove_node` as file deletion. Godot's implemented action list is exposed by `GodotMcpXAdapter.ts` through the existing Game Studio summary. |
| G00.4 | New `NativeScenarioEvidence.ts` validates native request bindings, assertion identities/counts, report mode, observed values and unchanged expectations. `GodotCliBackend.ts`, `NativeGameEditorBackends.ts`, `GameEditorInstrumentationSources.ts` and `scripts/native/godot_runtime_probe.gd` use that protocol. `GodotRuntimeRunner.ts` and `GameEngineBridge.ts` also guard injected backend reports. `GameEngineTypes.ts` carries evidence and check-kind fields. `GameDevGeniusAgent.ts` reports advice as unverified. |

The production HTTP callers remain `/api/game-studio/proposals`, the proposal
approve/apply routes, `/api/game-studio/summary`, and `/api/game-studio/runtime/scenario`
in `src/server/routes/game-studio/gameStudioRoutes.ts`. Requester identity now comes
from the existing authenticated user/local-operator context, not a draft body field.
Existing route authentication, deployment guards and source-editing routes were retained.

Regression changes:

- New `src/core/gaming/godot/GodotTransactionManager.test.ts` and `GodotCliBackend.test.ts`.
- Extended `ProjectMutationStore.test.ts`, `NativeGameEditorBackends.test.ts`,
  `GameDevGeniusAgent.test.ts`, and the real `game-studio-routes.test.ts`.
- Corrected `GodotBridge.eval.test.ts`: out-of-root proposals now fail at creation,
  and the mocked FPS observation must exceed the threshold rather than equal it.
  No task manifest was weakened to pass a generated implementation.
- New `scripts/native/verify-godot-evidence.ts` runs only disposable synthetic fixtures.
- Updated `docs/architecture/large-file-register.md` with current line counts. Its two
  nongame line-count updates reflect the already-present initializer/RAG changes;
  those production files were not edited by G00.

## Executed validation

Commands ran at the application root. Console output was initially redirected to
`.log` files; the linked `.txt` files are byte-identical retained copies because the
repository ignores `.log` files.

| Command | Outcome | Retained output |
|---|---|---|
| `npx jest --runInBand --runTestsByPath src/core/gaming/__tests__/GodotBridge.eval.test.ts src/core/gaming/engine/ProjectMutationStore.test.ts src/core/native-runtime/__tests__/NativeGameEditorBackends.test.ts src/core/agents/gamedev/GameDevGeniusAgent.test.ts src/server/routes/__tests__/game-studio-routes.test.ts` | Baseline: 38 passed, five suites; no pre-existing failure found in this scope. | [baseline-tests.txt](baseline-tests.txt) |
| `npm run type-check:server` before editing | Passed. | [baseline-type-server.txt](baseline-type-server.txt) |
| `npx jest --runInBand --testPathPatterns='src/core/gaming\|src/core/agents/gamedev\|src/core/native-runtime/__tests__/NativeGameEditorBackends\|game-studio-routes\|native-adapter-fail-closed-routes\|feature-expansion-routes\|release-security\|src/server/routeManifest.test\|src/core/coding/integrations/CodingToolsService.test'` | Final: **205 passed, 17 suites**, no skipped tests. The pipes in this table are escaped for Markdown; the shell argument used ordinary `|` characters inside single quotes. | [final-tests.txt](final-tests.txt) |
| `npm run type-check:server` | Passed after final source changes. | [type-server.txt](type-server.txt) |
| `npm run type-check:tests` | Passed after final source changes. | [type-tests.txt](type-tests.txt) |
| `npm run lint:server` | Passed after final source changes. | [lint-server.txt](lint-server.txt) |
| `npm run check:file-size` | Passed after refreshing the deterministic register with `node scripts/release/check-file-size.mjs --write-register`. | [file-size.txt](file-size.txt) |
| `npm run eval:gamedev` | Eight **metadata checks** passed. This existing runner does not generate or execute games; its existing output already labels the result as metadata validation. | [metadata-validation.txt](metadata-validation.txt) |
| `npx tsx scripts/native/verify-godot-evidence.ts` | Five native headless **scene-observation** gates passed: matching observations succeed; mismatched expectations, empty assertions, a missing scene and unsupported custom assertions fail. | [native-observations.txt](native-observations.txt), [full reports](native-observations.json) |
| `git diff --check` | Passed. | [diff-check.txt](diff-check.txt) |

The final Jest run includes nested values/key order/action order, nonfinite/non-JSON
inputs, complete scope binding, post-approval internal tampering, detached public
records, stale/created/deleted files, expired/cross-proposal authority, caller/tenant
mismatch, duplicate in-flight apply, unsupported-batch zero writes, binary-format and
binary-content rejection, exact BOM/CRLF rollback, empty/missing/malformed/replayed/
foreign native reports, wrong report mode, nonzero exits, host-side comparisons,
real route dispatch, hosted/root guards, authentication and existing coding-service
behavior. Process/editor tests within Jest are explicitly mocked, not native certifications.

During implementation, a new parameterized Jest case initially had a tuple typing
error; failure-report handling was adjusted to preserve valid negative reports; and
the old FPS fixture was corrected as described above. Those were introduced/intermediate
failures, not pre-existing failures. Final type/Jest/lint checks pass.

## Database, recovery and remaining gates

No schema or database data changed. Proposal, approval and rollback stores remain
process-local. Caught write failures restore original supported UTF-8 file bytes;
returned transaction objects cannot alter those snapshots. Restart persistence,
crash-after-apply recovery and a durable project-wide worker lock are G04 work.
The new digest format requires fresh proposals/approvals; old process-local records
do not survive server restart. Native bridge results with the old unbound format fail
closed. The Godot manager prevents concurrent applies within its existing session;
cross-project/owner session isolation remains G01 work.

No real checkpoint, death/respawn input scenario, rendered-screen review or export ran.
There was no enrolled user game or unchanged gameplay assertion manifest in this slice.
No corpus was acquired/activated and no local-model drafting was exercised. Unity and
Unreal protocol changes have unit coverage, but their revised native bridges still
need editor-specific qualification. No RPG Maker, ROM build, patch codec or emulator
capability is claimed. Full release, client/browser, coverage and package gates were
not run for this server-only slice.

Next smallest executable gate: **G01.1** project enrollment with exact executable/build
and compatibility evidence, then **G01.2** owner/project-scoped sessions and **G01.3**
file-role/context policy. G02–G05 are still required for the first actual Godot checkpoint
workflow. This G00 evidence does not certify a complete engine or autonomous game creation.
