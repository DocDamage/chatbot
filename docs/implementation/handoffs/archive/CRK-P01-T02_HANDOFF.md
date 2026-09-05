# Implementation Handoff — CRK-P01-T02: Build ChatRequestNormalizer

## Status
- **Repository**: `DocDamage/chatbot`
- **Branch**: `codex/cf04-cf10-integration`
- **Active Program**: Canonical Chat Runtime & Knowledge Platform
- **Phase**: `CRK PHASE 01` — Canonical Chat Runtime
- **Completed Task**: `CRK-P01-T02` — Build `ChatRequestNormalizer` (`VERIFIED`)
- **Base Commit**: `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Evidence Path**: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T02/2026-09-03_178224d/`

---

## Deliverables
1. **ChatRequestNormalizer Service**: [`src/core/chat/ChatRequestNormalizer.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRequestNormalizer.ts) (279 lines)
   - Implemented canonical input sanitization, security boundary enforcement, context deduplication, and schema validation.
   - Enforces server-authoritative authentication: `serverContext.userId` strictly overrides client claims.
   - Assigns unique canonical `requestId` (`req_${randomUUID()}`) if not supplied.
   - Deduplicates `loadedFiles` and `loadedAudio` by path; applies size limits and truncates oversized file contents.
   - Resolves structured and legacy `activePlan` and system prompts.
   - Neutralizes prototype pollution (`__proto__`, `constructor`, `prototype`) and rejects malformed metadata.
   - Guarantees schema compliance by parsing draft objects through `normalizedChatRequestSchema`.
2. **Normalizer Unit Test Suite**: [`src/core/chat/ChatRequestNormalizer.test.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRequestNormalizer.test.ts) (257 lines)
   - 21 comprehensive unit tests covering defaults, message limits, session presence, server auth identity preservation, context deduplication, plan parsing, prototype pollution prevention, and Unicode preservation.

---

## Verification
- Unit Tests: 21/21 passed (`src/core/chat/ChatRequestNormalizer.test.ts`).
- Regression Suite: 47/47 passed across `chat-runtime.test.ts`, `ChatRequestNormalizer.test.ts`, `chat.test.ts`, and `ChatBehaviorBaselineHarness.test.ts`.
- Full Type Check: Passed (`npm run type-check`: server, tests, client — 0 errors).
- Linting: Passed with 0 errors/warnings (`npm run lint:server`).
- Source File Size: 279 lines (complies with the < 300 lines ceiling rule).

---

## Next Authorized Task
- **`CRK-P01-T03` — Build `ChatRuntime`**:
  - Implement orchestrating façade composing `policyResolver`, `stateService`, `taskAnalyzer`, `workflowResolver`, `contextPlanner`, `contextExecutor`, `modelPolicy`, `promptAssembler`, `generator`, and `responsePipeline`.
