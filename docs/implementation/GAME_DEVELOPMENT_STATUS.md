# Game-development implementation status

Updated: 2026-11-03 (America/New_York)

## Current checkpoint: G01.3 file roles and dependency context

G01.3 now provides authenticated, enrollment-scoped file discovery, text search and
read-only source context under `/api/game-studio/projects/:id`. Shared policy decisions
cover gateway discovery/reads/search, ToolWorkspace snapshots, AutomaticContext and
write preflight. Godot text scenes/resources, MZ structured database/plugin data,
Unity metadata, Unreal module `Private` implementations and ROM assembly sources have
explicit roles. Credential paths, generated caches, native assets and ROM bytes cannot
enter generic text capture/editing. Runtime-blocked MZ enrollment can provide static
source context without claiming native execution. ROM source policy is available via
trusted service injection; ROM enrollment/execution remain later work.

Static providers follow Godot resource/UID/load links, MZ ordered plugins and known
database IDs, assembly includes, unique Unreal headers and bounded Unity GUID metadata.
Dynamic, ambiguous and missing references remain explicit. The existing 12-file / 16 KB
capture cap remains, with named omissions and exact original-byte hashes. Context
digests bind owner/project/profile and captured sources. Profile/source drift rejects
the result, and session apply/rollback recheck roles and links after approval.

Validation: **523 tests passed across 75 suites**, with one existing optional PostgreSQL
integration test skipped. Server/test type checks, lint and file-size checks passed.
Eleven real HTTP/SQLite source-context gates passed, including restart reproducibility,
using observed Godot **4.7.1.stable.official.a13da4feb** identity. The twelve real native
Godot session gates also passed again. The context/coding-route tests use synthetic
projects and a stubbed model adapter; they do not certify generation, gameplay, MZ,
Unity/Unreal native edits or ROM tools. No schema, dependency or installed-engine
change was needed. See the [G01.3 report](evidence/game-development/2026-11-03-g01-context/README.md).

**Next executable gate: G02.1 immutable source snapshots and source manifest parsing.**
Corpus acquisition/retrieval, durable jobs and the first real checkpoint workflow
remain G02–G05 work.

## Retained G01.2 project-scoped engine sessions

G01.2 now connects an enrolled `projectId` to a private engine bridge/adapter and
returns an explicit `sessionId`. Every engine operation requires that session and
the authenticated owner. Exact profile revision, physical root and runtime identity
are checked before and after work. Physical-project locks cover sessions, owners,
path aliases and profile refresh within the server process. Approvals, transactions
and fresh native evidence are bound to the session; raw root/version/body identity
fields cannot redirect it. Configuration edits invalidate the session and require
profile refresh plus reconnection. Rollback rechecks live paths before restoring.

Validation: **297 tests passed across 28 suites**, with one existing optional
PostgreSQL integration test skipped. Server/test type checks and server lint passed.
Real Godot **4.7.1.stable.official.a13da4feb** passed twelve HTTP/native session gates
on two disposable projects, including concurrent distinct scene observations,
independent source writes, owner/grant/rollback isolation and a SQLite/server restart.
Enrollment survives restart; sessions and approvals must be recreated. No new schema,
dependency or installed-engine change was needed in this slice. Locks and transaction
recovery remain process-local; durable orchestration/recovery is G04. These observations
do not qualify checkpoint/death/respawn gameplay, rendering or export. Unity/Unreal
native execution was not run in this slice. See the [G01.2 report and evidence](evidence/game-development/2026-11-03-g01-sessions/README.md).

The G01.3 context gate is now covered above. G02–G05 remain necessary for the first
real Godot checkpoint workflow; engine-specific native qualification limits still apply.

## Retained G01.1 enrollment and runtime discovery

G01.1 is implemented through authenticated Game Studio runtime inventory, project
enrollment, profile inspection and revision-checked refresh APIs. The existing SQLite
database now has an additive owner/tenant-scoped enrollment table and index. Physical
project identity, observed configuration digest and reusable knowledge target remain
separate. Profile reads reject changed roots, configuration bytes and executable/build
metadata; missing or ambiguous runtime identities remain blocked.

Validation: 276 tests passed across 25 suites; the existing optional PostgreSQL integration
test was skipped. Server/test type checks, server lint and file-size checks passed.
Seven real Godot 4.7.1 enrollment gates passed through HTTP, including an actual
server/database restart. Unity 6000.4.5f1 and its `cc83ebd631f8` file-resource build
revision were observed without launching the editor. The initial Unreal discovery blocker
was resolved in the [installation discovery follow-up](evidence/game-development/2026-11-03-unreal-discovery/README.md):
the current engine at `C:\Program Files\UE_5.8` is **5.8.4, changelist 58902052**, and
`I:\Epic Games` contains a separate **5.7.4** installation. Epic Launcher's stale 5.8.3
label is used only to find the directory; installed binary/build metadata establishes
the identity. Both exact runtime fixture profiles enrolled successfully without launching
an editor. The follow-up passed 284 tests across 26 suites (one optional PostgreSQL test skipped),
type/lint/file-size checks and eight native enrollment gates. See the original
[G01.1 report and evidence](evidence/game-development/2026-11-03-g01/README.md).

Enrollment resolution establishes recorded runtime identity, not build/play capability.
The legacy engine-only connect path has now been replaced by the G01.2 session flow
above. MZ native enrollment, Godot C# SDK enrollment and PostgreSQL enrollment remain
explicitly unresolved/unqualified.

## Retained G00 checkpoint

G00.1–G00.4 are implemented in the existing application. The production Game Studio
proposal/approval/apply routes now use canonical nested proposal integrity, server-owned
approval state, exact input byte hashes and complete-batch capability checks. Generic
file mutation cannot interpret `remove_node` as deleting a scene, and native binary
formats cannot enter UTF-8 replacement/rollback paths.

Game Studio runtime checks now require nonempty, complete observations. Native reports
bind a fresh run, request digest, engine, project root and requested scene, and the host
compares observations with the original expected values. Nonzero process exits cannot
pass. Reports distinguish scene observations from editor inspection; the advisory
GameDevGeniusAgent no longer marks prose as verified based on keywords.

Validation: 205 engine/route/security/source-editing tests passed across 17 suites; server/test type checks, server lint,
file-size policy and eight metadata checks passed. A real Godot 4.7.1 executable passed
five isolated headless scene-observation gates. Source-editing/route-manifest checks and
the exact command record are in the [G00 evidence](evidence/game-development/2026-11-03-g00/README.md).
These checks do not establish checkpoint/death/respawn gameplay, rendering or export.

At G00, no database migration, new dependency, provider substitution or installation was needed.
Proposal and rollback state remain process-local. Restart durability, crash recovery
and full project snapshot binding remain later gates; cross-project sessions are now
covered by G01.2 above. Existing rollback restores original UTF-8 bytes on caught failures; it is
not a crash journal. Old process-local approvals must be proposed/approved again after
restart or deployment of the new digest format.

Next executable gate: G02.1 immutable source snapshots. G02–G05 remain necessary
before the first real Godot checkpoint workflow can be claimed. Other engines and ROM
engineering are not newly qualified by G00.
