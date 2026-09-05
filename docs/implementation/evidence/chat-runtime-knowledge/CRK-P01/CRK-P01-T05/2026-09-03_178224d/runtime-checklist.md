# Runtime Task Checklist — CRK-P01-T05: Build Compatibility Adapter

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`ChatRuntimeCompatibilityAdapter`).
- [x] Bidirectional translation implemented for `ChatRequestDto` -> `NormalizedChatRequest` and `ChatRuntimeResult` -> `ChatResponse` / `V2ChatResponse`.
- [x] Orchestrator bridge allows legacy route handlers to execute on `ChatRuntime`.
- [x] Source-size rule is satisfied (`src/core/chat/ChatRuntimeCompatibilityAdapter.ts` is 96 lines, < 300 lines).

### Tests
- [x] Focused unit tests (`src/core/chat/ChatRuntimeCompatibilityAdapter.test.ts`: 5 passed).
- [x] Tested auth preservation from server context.
- [x] Tested knowledgeMiss signaling.
- [x] Tested V2 response mapping.
- [x] Tested drop-in bridge execution.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T05/2026-09-03_178224d/`.
- [x] Archive handoff generated.
