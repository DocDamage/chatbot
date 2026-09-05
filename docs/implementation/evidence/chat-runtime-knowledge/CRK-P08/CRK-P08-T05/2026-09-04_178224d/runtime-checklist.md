# Runtime Task Checklist — CRK-P08-T05: Knowledge Router Exit Gate

## Phase 08 Definition of Done & Exit Gate (§1859-1865)

### Implementation
- [x] 15 canonical routing domains defined (`src/types/knowledge-router.ts`).
- [x] User knowledge overrides schema with `auto`, `includePacks`, `excludePacks`, and `noOnline` (`src/types/knowledge-router.ts`).
- [x] KnowledgeRouter engine with domain-to-pack policies (`src/core/knowledge/KnowledgeRouter.ts`).
- [x] Pack readiness handled gracefully without crashing (`src/core/knowledge/KnowledgeRouter.ts`).
- [x] User `noOnline` preference strictly blocks online fallback (`src/core/knowledge/KnowledgeRouter.ts`).
- [x] Telemetry recorded on every routing evaluation (`src/core/knowledge/KnowledgeRouter.ts`).
- [x] Source-size rule satisfied (all files <= 200 lines, strictly under 300-line ceiling).

### Tests & Verification
- [x] Coding queries do not search Wikipedia or general-knowledge by default (§1861).
- [x] General questions do not search code corpora by default (§1862).
- [x] Pack routing is testable, observable, and records telemetry (§1863).
- [x] User no-online preference is strictly respected (§1864).
- [x] Pack readiness handles missing/disabled packs gracefully without crashing (§1840-1848).
- [x] User overrides customize pack selection while preserving valid packs (§1825-1839).
- [x] Full type check (`npm run type-check`: 0 errors).
- [x] Linter (`npm run lint:server`: 0 warnings/errors).
