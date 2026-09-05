# Runtime Task Checklist — CRK-P01-T06: Shadow Mode & Phase 01 Exit Gate

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`ChatRuntimeShadowRunner`).
- [x] Non-mutating shadow execution implemented.
- [x] No duplicate tool writes or duplicate memory mutations.
- [x] Source-size rule is satisfied (`src/core/chat/ChatRuntimeShadowRunner.ts` is 96 lines, < 300 lines).

### Tests
- [x] Focused unit tests (`src/core/chat/ChatRuntimeShadowRunner.test.ts`: 3 passed).
- [x] Tested shadow disabled passthrough.
- [x] Tested shadow comparison emission and divergence detection.
- [x] Tested failure isolation (shadow failure never affects primary response).

### Phase 01 Exit Gate Certification
- [x] New runtime schemas compile (`src/types/chat-runtime.ts`).
- [x] New runtime can execute a basic request (`ChatRuntime.ts`, `ChatRuntimeFactory.ts`).
- [x] Existing route contract remains compatible (`ChatRuntimeCompatibilityAdapter.ts`).
- [x] Shadow mode is non-mutating (`ChatRuntimeShadowRunner.ts`).
- [x] Unit/integration tests prove stage ordering (`ChatRuntime.test.ts`).
- [x] No production default changed yet.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T06/2026-09-03_178224d/`.
- [x] Archive handoff generated.
