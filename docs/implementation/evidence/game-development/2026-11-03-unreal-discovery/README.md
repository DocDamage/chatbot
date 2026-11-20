# Unreal discovery correction — November 3, 2026

G01.1 follow-up: the earlier missing `Build.version` report referred to the stale
`C:\Program Files\Epic Games\UE_5.7` candidate. The usable newer installation is outside
that old search root. No reinstall, engine-file edit, environment override or project
migration was needed.

## Verified installations

| Location | Installed identity | Evidence |
|---|---|---|
| `C:\Program Files\UE_5.8` | **5.8.4**, changelist **58902052**, branch `++UE5+Release-5.8` | Its executable resource is `++UE5+Release-5.8-CL-58902052`; full `Build.version`, both byte hashes and a resolved HTTP fixture profile are retained in [native-enrollment.json](native-enrollment.json). |
| `I:\Epic Games` | **5.7.4**, changelist **51494982**, branch `++UE5+Release-5.7` | Separately inspected executable/build metadata and separately resolved fixture profile in the same native record. |

The Launcher location record still labels the C: installation `5.8.3-58210709...`.
[launcher-records.json](launcher-records.json) retains the engine-only record. It is a
location hint, not exact installed version evidence. The follow-up observed the current
installed files as 5.8.4; it does not claim that 5.8.3 remains a separate installation.
The incomplete old C: 5.7 directory remains a diagnostic candidate and cannot acquire
an exact profile. The normal discovered default is now the verified C: 5.8 installation.

## Changes and production callers

- New `src/core/native-runtime/EpicUnrealInstallations.ts` reads bounded Epic Launcher
  registration data and inspects known library roots on ready fixed Windows drives.
  It accepts an engine located directly at an Epic library root, as well as immediate
  `UE_*` children, without recursively searching projects, source trees or asset vaults.
  The fixed read-only drive query is bounded/cached; no arbitrary command is accepted.
- `RuntimeDiscovery.ts` now includes those installations and ranks unconfigured defaults
  using installed build metadata. Explicit existing `UNREAL_EDITOR_PATH` overrides retain
  precedence. `GameRuntimeCandidates.ts` exposes all discovered installations as separate
  runtime choices to the G01 catalog. No enrolled project's runtime is silently migrated.
- `EngineVersions.ts` and `ProjectRuntimeCatalog.ts` now cross-check Unreal's actual
  branch/changelist ProductVersion resource against full `Build.version` metadata. The
  previous release-prefix assumption rejected Unreal's genuine resource format. A wrong
  branch, changelist or release still fails; a release number alone is insufficient.
- `EpicUnrealInstallations.test.ts`, `EngineVersions.test.ts` and
  `ProjectRuntimeCatalog.test.ts` cover custom locations, separate installations,
  marketplace exclusion, malformed/oversized registrations, bounded library inspection,
  misleading folder names and executable/build mismatches. The old synthetic resource
  fixture was corrected to the real branch/changelist shape.
- `scripts/native/verify-project-enrollment.ts` also enrolls each independently inspected
  Unreal runtime into a synthetic project via the real HTTP route, then reads its profile
  again with freshness validation. Runtime discovery/enrollment code is used by the real
  Game Studio route factory and by the existing native backend inventory.

The game-development status and large-file register were refreshed. Existing campaign,
client, RAG, G00 integrity/evidence code and database migration behavior were preserved.
This follow-up makes no schema or dependency change.

## Validation

Windows x64, Node 24.14.1, TypeScript 5.9.3, Jest 30.5.2. Commands ran at
`G:\dev\Chatbot`. `.txt` files retain the corresponding ignored `.log` output.

| Command | Outcome | Output |
|---|---|---|
| `npx jest --runInBand --runTestsByPath src/core/native-runtime/__tests__/EpicUnrealInstallations.test.ts src/core/native-runtime/__tests__/RuntimeDiscovery.test.ts src/core/gaming/project/EngineVersions.test.ts src/core/gaming/project/ProjectRuntimeCatalog.test.ts` | 37 passed, four suites. | [focused-tests.txt](focused-tests.txt) |
| `npx jest --runInBand --testPathPatterns='src/core/gaming\|src/core/agents/gamedev\|src/core/native-runtime/__tests__/RuntimeDiscovery.test\|src/core/native-runtime/__tests__/EpicUnrealInstallations\|src/core/native-runtime/__tests__/NativeGameEditorBackends\|game-studio-routes\|project-enrollment-routes\|native-adapter-fail-closed-routes\|feature-expansion-routes\|release-security\|src/server/routeManifest.test\|src/core/coding/integrations/CodingToolsService.test\|src/core/database/Database.test\|src/core/initialization/ServiceInitializer.test'` | **284 passed, 26 suites**; one existing optional PostgreSQL test skipped. Escaped table pipes represent ordinary `|` characters in the quoted shell argument. | [final-tests.txt](final-tests.txt) |
| `npm run type-check:server` | Passed. | [type-server.txt](type-server.txt) |
| `npm run type-check:tests` | Passed. | [type-tests.txt](type-tests.txt) |
| `npm run lint:server` | Passed. | [lint-server.txt](lint-server.txt) |
| `node scripts/release/check-file-size.mjs --write-register` then `npm run check:file-size` | Passed; 95 pre-existing registered large modules, no new oversized module. | [file-size.txt](file-size.txt) |
| `npx tsx scripts/native/verify-project-enrollment.ts docs/implementation/evidence/game-development/2026-11-03-unreal-discovery/native-enrollment.json` | **Eight native enrollment gates passed**, including actual Godot version observation/HTTP/SQLite restart and resolved Unreal metadata profiles for both discovered complete installations. | [native-enrollment.txt](native-enrollment.txt), [full record](native-enrollment.json) |
| `git diff --check` and scoped preservation/hash checks | Passed. | [verification.json](verification.json) |

The first check was started while the resource-validator change was being applied; its
old fixture then failed the new stricter resource check. It was not a pre-existing test
failure. The fixture was corrected, the focused check passed, and the full final run above
passed. Historical G01 evidence is retained separately.

No licensed editor, project import, build, gameplay scenario or export was launched.
The native editor checks read version resources/build metadata and hash files. Synthetic
HTTP fixtures are not user games. No live application restart or database edit was
initiated. No additional location information is required for the identified 5.8.4 build.

Next gate remains **G01.2 project-scoped engine sessions**, then G01.3 file roles/context.
Verified runtime identity does not by itself qualify Unreal project editing or gameplay.
