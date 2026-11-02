# Summary — CRK-P15-T05: Citation and Provenance UX Exit Gate

## Phase 15 Deliverables Summary

1. **Structured Citations in Response API (`src/types/citation.ts`, 113 lines)**:
   - `CitationRef` schema with `id`, `sourceId`, `datasetId`, `title`, `sourceUrl`, `path`, `version`, `chunkId`, `quoteStart`, `quoteEnd`, `authority`, `score`.
   - Unit tests: 4/4 passed (`src/types/citation.test.ts`).

2. **Claim/Source Association Service (`src/core/knowledge/ClaimAssociationService.ts`, 136 lines)**:
   - Maps claims in assistant responses to citations, chunk IDs, sources, and dataset versions.
   - Strictly distinguishes verified sentence-level claim bindings from broader response-level source references (§2717) without claiming false sentence-level precision.

3. **Sources Drawer Formatter & Client Component (`src/core/knowledge/SourcesDrawerFormatter.ts`, 114 lines; `client/src/components/SourcesDrawer.tsx`, 83 lines)**:
   - Formats citations into display-ready grouped cards (Official documentation, Repository evidence, Developer Q&A, General knowledge).
   - Renders compact `Sources (N)` drawer with version badges, authority badges, and direct actions (`[Open source]`, `[Open file]`).
   - Unit tests: 3/3 passed (`client/src/components/SourcesDrawer.test.tsx`).

4. **Why-This-Answer Diagnostics Service & Modal (`src/core/chat/WhyThisAnswerService.ts`, 91 lines; `client/src/components/WhyThisAnswerModal.tsx`, 98 lines)**:
   - Aggregates runtime diagnostic traces (intent, task type, pack IDs, candidate count, selected source count, model route, tool status, and policy versions).
   - In accordance with §2758, internal chain-of-thought reasoning, private user tokens, and secret keys are strictly omitted.
   - Unit tests: 1/1 passed (`client/src/components/WhyThisAnswerModal.test.tsx`).

5. **Citation Resolver Service & Exit Gate Suite (`src/core/knowledge/CitationResolverService.ts`, 95 lines)**:
   - Verifies citation targets against registered indexes and paths.
   - Suppresses broken links, logs unresolved IDs, surfaces developer warnings, and verifies grounding sufficiency (§2760-2768).
   - Exit gate test suite: 5/5 passed (`src/core/knowledge/__tests__/citation-provenance-integration.test.ts`).
   - Phase 15 exit gate certified (§2769-2775).
