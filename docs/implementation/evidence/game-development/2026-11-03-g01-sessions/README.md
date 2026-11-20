# G01.2 project-scoped sessions — 2026-11-03

Completed gate: **G01.2** from the implementation plan. The production caller is
`routeManifest` → `createGameStudioRouter` → `createProjectSessionRouter` →
`GameProjectSessions` → a private `GameEngineBridge` and adapter backed by the exact
enrolled executable. G01.3 and the rest of G01 remain open.

## Behavior and API

1. Enroll/select the exact runtime with the existing `/api/game-studio/projects` API.
2. `POST /api/game-studio/connect` with `{ "projectId": "<enrolled ID>" }` returns
   `sessionId`, project/profile revision/digest, runtime ID and observed version.
3. Supply `sessionId` in the query for project/scene/script/profiler reads and in the
   JSON body for proposals, approve, apply, rollback, scenario, export and disconnect.
   `GET /api/game-studio/sessions` lists only this authenticated owner's sessions;
   its `freshness: "not_checked"` is explicit. `GET /sessions/:id` validates freshness.
4. Optional engine/project selectors must agree with the session. Root, executable,
   version, requester/approver/caller, tenant and project-scope body fields cannot
   override the server-owned binding. Missing authentication/enrollment/session fails
   closed. The application's local/developer/readiness/audit middleware is retained.

Each session owns its proposal/transaction store and adapter. Same-engine projects
can run concurrently without overwriting a shared engine connection. An in-process
exclusive lock uses physical identity across owners, path aliases, separate service
instances and profile refresh; another request on that physical project receives
`PROJECT_BUSY` (409). Unrelated projects keep progressing. Repeated connect for the
same owner/profile returns the existing session. Disconnect is explicit, including
for stale sessions. The process has a bounded 64-session limit.

Before and after each operation, the registry checks physical identity, descriptor
bytes and enrolled executable/build hashes, and sessions check the profile revision,
digest, runtime and adapter root/version. A profile refresh requires reconnection.
Native assertion request hashes additionally bind owner/session/profile/runtime and
a fresh opaque attempt. Replayed reports cannot pass even on the same physical root.
Legacy standalone native requests retain their existing digest format when no session
scope is supplied. Synthetic unit backends are never called native qualification.

Configuration descriptors cannot mutate through a session that depends on them.
Scene/export/generated-native paths must stay inside the enrolled project, including
junction checks. Rollback validates all live snapshot paths before writing any bytes.
If post-apply scope validation fails while the root identity remains valid, the
session restores its own source transaction before rejecting the result. If recovery
cannot be proven safe, it returns `PROJECT_SESSION_RECOVERY_REQUIRED` with the
transaction ID and publishes no success.

## Changed files

Paths below are relative to `G:\dev\Chatbot`.

| Files | Purpose |
|---|---|
| `src/core/gaming/project/GameProjectSessions.ts`, `ProjectSessionTypes.ts`, `ProjectBridgeFactory.ts` | Isolate mutable bridges/adapters and bind production native calls to selected enrollment/runtime. |
| `src/core/gaming/project/ProjectOperationLocks.ts`, `ProjectSessionGuards.ts`, `GameProjectRegistry.ts` | Shared physical locks, freshness/path/configuration/evidence checks and safe post-apply identity check. |
| `src/server/routes/game-studio/projectSessionRoutes.ts`, `gameStudioRoutes.ts` | Replace global engine-keyed routes with authenticated explicit sessions; keep static studio/MAST/slicing/asset-cook routes. |
| `src/core/gaming/engine/GameEngineTypes.ts`, `EngineProposalIntegrity.ts`, `NativeScenarioEvidence.ts` | Canonical proposal scope and opaque native attempt binding. |
| `src/core/gaming/engine/GameEngineBridge.ts`, `EngineSnapshotRestore.ts`, `ProjectMutationStore.ts` | Real-path approved-root validation and shared live-path-safe rollback. |
| `src/core/gaming/godot/GodotCliBackend.ts`, `GodotMcpXAdapter.ts`, `GodotTransactionManager.ts`, `src/core/native-runtime/NativeGameEditorBackends.ts` | Propagate attempt hash, report observed Godot version and share rollback protection. |
| `src/core/gaming/project/GameProjectSessions.test.ts`, `__tests__/SessionFixture.ts`, `src/server/routes/__tests__/project-session-routes.test.ts` | Real SQLite, synthetic runtime fixtures: isolation, aliases, concurrent locks, replay/drift, moved roots, unsafe rollback and restart behavior. |
| `src/server/routes/__tests__/game-studio-routes.test.ts`, `project-enrollment-routes.test.ts`, `feature-expansion-routes.test.ts` | Exercise existing regression contracts through enrolled sessions; maintain source-editing and unavailable-backend checks. |
| `scripts/native/verify-project-sessions.ts` | Reproduce real HTTP/native checks and server/database restart on disposable projects. |
| `docs/implementation/GAME_DEVELOPMENT_STATUS.md`, `docs/architecture/large-file-register.md`, this evidence directory | Current checkpoint, deterministic line counts and reviewable verification/preservation record. |

