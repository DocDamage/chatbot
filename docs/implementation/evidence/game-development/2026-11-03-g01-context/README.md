# G01.3 file roles and dependency context — 2026-11-03

Completed gate: **G01.3** in the handoff plan. Existing uncommitted campaign/RAG/client,
G00, enrollment, runtime discovery and G01.2 changes were preserved. No branch switch
or commit was made. The next executable gate is **G02.1**, immutable source snapshots
and source manifest parsing.

## Production wiring and API

`routeManifest` retains local/developer/auth/readiness/audit controls and injects the
existing SQLite project store into `createGameStudioRouter`. The new
`createProjectContextRouter` uses `GameProjectContext`, the authenticated owner and
stored enrollment to select a canonical root, engine kind and profile. Caller body
fields cannot override owner/tenant/root/kind/runtime. Its endpoints are:

| Request | Behavior |
|---|---|
| `GET /api/game-studio/projects/:id/files` | Up to 1000 discovered files, roles/reasons and text read/edit eligibility; reports when discovery reaches its cap. No write authorization is granted. |
| `GET /api/game-studio/projects/:id/files/search?q=...` | Policy-filtered text search, with existing bounded file/result/read limits and skipped/truncated counts. |
| `POST /api/game-studio/projects/:id/context` with `{ "files": ["Main.tscn"], "automaticContext": true }` | Read-only source snapshots, exact hashes, role/reason summaries, bounded dependency graph, named omissions and owner/project/profile-bound context digest. An optional bounded `message` provides selection hints. |

Responses use `Cache-Control: no-store`. Context requests share the physical project
lock with session work and refresh. Profile freshness is checked before/after selection;
captured source hashes are re-read before returning. Unresolved runtime profiles can
serve statically inspected source, so MZ database context is usable while MZ native
connection remains blocked. No engine or plugin is executed to obtain these sources.

The existing `CodingToolsService`/`AutomaticContext` path accepts an immutable,
server-injected policy. It does not accept a policy/root override from an HTTP body
and is not instantiated per project by this context API. This preserves the existing
model worker reservation. The real coding route is tested with an explicitly configured
ROM source workspace and a stubbed Aider adapter: assembly/include context reaches the
adapter, ROM bytes do not, and job history records the selection. Production ROM
enrollment and a project-aware generation orchestrator remain later gates.

## Roles, dependencies and boundaries

The reference kit's `ProjectFilePolicy` was adapted into the application, using its
existing Unicode helpers and shared sensitive-path checks. Roles distinguish
`editable-text`, `structured-data`, `engine-native`, `binary-tool`, `read-only` and
`excluded`. Structured MZ data/core/runtime metadata and native assets cannot gain
generic text edit permissions. Enrolled configuration descriptors remain read-only.
Unreal's exception applies only to `Source/<Module>/Private` and plugin module source
layouts; other private/credential stores remain blocked. The default coding workspace
still excludes `data` and `private` unless a trusted game policy is supplied.

The same policy is used by gateway discovery, explicit reads/search, ToolWorkspace,
automatic context, PatchConflictDetector/StructuredEditEngine and session mutation
preflight. Session proposals retain server-owned target actions, checked again at
approval, apply and rollback. An in-project link swapped after approval cannot redirect
a source write or rollback into a generated cache. Symlinks/junctions are excluded from
context and project text write preflight, even when their target stays inside the root.
Binary/native/asset roles are listed as metadata when appropriate but cannot be text
captured. Full read buffers are checked for NUL and lossless UTF-8; hashes use original
bytes, preserving BOM and CRLF. Bad text does not abort an otherwise valid text search.

