# Runtime Checklist — CRK-P15-T05: Citation and Provenance UX Exit Gate

- [x] Citations are structured data and validate via schema (`src/types/citation.ts`).
- [x] Client renders source metadata via `SourcesDrawerFormatter` and `SourcesDrawer.tsx`.
- [x] Source links resolve to the actual indexed source where available (`CitationResolverService.ts`).
- [x] Diagnostics explain retrieval without revealing hidden reasoning (`WhyThisAnswerService.ts`, §2758).
- [x] Claim/source association links claims without false sentence precision (`ClaimAssociationService.ts`, §2717).
- [x] All production source files strictly under 300 lines.
- [x] Full type-check passing across server, tests, and client.
- [x] Linter passing with zero warnings or errors.
