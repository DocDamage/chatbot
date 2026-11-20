# G01.1 project/runtime enrollment — November 3, 2026

The Unreal discovery limitation recorded below is superseded by the
[installation discovery follow-up](../2026-11-03-unreal-discovery/README.md).
That follow-up located and verified the current 5.8.4 installation and corrected the
host discovery/resource-version handling. The original evidence here is retained as history.

Completed task: **G01.1**, the next enrollment slice from the handoff. G01.2 session
isolation and G01.3 file roles/dependency context remain open. This is not completion
of the whole G01 phase or a gameplay capability claim.

## Checkout and preservation

Application root: `G:\dev\Chatbot`. HEAD remains the reviewed baseline
`c26d767345bd65e5192ed99e1213f8a1a0a7b110`, on the existing
`codex/dnd-campaign-integration` branch. The reference kit remains a reference bundle.
The handoff, phase requirements, current game-development status and G00 evidence were
read before implementation. No applicable `AGENTS.md` was found in the prior audit or
the current checkout search.

[baseline.json](baseline.json) records the hashes of tracked files already modified
when this slice began. Their campaign, chat, RAG, client, package and notice changes
were preserved. Within that set G01 changed only the shared service initializer, route
manifest, Game Studio router and deterministic large-file register, as required for
integration. The G00 proposal/integrity/mutation/native-evidence implementations were
also compared with their retained hashes and remain unchanged. The game-development
status document has been updated to report the new checkpoint.

No dependency installation, model/provider change, project migration, branch/commit,
external publication or live application restart was performed.

## Changed files and actual production callers

| Files | Purpose |
|---|---|
| `src/core/gaming/project/EngineVersions.ts`, `Unicode.ts` | Port the reference kit's strict version/build contracts, using G00's single canonical serializer. Keep Godot's complete observed build, Unity release suffixes, Unreal associations and full build metadata distinct. A Unity ProductVersion revision is retained in evidence/build identity rather than discarded. |
| `ProjectEnrollmentTypes.ts`, `ProjectIdentity.ts` | Define enrollment facts/blockers, canonical physical roots and filesystem identity. Guard Windows streams/device names/trailing aliases, junction escapes, metadata byte limits and lossless UTF-8 decoding. Raw bytes, including BOM/CRLF, supply descriptor hashes. |
| `ProjectFactsReader.ts` | Read Godot configuration/addon/.NET metadata, Unity project/package/lock metadata, Unreal project associations/plugins/modules, and MZ marker/core/plugin metadata statically. No project scripts or plugins execute. Unknown facts remain explicit; inferred language labels carry their source/confidence and await G01.3 source classification. |
| `src/core/native-runtime/GameRuntimeCandidates.ts`, `ProjectRuntimeCatalog.ts` | Extend the existing host discovery with multiple installation candidates and Unreal registry association mappings. Deduplicate canonical executable aliases; hash the executable before/after inspection. Godot receives fixed `--version` arguments. Unity/Unreal file-version resources use a fixed PowerShell metadata expression with the path in an environment value. No API-supplied executable path or arbitrary command runs. |
| `ProjectProfileResolver.ts` | Match exact observed runtimes, preserve missing/ambiguous/wrong-build blockers, and derive a reusable target from compatibility facets. Project roots, owners, IDs and mutable descriptor snapshot hashes do not enter the target ID. Local/unlocked Unity packages and missing Godot .NET requirements cannot become resolved targets. |
| `GameProjectStore.ts`, `GameProjectRegistry.ts` | Persist owner/tenant-scoped records; verify stored profile integrity and live root/configuration/runtime freshness. Refresh uses a single compare-and-swap SQL update with the expected revision. Moved roots require explicit enrollment at the new location; an in-place replacement cannot inherit an old record. |
| `src/core/database/GameProjectMigrations.ts`, `Database.ts` | Add the enrollment table/index through the application's existing transactional SQLite startup migration batch. No independent database or migration service was installed. |
| `src/core/initialization/ServiceInitializer.ts`, `src/server/routeManifest.ts` | Construct the store from the existing application Database service and pass it to the real Game Studio route factory. Preserve pre-existing initializer/manifest changes. |
| `src/server/routes/game-studio/projectEnrollmentRoutes.ts`, `gameStudioRoutes.ts` | Expose runtime inventory, enrollment, list/read and revision-checked refresh. Use `req.user.userId` and the server's fixed local tenant; ignore body owner/tenant/profile/executable fields. Reject enrolled IDs on the old engine-only connect path until G01.2 can isolate their sessions. |
| Five new project/enrollment test suites | Exercise the parsers, host inspection boundary, persistent registry, profile resolution and real production router. See the exact test paths below. |
| `scripts/native/verify-project-enrollment.ts` | Reproduce native Godot version observation, actual HTTP enrollment and SQLite/server restart with disposable synthetic projects. Also inspect available Unity/Unreal version resources without launching those editors. |
| `docs/implementation/GAME_DEVELOPMENT_STATUS.md`, `docs/architecture/large-file-register.md` | Record phase boundaries and current deterministic line counts. The register retains the earlier campaign/RAG/G00 counts and adds the current database/initializer counts. |

