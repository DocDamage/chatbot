# Runtime Task Checklist — CRK-P02-T03: Create Default Profile

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`DEFAULT_BOT_PROFILE`, `BUILTIN_PROFILES`, `resolveSystemPromptAsset`).
- [x] Prompt assets decoupled from database migration payloads (§930-936).
- [x] Source-size rule is satisfied (`src/core/profiles/DefaultBotProfile.ts` is 93 lines, < 300 lines).

### Tests
- [x] Focused unit tests (`src/core/profiles/DefaultBotProfile.test.ts`: 3 passed).
- [x] Tested default profile schema conformance.
- [x] Tested prompt asset resolution.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P02/CRK-P02-T03/2026-09-03_178224d/`.
- [x] Archive handoff generated.
