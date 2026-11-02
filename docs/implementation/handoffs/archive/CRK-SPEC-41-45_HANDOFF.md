# CRK Specifications 41 through 45 — Implementation Handoff

## Task Identification
- Sections: 41 through 45 of `AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`
- Scope: File Map Governance, API Compatibility, Rollout Stages, Rollback Coordination, Observability
- Status: `VERIFIED & CERTIFIED`
- Date: 2026-09-04
- Commit Base: `178224d`

## Completed Scope
1. **Section 41: Proposed Repository File Map (`CRK-SPEC-41`)**:
   - Built `RepositoryFileMapAuditor.ts` and `file-map.ts`.
   - Enforces canonical module directory layout (`chat`, `conversation`, `workflows`, `knowledge`, `providers`, `feedback`, `evals`, `governance`, `migration`, `observability`, `types`, `client`, `docs`).
   - Audits file size limits (<= 300 lines limit per file) and forbids circular/improper architectural boundaries (e.g. types importing core).
   - Verified via `repository-file-map.test.ts` (4/4 passing) and `file-map.test.ts` (3/3 passing).

2. **Section 42: API and Type Compatibility Strategy (`CRK-SPEC-42`)**:
   - Built `APICompatibilityBridge.ts` and `api-compatibility.ts`.
   - Maps between legacy request payloads and `NormalizedChatRequest`.
   - Formats `ChatRuntimeResult` into legacy response format while cleanly providing versioned modern additions (`citations`, `grounding`, `toolResults`, `traceId`) only to v2+ clients.
   - Enforces 4 deprecation conditions (clients migrated, API consumers identified, deprecation documented, release window elapsed) before decommissioning.
   - Verified via `api-compatibility-bridge.test.ts` (4/4 passing) and `api-compatibility.test.ts` (2/2 passing).

3. **Section 43: Migration and Rollout Strategy (`CRK-SPEC-43`)**:
   - Built `RolloutStageCoordinator.ts` and `rollout-migration.ts`.
   - Manages all 8 canonical migration stages (from `1_instrumentation` through `8_legacy_removal`).
   - Strictly enforces Stage 7 prerequisites (golden suite, security clearance, load validation, data migration verification, provider canary health, knowledge A/B promotion, and rollback drill evidence).
   - Manages traffic routing across legacy, shadow planner, internal canary, and production preview.
   - Verified via `rollout-stage-coordinator.test.ts` (5/5 passing) and `rollout-migration.test.ts` (1/1 passing).

4. **Section 44: Rollback Strategy (`CRK-SPEC-44`)**:
   - Built `CanonicalRollbackCoordinator.ts` and `rollback-recovery.ts`.
   - Multi-domain coordinated rollback (runtime flag switch, dataset atomic version switch to previous ready version, retrieval policy weights revert, model policy revert).
   - Verifies 6 mandatory preservation invariants remain uncorrupted during and after rollback (conversation data, RAG data, dataset metadata, bot profiles, feedback, active knowledge version).
   - Verified via `canonical-rollback-coordinator.test.ts` (5/5 passing) and `rollback-recovery.test.ts` (2/2 passing).

5. **Section 45: Observability Specification (`CRK-SPEC-45`)**:
   - Built `CanonicalMetricsRegistry.ts` and `observability-spec.ts`.
   - Implements all 27 specified metrics across chat runtime, context planner, RAG, dataset jobs, models, feedback, and tools.
   - Enforces cardinality guardrail by stripping prohibited high-cardinality labels (`userId`, `sessionId`, `prompt`, `rawSql`, etc.).
   - Computes derived metric `unnecessary_retrieval_rate` and exports Prometheus text format.
   - Verified via `canonical-metrics-registry.test.ts` (4/4 passing) and `observability-spec.test.ts` (3/3 passing).

## Quality Gates
- Type Check: Passed cleanly across server, client, and test suites (`npm run type-check`).
- Server Linter: Clean with 0 warnings/errors (`npm run lint:server`).
- Client Linter: Clean with 0 warnings/errors (`npm run lint:client`).
- Test Suites: 10 test suites passed (33/33 tests).
- Source Line Guideline: All production files strictly <= 182 lines (under 300-line ceiling).
- Evidence Path: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-41-45/2026-09-04_178224d/`
