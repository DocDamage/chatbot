# Runtime Task Checklist — CRK-P01-T03: Build ChatRuntime

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`ChatRuntime` façade and `ChatRuntimeError`).
- [x] No placeholder production path.
- [x] No duplicate competing behavior created.
- [x] Source-size rule is satisfied (`src/core/chat/ChatRuntime.ts` is 266 lines, < 300 lines).
- [x] Configuration & DTOs are typed (`ChatRuntimeDependencies`, `ChatPolicyResolution`, `ChatConversationState`, `ChatWorkflowDefinition`, `ChatExecutionContext`, `ModelSelectionResult`, `ChatPromptEnvelope`, `ChatGenerationResult`).
- [x] Strict stage execution order implemented and verified.
- [x] Timing instrumentation recorded for each stage.
- [x] Direct environment variable access prohibited (§838).
- [x] Database change has migration (N/A — in-memory orchestration façade).

### Tests
- [x] Focused unit tests (`src/core/chat/ChatRuntime.test.ts`: 5 passed).
- [x] Integration / cross-suite baseline tests (`chat-runtime.test.ts`, `ChatRequestNormalizer.test.ts`, `chat.test.ts`, `ChatBehaviorBaselineHarness.test.ts`: 47 passed).
- [x] Negative boundary / failure handling tests (stage rejection wrapped in `ChatRuntimeError`, schema invalidation rejected).

### Verification
- [x] Type-check (`npm run type-check` across server, tests, and client: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).
- [x] Build passes without regressions.
- [x] Runtime QA / API compatibility verified.

### Evidence
- [x] Exact commit SHA (`178224d9c5b7891b78f52ddc781a319faeab64de`).
- [x] Commands + exit codes recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Evidence bundle placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T03/2026-09-03_178224d/`.
- [x] Current handoff and archived handoff generated.
