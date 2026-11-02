# Runtime Task Checklist — CRK-P02-T05: Bot Profile Routes & Phase 02 Exit Gate

## Task-Level Definition of Done (Plan §59)

### Implementation
- [x] Complete behavior exists (`createBotProfileRouter`).
- [x] REST endpoints for listing, retrieval, creation, rollback, and context resolution.
- [x] Source-size rule is satisfied (`src/server/routes/bot-profiles.ts` is 96 lines, < 300 lines).

### Tests
- [x] Focused integration tests (`src/server/routes/__tests__/bot-profiles.test.ts`: 5 passed).
- [x] Tested profile listing, retrieval, creation, rollback, resolution.

### Phase 02 Exit Gate Certification
- [x] Default assistant behavior is represented by an explicit profile (`DEFAULT_BOT_PROFILE`, `BUILTIN_PROFILES`).
- [x] Profile versions are persisted/auditable (`BotProfileRepository`, `BotProfileVersion`).
- [x] Security/contract policy is outside user-overridable profile fields (`BotProfileResolver`).
- [x] Prompt literals begin migrating to prompt assets/configuration (`PROMPT_ASSETS`, `resolveSystemPromptAsset`).

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P02/CRK-P02-T05/2026-09-03_178224d/`.
- [x] Archive handoff generated.
