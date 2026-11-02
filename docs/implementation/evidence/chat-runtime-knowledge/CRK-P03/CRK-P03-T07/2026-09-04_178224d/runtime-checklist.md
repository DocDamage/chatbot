# Runtime Task Checklist — CRK-P03-T07: Phase 03 Exit Gate

## Phase 03 Definition of Done & Exit Gate (§1091-1097)

### Implementation
- [x] Structured follow-up variables work.
- [x] Variable provenance is stored (`sourceTurnId`, `source`, `confidence`, `updatedAt`, `expiresAt`).
- [x] Conversation state is distinct from long-term memory (session scoped, no leakage).
- [x] Context selection dynamically omits irrelevant variables for non-technical tasks.
- [x] Source-size rule is satisfied (all production files <= 195 lines, < 300 lines limit).

### Tests
- [x] "I use Godot 4.7" -> later "how do I make a signal?" retains version.
- [x] "repo A" -> later switch to "repo B" updates correctly.
- [x] Temporary output-format preference does not become permanent.
- [x] Contradiction explicitly updates variable.
- [x] Ambiguous contradiction requests clarification only when required.
- [x] Deleted session does not leak state.
- [x] 26/26 unit and regression tests pass across 6 suites.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P03/CRK-P03-T07/2026-09-04_178224d/`.
- [x] Archive handoff generated.
