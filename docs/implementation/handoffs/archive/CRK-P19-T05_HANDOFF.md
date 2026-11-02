# AI Chatbot Hub — Implementation Handoff (Archive)

## Status

- Repository: `DocDamage/chatbot`
- Branch: `codex/cf04-cf10-integration`
- Active Program: Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- Task Completed: `CRK-P19-T05` — General Knowledge Pack: Wikipedia + Wikidata Exit Gate (`VERIFIED & CERTIFIED`)
- Base Commit: `178224d`
- Exit Gate Evidence: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P19/CRK-P19-T05/2026-09-04_178224d/`

---

## Deliverables Summary

1. **General Knowledge Schemas (CRK-P19-T01, T02, T03, T05)**:
   - `src/types/general-knowledge.ts` (127 lines)
   - Typed Zod schemas for `WikipediaSectionChunk`, `WikipediaArticle`, `WikidataEntity`, `WikidataClaim`, `EntityLinkResult`, and `GeneralKnowledgeSnapshot`.
   - Unit tests: `src/types/general-knowledge.test.ts` (3/3 passed).

2. **Wikipedia Ingestion & Chunker (CRK-P19-T01)**:
   - `src/core/knowledge/WikipediaChunker.ts` (143 lines)
   - Implements structural hierarchy: article -> lead -> heading -> subsection.
   - Cleans noise: strips infoboxes, wikitables, templates (`{{...}}`), navigation anchors, category tags, `[edit]` markers, and citation footnote tags (`[1]`).
   - Preserves title, section anchor, revision ID, source URL, canonical title, and word count.

3. **Wikidata Structured Store (CRK-P19-T02)**:
   - `src/core/knowledge/WikidataStructuredStore.ts` (124 lines)
   - Ingests structured entity IDs (`Q...`), labels, aliases, property claims (`P...`), and maps `instanceOf` (`P31`) and `subclassOf` (`P279`) directly into `KnowledgeGraph` without bloating into redundant vector prose (§3093-3105).

4. **Entity Linking Service (CRK-P19-T03)**:
   - `src/core/knowledge/EntityLinkingService.ts` (112 lines)
   - Links Wikipedia mentions and section chunks to Wikidata entities with conservative thresholding (default 0.85) to prevent irreversible merges from low-confidence matches (§3106-3111).

5. **General Knowledge Pack (CRK-P19-T04 & T05)**:
   - `src/core/knowledge/GeneralKnowledgePack.ts` (120 lines)
   - Manages independently installable general knowledge pack (ID: `general-knowledge`, authority 0.67: `SourceAuthorityTier.ENCYCLOPEDIA`).
   - Supports search with lead-paragraph boost, title matching, and enabling/disabling (§3128).

6. **Domain Segregation & Exit Gate (CRK-P19-T04, T05 & Phase 19 Exit Gate)**:
   - Verified that `KnowledgeRouter` isolates coding domains (`coding`, `coding_debug`, `repository`) to official docs, curated code, and developer Q&A, strictly excluding `general-knowledge` chunks by default (§3120).
   - Test suite: `src/core/knowledge/__tests__/general-knowledge-pack.test.ts` (7/7 passed).