The production API callers are:

```text
GET  /api/game-studio/runtimes?engine=godot
POST /api/game-studio/projects
GET  /api/game-studio/projects
GET  /api/game-studio/projects/:id
POST /api/game-studio/projects/:id/refresh
```

Enrollment accepts `projectRoot`, `engine`, and optional `selectedRuntimeId`,
`expectedVersion`, `expectedBuildDigest`. Refresh additionally requires `expectedRevision`.
Runtime IDs come from the host inventory. A blocked enrollment is retained with concrete
requirements; it does not acquire execution authority. List summaries explicitly say
`freshness: not_checked`; full profile reads perform freshness checks. Existing route
manifest authentication, developer privilege and local-only deployment guards remain.

## Validation and retained evidence

Environment: Windows x64, Node 24.14.1, npm 11.12.1, TypeScript 5.9.3, Jest 30.5.2.
All commands ran at `G:\dev\Chatbot`. `.txt` outputs are byte-identical retained copies
of console `.log` files, which this repository ignores.

| Command | Outcome | Output |
|---|---|---|
| `npx jest --runInBand --runTestsByPath src/core/gaming/godot/GodotTransactionManager.test.ts src/server/routes/__tests__/game-studio-routes.test.ts src/core/native-runtime/__tests__/RuntimeDiscovery.test.ts src/core/coding/integrations/AutomaticContext.test.ts src/core/coding/security/ApprovedRepositoryGateway.test.ts` | Baseline: 60 passed, five suites. No pre-existing failure in this scope. | [baseline-tests.txt](baseline-tests.txt) |
| `npm run type-check:server` before editing application wiring | Passed. | [baseline-type-server.txt](baseline-type-server.txt) |
| `npx jest --runInBand --testPathPatterns='src/core/gaming\|src/core/agents/gamedev\|src/core/native-runtime/__tests__/RuntimeDiscovery.test\|src/core/native-runtime/__tests__/NativeGameEditorBackends\|game-studio-routes\|project-enrollment-routes\|native-adapter-fail-closed-routes\|feature-expansion-routes\|release-security\|src/server/routeManifest.test\|src/core/coding/integrations/CodingToolsService.test\|src/core/database/Database.test\|src/core/initialization/ServiceInitializer.test'` | **276 passed, 25 suites.** One existing optional PostgreSQL/pgvector integration test skipped because `POSTGRES_VECTOR_TEST_URL` is not configured. Escaped pipes in this Markdown table represent ordinary `|` characters in the quoted shell argument. | [final-tests.txt](final-tests.txt) |
| `npm run type-check:server` | Passed after final source changes. | [type-server.txt](type-server.txt) |
| `npm run type-check:tests` | Passed after final source changes. | [type-tests.txt](type-tests.txt) |
| `npm run lint:server` | Passed after final source changes. | [lint-server.txt](lint-server.txt) |
| `node scripts/release/check-file-size.mjs --write-register` then `npm run check:file-size` | Passed; no new production module exceeds 300 lines. | [file-size.txt](file-size.txt) |
| `npx tsx scripts/native/verify-project-enrollment.ts` | **Seven real enrollment gates passed**, through HTTP and a real SQLite/server restart. | [native-enrollment.txt](native-enrollment.txt), [full native record](native-enrollment.json) |
| `git diff --check` plus initial/G00 hash comparison | Passed; only intentional existing integration/status/register changes differ. | [preservation-and-diff.txt](preservation-and-diff.txt) |

