# AI Chatbot Hub — Implementation Handoff (Archive)

## Status

- Repository: `DocDamage/chatbot`
- Branch: `codex/cf04-cf10-integration`
- Active Program: Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- Task Completed: `CRK-P23-T05` — Chat Diagnostics Exit Gate (`VERIFIED & CERTIFIED`)
- Base Commit: `178224d`
- Exit Gate Evidence: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P23/CRK-P23-T05/2026-09-04_178224d/`

---

## Deliverables Summary

1. **Diagnostics & Run Record Schemas (CRK-P23-T01, T02, T05)**:
   - `src/types/chat-diagnostics.ts` (81 lines)
   - Zod schemas for `ChatRunRecord`, `StageTimings`, `FailureTaxonomyCode`.
   - Unit tests: `src/types/chat-diagnostics.test.ts` (2/2 passed).

2. **Database Migrations for Chat Runs (CRK-P23-T01, §29.3)**:
   - `src/core/database/DatasetMigrations.ts`
   - Added tables: `chat_runs`, `chat_run_sources`, `chat_run_tools` supporting SQLite and PostgreSQL.

3. **Chat Run Repository & Privacy Sanitization (CRK-P23-T01, §3433)**:
   - `src/core/diagnostics/ChatRunRepository.ts` (77 lines)
   - Persists sanitized records. Strictly strips passwords, authorization tokens, API keys, and internal chain-of-thought traces.

4. **Chat Diagnostics Service & Failure Taxonomy (CRK-P23-T01, T02, T05)**:
   - `src/core/diagnostics/ChatDiagnosticsService.ts` (124 lines)
   - Tracks stage latencies (`normalizeMs`, `retrievalMs`, `generationMs`, etc.).
   - Classifies errors into 14 normalized failure taxonomy codes (`MODEL_RATE_LIMITED`, `GROUNDING_INSUFFICIENT`, etc.).

5. **Developer Diagnostics REST Route (CRK-P23-T03, §30.6, §30.7)**:
   - `src/server/routes/chat-diagnostics.ts` (64 lines)
   - `GET /api/debug/chat-runs/:requestId` with developer/admin role gating, ownership verification, and audit logging.

6. **Diagnostics UI Modal (CRK-P23-T04)**:
   - `client/src/components/ChatDiagnosticsModal.tsx` (116 lines), `.css` (134 lines).
   - Shows status, failure reasons, model/fallback route, stage timing waterfall, and validation codes.
   - Vitest component test: `client/src/components/ChatDiagnosticsModal.test.tsx` (1/1 passed).

7. **Phase 23 Exit Gate Suite**:
   - `src/core/diagnostics/__tests__/chat-diagnostics.test.ts` (4/4 passed).