## Validation

All commands ran in `G:\dev\Chatbot`. No baseline failure: **68 tests passed in
four focused existing suites** before edits ([baseline](baseline-tests.txt)).
Intermediate HTTP test runs exposed fixture/assertion mistakes (missing mock cooker
artifact path, nested error-code field and expected 404 for an absent proposal);
these were corrected and the final complete regression run passed.

| Command | Result / evidence |
|---|---|
| `npx jest --runInBand --runTestsByPath src/core/gaming/project/GameProjectSessions.test.ts src/core/gaming/godot/GodotTransactionManager.test.ts src/core/gaming/engine/ProjectMutationStore.test.ts src/core/gaming/project/GameProjectRegistry.test.ts` | 85 tests / four suites passed; [core tests](core-tests-initial.txt). |
| `npx jest --runInBand --runTestsByPath src/server/routes/__tests__/project-session-routes.test.ts` | Three HTTP integration tests passed; [scoped routes](routes-scoped.txt). |
| `npx jest --runInBand --testPathPatterns='src/core/gaming\|src/core/agents/gamedev\|src/core/native-runtime/__tests__/RuntimeDiscovery.test\|src/core/native-runtime/__tests__/EpicUnrealInstallations\|src/core/native-runtime/__tests__/NativeGameEditorBackends\|game-studio-routes\|project-enrollment-routes\|project-session-routes\|native-adapter-fail-closed-routes\|feature-expansion-routes\|release-security\|src/server/routeManifest.test\|src/core/coding/integrations/CodingToolsService.test\|src/core/database/Database.test\|src/core/initialization/ServiceInitializer.test'` | **297 passed / 28 suites**, one optional PostgreSQL integration test skipped; [regression](regression.txt). |
| `npm run type-check:server`; `npm run type-check:tests`; `npm run lint:server` | Passed; [server types](type-server.txt), [test types](type-tests.txt), [lint](lint.txt). |
| `node scripts/release/check-file-size.mjs --write-register`; `npm run check:file-size` | Passed; [file size](file-size.txt). |
| `npx tsx scripts/native/verify-project-sessions.ts` | **12 real native session gates passed** using Godot `4.7.1.stable.official.a13da4feb`; [native log](native-sessions.txt), [complete record](native-sessions.json). |
| `git diff --check` and initial SHA-256 comparison | Passed; [preservation audit](preservation.json), [source/evidence hashes](verification.json). |

The native run used the actual catalog, production router and session factory, real
loopback HTTP and SQLite. Two synthetic projects each returned their own Label text
and node-presence observation; three real headless attempts had fresh bindings.
Both projects received distinct source content, foreign grants/owners were rejected,
and one rollback left the other project's source intact. A real server/database
restart preserved profiles, discarded old sessions/grants and required reconnection.
External descriptor drift then blocked the new session. The script deletes only its
verified `godot-sessions-native-*` temporary directory. Installed engines and user
projects were not modified.

## Limits, persistence and next gate

No database migration, dependency change, provider change or engine installation was
needed. Enrollment uses the existing G01.1 SQLite table. Sessions, locks, approvals,
transaction snapshots and rollback are **process-local**, not durable jobs or a crash
journal. Do not run simultaneous server processes against the same mutable game;
durable/multi-process orchestration, cancellation and crash recovery remain G04.
After restart, approved source changes require a fresh proposal/approval; enrollment
alone does not retain undo history. Path guards cannot lock out external OS/editor
writers; pre/post validation rejects drift instead of publishing a successful result.

Native checks here establish scene observation and session isolation only. They do
not establish input/death/respawn/checkpoint behavior, rendering or export. Unity and
Unreal connections are exercised with synthetic adapters; no licensed editor was
launched in this slice. Their actual runtime metadata remains in the earlier discovery
report. MZ native enrollment, Godot C# SDK and PostgreSQL enrollment are unqualified.

Next smallest gate: **G01.3**, file-role and dependency providers in ToolWorkspace,
AutomaticContext and source filters, retaining scope/secrets/cache protections.
