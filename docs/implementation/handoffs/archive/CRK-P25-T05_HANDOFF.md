# AI Chatbot Hub — Implementation Handoff (Archive)

## Status

- Repository: `DocDamage/chatbot`
- Branch: `codex/cf04-cf10-integration`
- Active Program: Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- Task Completed: `CRK-P25-T05` — Dataset and Policy A/B Evaluation Exit Gate (`VERIFIED & CERTIFIED`)
- Base Commit: `178224d`
- Exit Gate Evidence: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P25/CRK-P25-T05/2026-09-04_178224d/`

---

## Deliverables Summary

1. **Dataset A/B Evaluation Schemas (CRK-P25-T01, T02, T04)**:
   - `src/types/ab-evaluation.ts` (60 lines)
   - Typed schemas for `AbComparativeMetrics`, `PackPromotionDecisionStatus`, `PromotionDecisionRecord`, and `RetrievalWeightCandidate`.
   - Unit tests: `src/types/ab-evaluation.test.ts` (1/1 passed).

2. **Dataset A/B Evaluator & Promotion Engine (CRK-P25-T01 to T04)**:
   - `src/core/evals/DatasetAbEvaluator.ts` (103 lines)
   - Evaluates Candidate vs Baseline configurations under controlled conditions.
   - Enforces strict promotion rules: rejects packs that degrade critical accuracy, increase outdated answers, increase hallucinations, or violate storage/latency budgets (§3684-3693).
   - Generates auditable Decision Records.

3. **Retrieval Weight Tuner (CRK-P25-T05)**:
   - `src/core/evals/RetrievalWeightTuner.ts` (77 lines)
   - Tunes retrieval scoring weights against held-out validation cases to prevent overfitting to the evaluation seed.

4. **Phase 25 Exit Gate Suite**:
   - `src/core/evals/__tests__/dataset-ab-eval.test.ts` (5/5 passed).
