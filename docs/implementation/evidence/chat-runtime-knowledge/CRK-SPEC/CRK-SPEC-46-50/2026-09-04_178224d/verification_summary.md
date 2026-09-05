# CRK-SPEC-46-50: CLI Scripts, Documentation Deliverables, CI Gates, Dataset Fixtures & Coding Retrieval Policy Verification

- **Repository:** `DocDamage/chatbot`
- **Base Commit:** `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Execution Date:** 2026-09-04
- **Program:** Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- **Scope:** Specifications 46 through 50 (Phases 46-50):
  - Section 46: Recommended CLI / Scripts Hub (`CRK-SPEC-46`)
  - Section 47: Documentation Deliverables Suite (`CRK-SPEC-47`)
  - Section 48: Required CI Gates for This Program (`CRK-SPEC-48`)
  - Section 49: Dataset Fixture Strategy for CI (`CRK-SPEC-49`)
  - Section 50: Coding-Specific Retrieval Policy Engine (`CRK-SPEC-50`)

---

## 1. Implemented Components

### Section 46: Recommended CLI / Scripts Hub (`CRK-SPEC-46`)
- **Schema & Types:** `src/types/cli-scripts.ts` (53 lines)
- **Unit Tests:** `src/types/cli-scripts.test.ts` (3/3 passed)
- **Registry & Dispatcher:** `src/core/governance/CanonicalCliRegistry.ts` (141 lines)
  - Registers all 16 canonical commands across `chat`, `knowledge`, `eval`, and `check` categories.
  - Strictly blocks bypass of production auth and approval checks (§46 invariant).
- **CLI Runner Script:** `scripts/canonical-cli.ts` (36 lines)
- **Package Scripts:** Wired in `package.json` for all 16 canonical npm script entries.
- **Integration Tests:** `src/core/governance/__tests__/canonical-cli.test.ts` (6/6 passed).

### Section 47: Documentation Deliverables Suite (`CRK-SPEC-47`)
- **Schema & Requirements:** `src/types/documentation-spec.ts` (49 lines)
- **Unit Tests:** `src/types/documentation-spec.test.ts` (2/2 passed)
- **12 Canonical Documentation Deliverables:**
  1. `docs/architecture/CHAT_RUNTIME.md`
  2. `docs/architecture/KNOWLEDGE_PLATFORM.md`
  3. `docs/guides/KNOWLEDGE_PACKS.md`
  4. `docs/guides/CHAT_DIAGNOSTICS.md`
  5. `docs/guides/MODEL_POLICIES.md`
  6. `docs/implementation/RETRIEVAL_POLICY.md`
  7. `docs/implementation/DATASET_LICENSE_POLICY.md`
  8. `docs/implementation/EVALUATION_POLICY.md`
  9. `docs/implementation/DATASET_REFRESH_POLICY.md`
  10. `docs/runbooks/KNOWLEDGE_UPDATE_FAILURE.md`
  11. `docs/runbooks/RAG_DEGRADED.md`
  12. `docs/runbooks/MODEL_ROUTING_FAILURE.md`
- **Programmatic Auditor:** `src/core/governance/DocumentationDeliverablesAuditor.ts` (162 lines)
- **Integration Tests:** `src/core/governance/__tests__/documentation-deliverables.test.ts` (3/3 passed).

### Section 48: Required CI Gates for This Program (`CRK-SPEC-48`)
- **Schema & Gate Contracts:** `src/types/ci-gates.ts` (61 lines)
- **Unit Tests:** `src/types/ci-gates.test.ts` (3/3 passed)
- **Orchestrator:** `src/core/governance/CIGatesOrchestrator.ts` (132 lines)
  - Coordinates all 13 PR CI gates (`chat-runtime-unit`, `chat-runtime-integration`, `conversation-state`, `context-planner`, `knowledge-manifest`, `knowledge-db-migrations`, `knowledge-adapter-fixtures`, `retrieval-evals`, `tool-truth-evals`, `golden-chat-smoke`, `client-knowledge-ui`, `client-feedback-ui`, `diagnostics-redaction`).
  - Coordinates all 5 release-only gates (`full-golden-suite`, `live-provider-canary`, `default-pack-evaluation`, `knowledge-refresh-canary`, `large-index-performance`).
  - §48 Invariant Enforcer: Strictly rejects external dataset downloads during PR CI.
- **Integration Tests:** `src/core/governance/__tests__/ci-gates-orchestrator.test.ts` (4/4 passed).

### Section 49: Dataset Fixture Strategy for CI (`CRK-SPEC-49`)
- **Schema & Types:** `src/types/dataset-fixtures.ts` (47 lines)
- **Unit Tests:** `src/types/dataset-fixtures.test.ts` (1/1 passed)
- **10 Canonical Offline Fixtures:** `src/core/knowledge/CanonicalDatasetFixtures.ts` (206 lines)
  - `official_docs`, `qa`, `code`, `encyclopedia`, `research`, `math`, `prompt_injection`, `duplicate_data`, `outdated_version`, `conflicting_sources`.
- **Fixture Provider & Invariant Enforcer:** `src/core/knowledge/DatasetFixtureProvider.ts` (92 lines)
  - Enforces 100% zero-network guarantee for fast, offline, reproducible CI tests.
  - Implements lexical & authority scoring, conflicting claim arbitration, and deduplication verification.
- **Integration Tests:** `src/core/knowledge/__tests__/dataset-fixtures.test.ts` (6/6 passed).

### Section 50: Coding-Specific Retrieval Policy Engine (`CRK-SPEC-50`)
- **Schema & Contracts:** `src/types/coding-retrieval-policy.ts` (74 lines)
- **Unit Tests:** `src/types/coding-retrieval-policy.test.ts` (2/2 passed)
- **Policy Engine:** `src/core/knowledge/CodingRetrievalPolicyEngine.ts` (176 lines)
  - §50.1: Request analysis (language, framework, version, build system, OS, compiler, repository, error codes) using project evidence first.
  - §50.2: 6-tier strict source ordering (Current Repo -> Official Docs -> Project Tests -> Dev Q&A -> Curated Examples -> Broader Sources).
  - §50.3: Sanitized error query expansion redacting private local file paths and secret tokens.
  - §50.4: Code output adaptation validator enforcing local style, current APIs, and project types.
  - §50.5: Multi-stage verification planner reporting unavailable checks honestly.
- **Integration Tests:** `src/core/knowledge/__tests__/coding-retrieval-policy.test.ts` (5/5 passed).

---

## 2. Quality & Verification Gates Results

- **Full Type Check (`npm run type-check:server` & `npm run type-check:tests`):** PASS (0 errors across server and test configurations).
- **Server Linter (`npm run lint:server`):** PASS (0 errors, 0 warnings).
- **CRK-SPEC-46-50 Test Suites:** PASS (10 test suites passed, 35/35 tests passed).
- **Source Size Constraint:** PASS (All files strictly <= 206 lines, well under the 300-line ceiling).
