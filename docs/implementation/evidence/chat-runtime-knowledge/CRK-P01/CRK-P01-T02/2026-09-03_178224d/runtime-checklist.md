# Runtime Task Checklist — CRK-P01-T02: Build ChatRequestNormalizer

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`ChatRequestNormalizer` service and `ChatRequestNormalizationError`).
- [x] No placeholder production path.
- [x] No duplicate competing behavior created.
- [x] Source-size rule is satisfied (`src/core/chat/ChatRequestNormalizer.ts` is 279 lines, < 300 lines).
- [x] Configuration & DTOs are typed (`NormalizedChatRequest`, `ChatServerContext`, `ChatNormalizationOptions`).
- [x] Context attachments deduplicated by path (`loadedFiles`, `loadedAudio`).
- [x] Server-authoritative auth identity preserved (`serverContext.userId` over client claims).
- [x] Metadata sanitized against prototype pollution (`__proto__`, `constructor`, `prototype`).
- [x] Database change has migration (N/A — pure in-memory request normalizer).

### Tests
- [x] Focused unit tests (`src/core/chat/ChatRequestNormalizer.test.ts`: 21 passed).
- [x] Integration / cross-suite baseline tests (`chat-runtime.test.ts`, `chat.test.ts`, `ChatBehaviorBaselineHarness.test.ts`: 26 passed).
- [x] Security / negative boundary tests (empty message, overlong message, missing session, malformed metadata, invalid activePlan, prototype pollution, non-object root).
- [x] Full Unicode and astral plane emoji preservation tested.

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
- [x] Evidence bundle placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T02/2026-09-03_178224d/`.
- [x] Current handoff and archived handoff generated.
