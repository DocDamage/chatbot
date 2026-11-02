# Runtime Task Checklist — CRK-P06-T08: Phase 06 Exit Gate

## Phase 06 Definition of Done & Exit Gate (§1588-1596)

### Implementation
- [x] Dataset/pack manifests validate (`src/types/knowledge-datasets.ts`, `src/types/knowledge-packs.ts`).
- [x] New tables migrate on SQLite and PostgreSQL (`src/core/database/DatasetMigrations.ts`, `src/core/database/Database.ts`).
- [x] Install/update/remove jobs are resumable and auditable (`src/core/knowledge/DatasetManager.ts`).
- [x] License and resource policies run before ingestion (`src/core/knowledge/DatasetLicensePolicy.ts`, `src/core/knowledge/DatasetStorageQuota.ts`).
- [x] No large external dataset is installed yet (§1594).
- [x] Source-size rule is satisfied (all production files <= 173 lines, strictly below 300-line ceiling).

### Tests
- [x] Dataset manifest schema tests (3/3 passed).
- [x] Knowledge pack schema and 8 canonical packs tests (2/2 passed).
- [x] Comprehensive exit gate integration suite (6/6 passed):
  - Manifest validation & duplicate rejection
  - Migrations syntax for SQLite & PostgreSQL
  - License blacklisting & attribution tracking
  - Quota evaluation on disk reserve exhaustion
  - Job execution, progress, and recovery
  - Pack readiness & cascade disable
  - Initial state verification
- [x] 11/11 unit and integration tests pass across 3 suites.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Full CRK suites pass cleanly (131/131 tests across 25 suites).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P06/CRK-P06-T08/2026-09-04_178224d/`.