| Provider | Initial static relationships and explicit limits |
|---|---|
| Godot | `res://` references across scenes/resources/config, attached/inherited resource files, UID sidecars and scene/resource headers, literal relative `load`/`preload`. Scene-local resource/node names and signals/input action names remain named identities. Dynamic expressions, missing/duplicate UIDs and missing targets remain unresolved. |
| MZ | Ordered enabled/disabled plugins from the generated JSON assignment; known typed database IDs, map files/catalog, database null-sentinel diagnostics. Malformed JSON/executable plugin assignments are not evaluated. Event command semantics, asset lookup and schema-valid mutation are not inferred. |
| ROM source | Literal `incsrc`, `include`, `.include` and `incbin`. Source includes are supporting context; binary includes provide target metadata only. No ROM bytes, build execution, symbol/address inference or patch operation. |
| Unreal | Literal quoted C/C++ includes resolved relative to the source or to a unique discovered project header. Ambiguous/engine/package include roots remain unresolved. Build rules are not executed; native assets require editor inspection. |
| Unity | Bounded `.meta` GUID identities and textual GUID references. Duplicate/missing GUIDs remain unresolved. Native scene/prefab semantics still require the editor; this does not reconstruct a native scene graph. |

Existing JS/TS imports, aliases, importing callers and related tests continue working.
The conservative capture cap remains **12 files / 16 KB**. Discovery/scanning remains
bounded (root listing 3000, nearby listing 600 per seed, 400 source files / 512 KB scanned,
32 KB per scanned file). Dependency graphs cap at 2000 edges; MZ walks cap at 5000 nodes
per file. Supporting file expansion stops after two levels. Missing/budget/depth/role
omissions are explicit; named omission detail is capped at 100 while the total count
continues. This is a selected-source digest, not a full project snapshot or active corpus.

## Changed files

Paths are relative to `G:\dev\Chatbot`.

| Files | Purpose |
|---|---|
| `src/core/gaming/project/ProjectFilePolicy.ts`, `src/core/coding/security/WorkspaceFilePolicy.ts` | Shared role types, strict project-relative paths and trusted engine-specific policy. |
| `src/core/coding/security/WorkspacePathPolicy.ts`, `ApprovedRepositoryGateway.ts` | Narrow Unreal exception; matching discovery/read/search policy; byte hashes and lossless text guards. |
| `src/core/coding/integrations/ToolWorkspace.ts`, `AutomaticContext.ts`, `CodingToolsService.ts` | Policy-aware snapshots, supporting context, named omissions, dependency/role summaries and persisted job selection. |
| `src/core/coding/integrations/ProjectDependencies.ts`, `dependencies/GodotDependencies.ts`, `MzDependencies.ts`, `SourceDependencies.ts` | Bounded non-executing dependency providers. |
| `src/core/coding/editing/PatchConflictDetector.ts`, `StructuredEditEngine.ts` | Share file roles and link protection with source write preflight. |
| `src/core/gaming/project/GameProjectContext.ts`, `src/server/routes/game-studio/projectContextRoutes.ts`, `gameStudioRoutes.ts` | Production enrollment-scoped files/search/context routes and freshness binding. |
| `src/core/gaming/project/GameProjectSessions.ts`, `ProjectSessionGuards.ts` | Preserve canonical server-owned targets and recheck file roles/links at mutation lifecycle gates. |
| `src/core/gaming/project/ProjectFilePolicy.test.ts`, `GameProjectContext.test.ts`, `src/core/coding/integrations/ProjectDependencies.test.ts`, `src/server/routes/__tests__/project-context-routes.test.ts` | Policy, bytes, dependencies, omission, drift, alias races and actual JWT/role/HTTP/coding-route integration tests. |
| `scripts/native/verify-project-context.ts` | Reproduce production HTTP/SQLite context and restart using the actual host Godot identity and disposable synthetic projects. |
| `docs/implementation/GAME_DEVELOPMENT_STATUS.md`, this directory | Status, command outcomes and preservation/verification evidence. The file-size register was regenerated and checked. |

## Validation and evidence

Commands ran from `G:\dev\Chatbot`. Baseline: **25 tests passed / three suites**, no
pre-existing failure. An intermediate test typing error and a lint issue in the adapted
control-character check were fixed; final gates pass.

