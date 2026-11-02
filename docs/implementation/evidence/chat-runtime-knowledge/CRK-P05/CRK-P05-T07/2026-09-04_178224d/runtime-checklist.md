# Runtime Task Checklist — CRK-P05-T07: Phase 05 Exit Gate

## Phase 05 Definition of Done & Exit Gate (§1334-1340)

### Implementation
- [x] Every request produces a structured ContextPlan (`ChatContextPlanner.ts`).
- [x] RAG is no longer controlled only by string heuristics (`ContextRoutingSignals.ts` + `ContextClassifier.ts`).
- [x] No-retrieval behavior is intentional and tested (`NO_RAG_USER_RESTRICTED`, `NO_RAG_ATTACHED_SUFFICIENT`, `NO_RAG_GREETING_OR_BRAINSTORM`, `NO_RAG_CREATIVE_OR_REWRITE`).
- [x] Project context reuses coding infrastructure (`ProjectContextPlanner.ts`).
- [x] Source-size rule is satisfied (all production files <= 198 lines, < 300 lines limit).
- [x] Wired into `ChatRuntimeFactory.ts`.

### Tests
- [x] ContextPlan schema validation for all 7 requirement types (3/3 passed).
- [x] Matrix Case 1: "write a limerick" -> no RAG (passed).
- [x] Matrix Case 2: "what does this attached file say?" -> loaded file only (passed).
- [x] Matrix Case 3: "fix TS2322 in this repo" -> project + typescript docs (passed).
- [x] Matrix Case 4: "what is photosynthesis?" -> general knowledge (passed).
- [x] Matrix Case 5: "what changed in Godot 4.7?" -> version-filtered official docs (passed).
- [x] Matrix Case 6: "continue the plan" -> active plan + conversation state (passed).
- [x] Matrix Case 7: "prove derivative of sin x" -> math pack (passed).
- [x] Matrix Case 8: "explain why my current test fails" -> project/test evidence first (passed).
- [x] Matrix Case 9: "don't search online" -> no online retrieval (passed).
- [x] 12/12 unit and matrix tests pass across 2 suites.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Full CRK suites pass cleanly (120/120 tests).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P05/CRK-P05-T07/2026-09-04_178224d/`.
