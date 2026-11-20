# Validation record

## Executed checks

The reference kit was checked independently of the application checkout. All listed automated checks completed successfully. The included logs record the actual test names and results.

| Check | Result | Evidence |
|---|---|---|
| Strict TypeScript compilation | Passed with TypeScript 5.7.3, ES2022/CommonJS, Node type definitions 22.10.2 | Build step in `validation/node-tests.txt` |
| Common/project contracts | 20 tests passed | `tests/project`, combined Node log |
| Knowledge contracts | 30 tests passed | `tests/knowledge`, combined Node log |
| Engine contracts and evidence | 28 tests passed | `tests/engine`, combined Node log |
| ROM identity/edit/patch contracts | 31 tests passed | `tests/rom`, combined Node log |
| Combined Node suite | **109 passed; 0 failed, cancelled, skipped or todo** | `validation/node-tests.txt` |
| SQLite run/lease/ownership schema | **7 checks passed** | `validation/sql-tests.txt`, `scripts/test_run_sql.py` |
| SQLite snapshot lifecycle/scoped retrieval | **11 checks passed** | `validation/sql-tests.txt`, `scripts/test_knowledge_sql.py` |

Executed commands for the final assembled kit were `npm ci --ignore-scripts --no-audit --no-fund`, `npm test` (which includes a strict build), and `npm run test:sql`. The SQL command was captured again to retain complete output from both suites. No application dependencies were installed or changed for these checks.

Environment: Node **24.22.1**, TypeScript **5.7.3**, `@types/node` **22.10.2**, Python **3.12.14**, SQLite **3.53.1**, Linux **6.18.57 x86_64**, glibc **2.39**. These results do not imply validation on Windows or on every Node version allowed by the package manifest.

## What the tests establish

The TypeScript suite exercises the actual supplied modules. It covers canonical digests, immutable proposals, exact runtime/build selection, Windows-style lexical path cases, scoped knowledge eligibility, Unicode boundaries, embedding-space separation, bounded/deterministic rank fusion, authority and expiry checks, state transitions, fresh verification bindings, boolean existence and numeric-tolerance comparisons, exact ROM identity, explicit address maps, checked edits, cancellation, and deterministic fresh patch reapplication.

The SQLite suites execute the shipped DDL and retrieval query in temporary disk databases. They cover owner/project foreign keys, transaction/revision conflicts, lease fences, artifact/proposal ownership, immutable snapshot membership, active-head compare-and-swap, rollback on failed activation, FTS freshness, restart persistence, and filtering before the result limit. Knowledge tests declare minimal synthetic parent tables representing the existing document/dataset relationships; they are not a full migration test against the complete application database. Integration must also use a representative existing database and the real store adapters.

ROM tests use synthetic byte buffers. The injected codec in those unit tests is explicitly a test double; it is not BPS or IPS. These tests validate the wrapper's contract and byte comparisons, not a real codec or proprietary game build.

## Not executed here

- Application type/lint/Jest suites or production route integration.
- Full application migration, PostgreSQL or pgvector integration, real corpus acquisition, or actual embedding/model-provider calls.
- Windows filesystem/junction/process-tree tests or engine licensing/toolchain availability checks.
- Godot parser/import/runtime qualification, Unity editor/build/play tests, Unreal native asset or gameplay tests, RPG Maker MZ test play, or exports.
- An actual ROM baseline build, BPS/IPS codec integration, emulator scenario, or disc-image rebuild.

`native/godot_scenario_probe.gd` is reference GDScript reviewed against version-specific APIs. Its mandatory native qualification matrix is in `native/QUALIFICATION.md`; it remains unqualified until those tests run on the enrolled executable. A reported observation is not an accepted behavior assertion until the host compares it with the unchanged expected result.

The app repository was inspected at commit `c26d767345bd65e5192ed99e1213f8a1a0a7b110` and left unchanged. This kit is a tested starting point and implementation specification, not a completed application feature.
