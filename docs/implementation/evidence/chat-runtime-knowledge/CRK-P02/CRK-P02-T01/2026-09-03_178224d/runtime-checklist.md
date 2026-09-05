# Runtime Task Checklist — CRK-P02-T01: Define BotProfile

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`BotProfile` & `BotProfileVersion` schemas).
- [x] Secrets strictly forbidden from profiles (§907).
- [x] Auditable version tracking contract defined.
- [x] Source-size rule is satisfied (`src/types/bot-profile.ts` is 60 lines, < 300 lines).

### Tests
- [x] Focused unit tests (`src/types/bot-profile.test.ts`: 5 passed).
- [x] Security test verifying secret rejection.
- [x] Audit version record verification.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P02/CRK-P02-T01/2026-09-03_178224d/`.
- [x] Archive handoff generated.
