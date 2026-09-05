# Runtime Task Checklist — CRK-P07-T07: Official Documentation Pack Exit Gate

## Phase 07 Definition of Done & Exit Gate (§1749-1755)

### Implementation
- [x] Official documentation schemas defined (`src/types/official-docs.ts`).
- [x] Documentation source policy prioritizes official technical authority at 0.95 (`src/core/knowledge/DocumentationSourcePolicy.ts`).
- [x] Semantic chunker chunks by `product -> version -> page -> heading -> subsection -> code/example` without splitting signatures from parameter descriptions (`src/core/knowledge/DocumentationChunker.ts`).
- [x] Version indexing and compatibility querying (`src/core/knowledge/DocumentationVersionIndex.ts`).
- [x] Incremental documentation refresh pipeline skips unchanged pages and re-chunks only modified content (`src/core/knowledge/DocumentationRefreshService.ts`).
- [x] Official documentation pack service manages manifests, ingestion strategies, and search retrieval (`src/core/knowledge/OfficialDocumentationPack.ts`).
- [x] All production files strictly below 200 lines (comfortably below 300-line ceiling).

### Tests & Verification
- [x] Priority language and framework docs are installable (`typescript`, `python`, `godot`, `react`, `postgresql`).
- [x] Version metadata survives ingestion and distinguishes versions (Godot 3 vs Godot 4).
- [x] Version discrimination for React (hooks vs class components) and Python match statements.
- [x] Current official docs outrank older third-party content (0.95 > 0.78 / 0.58).
- [x] Refresh pipeline skips unchanged pages via content hashing.
- [x] Full type check (`npm run type-check`: 0 errors).
- [x] Linter (`npm run lint:server`: 0 warnings/errors).
