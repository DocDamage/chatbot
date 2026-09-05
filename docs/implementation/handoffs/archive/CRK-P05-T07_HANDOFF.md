# AI Chatbot Hub — Implementation Handoff (Archive)

## Status

- Repository: `DocDamage/chatbot`
- Branch: `codex/cf04-cf10-integration`
- Active Program: Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- Task Completed: `CRK-P05-T07` — Context Planner Matrix & Phase 05 Exit Gate (`VERIFIED & CERTIFIED`)
- Base Commit: `178224d`
- Exit Gate Evidence: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P05/CRK-P05-T07/2026-09-04_178224d/`

---

## Deliverables Summary

1. **ContextPlan Schema (CRK-P05-T01)**:
   - `src/types/context-plan.ts` (100 lines)
   - 7 canonical requirement types (`conversation`, `variables`, `memory`, `project`, `knowledge`, `tool`, `none`).
   - Unit tests: `src/types/context-plan.test.ts` (3/3 passed).

2. **Deterministic Routing Features (CRK-P05-T02)**:
   - `src/core/chat/ContextRoutingSignals.ts` (145 lines)
   - Multi-dimensional signal extraction across requests, active plan, variables, languages, frameworks, freshness, repo context, and explicit search directives.

3. **Bounded Context Classifier (CRK-P05-T03)**:
   - `src/core/chat/ContextClassifier.ts` (56 lines)
   - Bounded classifier (1500ms timeout, safe fallback, zero tool execution).

4. **Explicit No-Retrieval Path & Core Context Planner (CRK-P05-T04)**:
   - `src/core/chat/ChatContextPlanner.ts` (198 lines)
   - Intentionally selects no RAG for creative writing, greetings, brainstorming, rewriting, sufficient attachments, or user restrictions.

5. **Project Context Planning (CRK-P05-T05)**:
   - `src/core/chat/ProjectContextPlanner.ts` (60 lines)
   - Structural repo planning: instructions, manifests, symbols, diagnostics, tests.

6. **Context Plan Observability (CRK-P05-T06)**:
   - `src/core/chat/ContextPlanDiagnostics.ts` (46 lines)
   - Privacy-preserving structured diagnostics and token budget recording.

7. **Context Planner Matrix & Exit Gate (CRK-P05-T07)**:
   - `src/core/chat/__tests__/context-planner-matrix.test.ts` (186 lines)
   - 9/9 matrix scenarios passing. Integrated into `ChatRuntimeFactory.ts`.
