# CRK Specifications 31 through 35 — Implementation Handoff

## Task Identification
- Sections: 31 through 35 of `AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`
- Status: `VERIFIED & CERTIFIED`
- Date: 2026-09-04
- Commit Base: `178224d`

## Completed Scope
1. **Section 31: Default Client UX Specification**:
   - Built `ModelSelectorDropdown` with 7 canonical policies (`Auto`, `Fast`, `Balanced`, `Reasoning`, `Coding`, `Creative`, `Local`) and configured model disclosure.
   - Built `KnowledgeManagerPanel` with 6 tabs (`Installed`, `Available`, `Updates`, `Storage`, `Custom Packs`, `Advanced`), pack stats cards, and pre-install details.
   - Verified via `client-ux-spec.test.tsx` (5/5 passing).
2. **Section 32: Configuration Specification**:
   - Implemented `CanonicalRuntimeConfig.ts` with typed Zod validation for runtime, knowledge, retrieval, feedback, and privacy retention variables.
   - Verified via `canonical-runtime-config.test.ts` (4/4 passing).
3. **Section 33: Security Requirements Specific to Knowledge and Runtime**:
   - Implemented `KnowledgeSecurityPolicy.ts` covering prompt injection boundaries, sha256 checksums, tenant isolation, SSRF prevention, parser safety limits, inert code tagging, and diagnostics secret/CoT redaction.
   - Verified via `knowledge-security-policy.test.ts` (15/15 passing).
4. **Section 34: Performance and Capacity Targets**:
   - Implemented `CapacityPerformanceTracker.ts` and `ResourceGuardrailService.ts` for chat latency budgets, storage metrics, embedding throughput, and pause guardrails.
   - Verified via `capacity-performance.test.ts` (7/7 passing).
5. **Section 35: Failure-Mode Matrix**:
   - Implemented `FailureModeMatrixHandler.ts` mapping all 19 canonical failure modes to graceful recovery actions.
   - Verified via `failure-mode-matrix.test.ts` (8/8 passing).

## Quality Gates
- Type Check: Passed cleanly across server, client, and test suites.
- Linters: Clean across server and client.
- Source Line Guideline: All files <= 235 lines.
- Evidence Path: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-31-35/2026-09-04_178224d/`
