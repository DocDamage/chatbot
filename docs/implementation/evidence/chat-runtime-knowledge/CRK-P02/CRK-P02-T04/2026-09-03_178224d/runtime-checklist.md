# Runtime Task Checklist — CRK-P02-T04: Profile Resolution

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`BotProfileResolver`).
- [x] 5-tier resolution hierarchy implemented (admin -> request/allowed -> session -> user preference -> default).
- [x] Security policy invariance enforced (§947).
- [x] Source-size rule is satisfied (`src/core/profiles/BotProfileResolver.ts` is 84 lines, < 300 lines).

### Tests
- [x] Focused unit tests (`src/core/profiles/BotProfileResolver.test.ts`: 6 passed).
- [x] Tested admin priority.
- [x] Tested request permission gating.
- [x] Tested fallback chain.
- [x] Tested security constraint enforcement.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P02/CRK-P02-T04/2026-09-03_178224d/`.
- [x] Archive handoff generated.
