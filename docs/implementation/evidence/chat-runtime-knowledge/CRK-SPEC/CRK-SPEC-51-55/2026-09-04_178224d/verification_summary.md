# CRK-SPEC-51-55: General Retrieval Policy, Memory vs Knowledge Arbiter, Training Separation, Storage Planning & Backlog Reconciliation Verification

- **Repository:** `DocDamage/chatbot`
- **Base Commit:** `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Execution Date:** 2026-09-04
- **Program:** Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- **Scope:** Specifications 51 through 55 (Phases 51-55):
  - Section 51: General Knowledge Retrieval Policy Engine (`CRK-SPEC-51`)
  - Section 52: Memory vs Knowledge Decision Table Arbiter (`CRK-SPEC-52`)
  - Section 53: Training and Fine-Tuning Separation Coordinator (`CRK-SPEC-53`)
  - Section 54: Storage Planning & Install Presets Estimator (`CRK-SPEC-54`)
  - Section 55: Initial Implementation Backlog Summary & Governance Reconciliation (`CRK-SPEC-55`)

---

## 1. Implemented Components

### Section 51: General Knowledge Retrieval Policy Engine (`CRK-SPEC-51`)
- **Schema & Types:** `src/types/general-retrieval-policy.ts` (48 lines)
- **Unit Tests:** `src/types/general-retrieval-policy.test.ts` (2/2 passed)
- **Policy Engine:** `src/core/knowledge/GeneralRetrievalPolicyEngine.ts` (162 lines)
  - §51.1 Normal Fact Strategy: Prefers structured knowledge, encyclopedia, and authoritative domain sources.
  - §51.2 Scientific Question Strategy: Prioritizes research papers, structured metadata, and encyclopedia background.
  - §51.3 Time-Sensitive Fact Strategy: Detects temporal indicators ("latest", "current", "now", recent years) and recommends live web retrieval when enabled.
  - §51.4 No False Freshness Invariant: Strictly prohibits claiming "latest" from static snapshots without explicit freshness disclosure notices.
- **Integration Tests:** `src/core/knowledge/__tests__/general-retrieval-policy.test.ts` (5/5 passed).

### Section 52: Memory vs Knowledge Decision Table Arbiter (`CRK-SPEC-52`)
- **Schema & Types:** `src/types/memory-knowledge-table.ts` (51 lines)
- **Unit Tests:** `src/types/memory-knowledge-table.test.ts` (2/2 passed)
- **Arbiter Engine:** `src/core/state/MemoryKnowledgeArbiter.ts` (190 lines)
  - Enforces mandatory separation across all 9 canonical information storage classes:
    1. `conversation_variable` (ephemeral session/task context)
    2. `user_memory` (long-term preferences requiring explicit user consent)
    3. `project_evidence` (repository build commands, files, local manifests)
    4. `knowledge_pack` (canonical, versioned external knowledge)
    5. `conversation_history` (message dialogue turns; never canonical knowledge)
    6. `project_memory` (user-approved architectural decisions)
    7. `developer_qa` (curated developer Q&A datasets with provenance)
    8. `tool_ledger` (execution diagnostics and side effects)
    9. `feedback_store` (user evaluation ratings and triage telemetry)
  - Strictly blocks illegal boundary violations (e.g. assistant messages into knowledge packs, tool failures into user memory, feedback ratings into knowledge packs).
- **Integration Tests:** `src/core/state/__tests__/memory-knowledge-arbiter.test.ts` (6/6 passed).

### Section 53: Training and Fine-Tuning Separation Coordinator (`CRK-SPEC-53`)
- **Schema & Contracts:** `src/types/training-separation.ts` (53 lines)
- **Unit Tests:** `src/types/training-separation.test.ts` (3/3 passed)
- **Coordinator:** `src/core/knowledge/TrainingSeparationCoordinator.ts` (140 lines)
  - §53.1-§53.3: Strict directory and logical isolation between `data/rag/`, `data/training/`, and `data/evaluation/`.
  - Anti-Contamination Invariant: Strictly blocks evaluation set examples from entering training or RAG ingestion sets.
  - §53.4: Fine-tuning readiness governance restricting status to `PRODUCTION_PREVIEW` or `LOCAL_ONLY_EXPERIMENTAL` until all 4 criteria are fulfilled (target selected, license/privacy reviewed, evals prove benefit, rollback policy exists).
- **Integration Tests:** `src/core/knowledge/__tests__/training-separation-coordinator.test.ts` (4/4 passed).

### Section 54: Storage Planning & Install Presets Estimator (`CRK-SPEC-54`)
- **Schema & Types:** `src/types/storage-planning.ts` (46 lines)
- **Unit Tests:** `src/types/storage-planning.test.ts` (2/2 passed)
- **Estimator:** `src/core/knowledge/StoragePlanningEstimator.ts` (186 lines)
  - §54.1: Float32 vector calculation formula (`raw vector bytes = vector_count * dimensions * 4`).
  - Sizing estimates for download, normalized text, raw vectors, index overhead, and minimum free disk space.
  - §54.2: 5 tiered install presets (`Lite`, `Developer`, `Research`, `Extended`, `Custom`).
  - Indiscriminate Embedding Prohibited: Enforced invariant across all presets.
  - Disk Headroom Checker: Prevents disk exhaustion and data corruption during ingestion.
- **Integration Tests:** `src/core/knowledge/__tests__/storage-planning-estimator.test.ts` (4/4 passed).

### Section 55: Initial Implementation Backlog Summary & Governance Reconciliation (`CRK-SPEC-55`)
- **Schema & Contracts:** `src/types/backlog-reconciliation.ts` (40 lines)
- **Unit Tests:** `src/types/backlog-reconciliation.test.ts` (2/2 passed)
- **Orchestrator:** `src/core/governance/BacklogReconciliationOrchestrator.ts` (128 lines)
  - Reconciles all 54 program tasks: CRK-P00 (3 tasks), CRK-P01 through CRK-P26 (26 phases), and Specifications 31 through 55 (25 specifications).
  - Validates release-blocking criteria and certifies release candidate readiness.
- **Integration Tests:** `src/core/governance/__tests__/backlog-reconciliation.test.ts` (4/4 passed).

---

## 2. Quality & Verification Gates Results

- **Full Type Check (`npm run type-check:server` & `npm run type-check:tests`):** PASS (0 errors).
- **Server Linter (`npm run lint:server`):** PASS (0 errors, 0 warnings).
- **CRK-SPEC-51-55 Test Suites:** PASS (10 test suites passed, 34/34 tests passed).
- **Source Size Constraint:** PASS (All files strictly <= 190 lines, well under the 300-line ceiling).