| Command | Outcome / retained evidence |
|---|---|
| `npx jest --runInBand --runTestsByPath src/core/coding/integrations/AutomaticContext.test.ts src/core/coding/integrations/CodingToolsService.test.ts src/core/coding/integrations/DraftChecks.test.ts` | Baseline 25 passed / three suites; [baseline](baseline-tests.txt). |
| `npx jest --runInBand --runTestsByPath src/core/gaming/project/GameProjectContext.test.ts src/core/gaming/project/ProjectFilePolicy.test.ts src/core/gaming/project/GameProjectSessions.test.ts src/server/routes/__tests__/project-session-routes.test.ts` | 25 passed / four suites, including post-approval in-project alias write/rollback controls; [safety tests](context-safety.txt). |
| `npx jest --runInBand --testPathPatterns='src/core/coding\|src/core/gaming\|src/core/agents/gamedev\|src/core/native-runtime/__tests__/RuntimeDiscovery.test\|src/core/native-runtime/__tests__/EpicUnrealInstallations\|src/core/native-runtime/__tests__/NativeGameEditorBackends\|coding-tools.test\|project-context-routes\|game-studio-routes\|project-enrollment-routes\|project-session-routes\|native-adapter-fail-closed-routes\|feature-expansion-routes\|release-security\|src/server/routeManifest.test\|src/core/database/Database.test\|src/core/initialization/ServiceInitializer.test'` | **523 passed / 75 suites**, one optional PostgreSQL test skipped; [regression](regression.txt). |
| `npm run type-check:server`; `npm run type-check:tests`; `npm run lint:server` | Passed; [server types](type-server.txt), [test types](type-tests.txt), [lint](lint.txt). |
| `node scripts/release/check-file-size.mjs --write-register`; `npm run check:file-size` | Passed; [file size](file-size.txt). New production modules are under 300 lines. |
| `npx tsx scripts/native/verify-project-context.ts` | **11 HTTP/source gates passed**, including an actual SQLite/server restart; [log](http-context.txt), [record](http-context.json). |
| `npx tsx scripts/native/verify-project-sessions.ts docs/implementation/evidence/game-development/2026-11-03-g01-context/native-session-regression.json` | **12 real headless Godot session gates passed again**; [log](native-session-regression.txt), [record](native-session-regression.json). |
| Initial SHA-256 comparison; `git diff --check` | Existing changes preserved with only intentional session/router integrations; [preservation](preservation.json), [source/evidence hashes](verification.json). |

The new HTTP verifier used the actual runtime catalog, production router, SQLite store
and source selector. It observed Godot `4.7.1.stable.official.a13da4feb`, followed
distinct scene/script/resource sources, checked original BOM/CRLF byte hashes, proved
secret/cache/owner exclusions, read MZ data while execution stayed blocked, reproduced
the same context digest after a server/database restart and changed the digest after
an ordinary source edit. Descriptor drift was rejected. Both verifier scripts remove
only their verified temporary fixture roots; installed engines/user games are untouched.

## Persistence, recovery and remaining gates

No database migration, dependency, provider or installed-engine change. Enrollment
uses the existing G01.1 SQLite table. Context is computed on request and has no durable
job state; existing coding job history persists selection metadata for coding requests.
These context routes perform no writes requiring rollback. Session proposals and
transactions remain process-local, with existing exact source rollback and stronger live
role/path checks. An unsafe restore is refused rather than written through an alias.
External OS writers are not locked out; validation rejects observed drift. Durable
multi-process orchestration/crash recovery remains G04.

This phase does not install/activate a reference corpus, use retrieved evidence for
real generation, provide new model/native editing validators, or certify gameplay,
rendering, export, MZ execution, Unity/Unreal native semantics or ROM build/patch tools.
MZ native execution, Godot C# SDK, PostgreSQL enrollment and ROM enrollment remain
unqualified as recorded in prior checkpoints.
Next: **G02.1** immutable source snapshots and manifest parsing, then bounded acquisition
and activation before G03 drafting integration.
