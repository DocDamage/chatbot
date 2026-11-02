# Runtime Task Checklist — CRK-P14-T10: Curated Source-Code Pack Exit Gate

## Phase 14 Definition of Done & Exit Gate (§2666-2674)

### Implementation
- [x] Curated code schemas with 18-language whitelist matching §2506-2525 implemented (`src/types/source-code-pack.ts`).
- [x] File filter rejecting vendor, build, lock, minified, and duplicate content (§2529-2548) implemented (`src/core/knowledge/SourceCodeFileFilter.ts`).
- [x] Generated-code classifier detecting headers and machine markers (§2629-2641) implemented (`src/core/knowledge/SourceCodeFileFilter.ts`).
- [x] Repository quality validation requiring licenses and tests (§2551-2564) implemented (`src/core/knowledge/SourceCodePack.ts`).
- [x] Staged deduplication using normalized SHA-256 and SimHash fingerprinting (§2612-2628) implemented (`src/core/knowledge/SourceCodeDeduplicator.ts`).
- [x] Structural syntax/symbol-aware chunker preserving line-level provenance and relationships (§2566-2610, §2644-2653) implemented (`src/core/knowledge/SourceCodeStructuralChunker.ts`).
- [x] Source-size rule satisfied (all production files <= 134 lines, strictly under 300-line ceiling).

### Tests & Verification
- [x] Structural code indexing extracts classes, functions, interfaces, structs, and imports (§2668).
- [x] Generated, vendor, lock, and duplicate content is strictly controlled (§2669).
- [x] Provenance is complete with repository, commit, path, and license (§2670).
- [x] Coding implementation benchmark succeeds for idiomatic pattern search (§2671).
- [x] No execution occurs merely because code was retrieved (§2672).
- [x] Full type check (`npm run type-check`: 0 errors).
- [x] Linter (`npm run lint:server`: 0 warnings/errors).