The five new test suites are `src/core/gaming/project/EngineVersions.test.ts`,
`ProjectRuntimeCatalog.test.ts`, `GameProjectRegistry.test.ts`,
`ProjectProfileResolver.test.ts`, and
`src/server/routes/__tests__/project-enrollment-routes.test.ts`.

They cover exact suffix/build identity, incomplete/nonzero/changed runtime probes,
duplicate installations, host GUID mappings, wrong versions, owner/tenant isolation,
client identity/path spoofing, common targets across distinct physical projects,
descriptor additions/changes, byte/encoding limits, root moves/replacements, Windows
case aliases and junctions, stale executable hashes, stored-body corruption, revision
conflicts, concurrent refresh, static MZ parsing and fail-closed unavailable stores.
The broader run retains G00 security/mutation/evidence coverage and existing coding,
route-manifest, initialization and migration tests.

During development, a store property was initially inserted into the wrong initializer
object; the type check caught it and it was corrected. ESLint also caught the reference
code's control-character regexes; a shared character-code check preserves those guards.
The actual Unity resource exposed its vendor revision format, which was added with a
regression test and retained full evidence. These were intermediate issues, not baseline
failures; the final commands above pass.

## Observed native identities and limits

The native probe observed Godot
`C:\Users\dferr\bin\godot-v4.7.1\Godot_v4.7.1-stable_win64_console.exe`, version
`4.7.1.stable.official.a13da4feb`. Its actual byte hash, run evidence, separate physical
IDs/profile digests, shared target ID, wrong-version blocker, restart result and stale
descriptor/refresh outcomes are retained in `native-enrollment.json`.

Unity's inspected executable is
`C:\Program Files\Unity\Hub\Editor\6000.4.5f1\Editor\Unity.exe`; its actual ProductVersion
is `6000.4.5f1_cc83ebd631f8`. The release suffix and full build-resource identity are
retained. This was metadata inspection, not a Unity project import/build/play test.

The discovered Unreal executable cannot be enrolled exactly because
`C:\Program Files\Epic Games\UE_5.7\Engine\Build\Build.version` does not exist. The
inventory records the failure and does not invent a version from its folder or switch
to another installation. A complete matching build record/installation is the prerequisite.

The HTTP probe injects a synthetic trusted principal into a loopback-only fixture;
it does not claim a new JWT certification. The regular authentication/route-security
tests run separately. No user game or licensed editor was started, changed or migrated.
No rendering, checkpoint/death/respawn behavior, export or corpus retrieval ran.

## Database, rollback and remaining work

The additive SQLite migration creates `game_enrolled_projects` and
`idx_game_projects_owner`. It retains canonical/physical identity, profile JSON/digest,
owner/tenant, revision and timestamps. The application uses its existing transactional
startup migration mechanism; no parallel ledger/store was introduced. No live user
database was edited or application restarted during this task. The table will be created
when the updated application next initializes its database.

The real SQLite tests reopen saved profiles, add the migration to a restored
representative pre-G01 database containing an existing RAG source, verify integrity and
prior-row preservation, and verify that the untouched backup remains usable without
the enrollment table. Updates use an atomic revision comparison. A failed or stale
refresh leaves the previous record intact; no game files are written by these APIs.
Reverting application code can leave the additive table unused; restoring a verified
backup remains the data rollback path. This is not durable game-run or apply recovery.

PostgreSQL enrollment intentionally returns unavailable until its migration/store path
is qualified. Godot C# profiles remain blocked without a matching mono runtime and
enrolled .NET SDK/framework. MZ metadata is static/read-only; its native runtime adapter
remains unqualified. Replacing a root in place is a hard identity conflict; it cannot
adopt the old record implicitly. Lifecycle/retirement UI is not supplied by this slice.

Next smallest executable gate: **G01.2** project/owner/runtime-scoped engine sessions,
using these identities and a shared physical-project mutation boundary. Then complete
G01.3 roles/dependency context before moving to G02 corpus snapshots and G03 retrieval
into drafting. The legacy engine-only session mechanism has not been promoted to the
new enrolled workflow. Full release, client/browser, package, PostgreSQL and additional
engine-native qualification gates were not run.
