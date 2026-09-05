# Runtime Task Checklist — CRK-P12-T05: Grounding, Evidence Sufficiency, and Abstention Exit Gate

## Phase 12 Definition of Done & Exit Gate (§2354-2360)

### Implementation
- [x] Evidence sufficiency model (`GroundingDecision`) matching §2289-2300 implemented (`src/types/grounding-eval.ts`).
- [x] Internal hidden reasoning is preserved internally without being exposed to end users (§2303).
- [x] Retrieval confidence features computed across score, authority, diversity, and coverage (§2307-2317) implemented (`src/core/evals/GroundingEvaluator.ts`).
- [x] Escalation flow cleanly separating broaden-local from online retrieval (§2320-2331) implemented (`src/core/evals/GroundingEscalationFlow.ts`).
- [x] Answerability benchmark set covering all 7 canonical scenarios (§2336-2344) implemented (`src/core/evals/AnswerabilityEvalSet.ts`).
- [x] Response wording policy for truthfulness and abstention (§2346-2353) implemented (`src/core/evals/ResponseWordingPolicy.ts`).
- [x] Source-size rule satisfied (all production files <= 140 lines, strictly under 300-line ceiling).

### Tests & Verification
- [x] RAG can explicitly abstain when evidence is insufficient (§2356).
- [x] Broaden-local and online escalation are separate stages (§2357).
- [x] Unsupported-claim rate meets eval threshold (§2358).
- [x] Citation presence does not substitute for evidence sufficiency (§2359).
- [x] Full type check (`npm run type-check`: 0 errors).
- [x] Linter (`npm run lint:server`: 0 warnings/errors).
