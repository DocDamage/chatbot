# Implementation Handoff — CRK-P01-T01: Define Runtime Schemas

## Status
- **Repository**: `DocDamage/chatbot`
- **Branch**: `codex/cf04-cf10-integration`
- **Active Program**: Canonical Chat Runtime & Knowledge Platform
- **Phase**: `CRK PHASE 01` — Canonical Chat Runtime
- **Completed Task**: `CRK-P01-T01` — Define Runtime Schemas (`VERIFIED`)
- **Base Commit**: `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Evidence Path**: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T01/2026-09-03_178224d/`

---

## Deliverables
1. **Canonical Runtime Schemas**: [`src/types/chat-runtime.ts`](file:///c:/dev/Chatbot/src/types/chat-runtime.ts) (211 lines)
   - Defined typed interfaces and Zod validation schemas for `NormalizedChatRequest`, `ChatRuntimeResult`, `CitationRef`, `ToolResultSummary`, `ModelExecutionMetadata`, `GroundingSummary`, `TaskClassificationResult`, `ChatContextPlan`, and `ChatTraceContext`.
   - Strictly enforces that internal reasoning, thoughts, or private prompt expansions are excluded from public DTOs.
2. **Runtime Schemas Test Suite**: [`src/types/chat-runtime.test.ts`](file:///c:/dev/Chatbot/src/types/chat-runtime.test.ts) (325 lines)
   - 10 comprehensive unit tests covering defaults, full contexts, field validation, strict negative boundaries, authority ranges, and privacy stripping.

---

## Verification
- Unit Tests: 10/10 passed (`src/types/chat-runtime.test.ts`).
- Regression Suite: 27/27 passed (`chat-runtime.test.ts`, `chat.test.ts`, `ChatBehaviorBaselineHarness.test.ts`).
- Full Type Check: Passed (`npm run type-check`: server, tests, client).
- Linting: Passed with 0 errors/warnings (`npm run lint:server`).

---

## Next Task
- **`CRK-P01-T02` — Build `ChatRequestNormalizer`**:
  - Responsibilities: Validate message lengths, assign unique request IDs, resolve bot profile IDs, normalize missing context arrays, apply size limits, and preserve explicit loaded file/audio/plan context.
