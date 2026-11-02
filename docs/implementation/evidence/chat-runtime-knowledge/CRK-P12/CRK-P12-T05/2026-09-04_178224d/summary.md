# Summary — CRK-P12-T05: Grounding, Evidence Sufficiency, and Abstention Exit Gate

## Phase 12 Deliverables Summary

1. **Grounding Decision Schemas (`src/types/grounding-eval.ts`, 55 lines)**:
   - `GroundingDecision` schema matching §2289-2300 with 5 action variants (`answer`, `broaden-local`, `search-online`, `ask-clarification`, `abstain`).
   - Retrieval confidence features schema matching §2307-2317 (scores, source authority, diversity, version compatibility, relevant chunks count, query coverage).
   - Unit tests: 2/2 passed (`src/types/grounding-eval.test.ts`).

2. **Sufficiency & Escalation Evaluation**:
   - `GroundingEvaluator` (`src/core/evals/GroundingEvaluator.ts`, 137 lines): calculates multi-factor confidence and determines evidence sufficiency. Enforces §2303 rule that internal hidden reasoning is never exposed to external user callers.
   - `GroundingEscalationFlow` (`src/core/evals/GroundingEscalationFlow.ts`, 99 lines): manages staged progression (§2320-2331) cleanly separating initial retrieval -> broaden-local -> search-online -> clarify/abstain.
   - `ResponseWordingPolicy` (`src/core/evals/ResponseWordingPolicy.ts`, 57 lines): formats truthful abstention and clarification messages (§2346-2353) without fabricating confidence.

3. **Answerability Eval Suite & Exit Gate (`src/core/evals/__tests__/grounding-abstention.test.ts`, 128 lines)**:
   - Evaluates all 7 canonical answerability benchmark scenarios (§2336-2344):
     1. Answerable exact fact -> `answer`
     2. Answerable multi-document -> `answer`
     3. No matching document -> `broaden-local` or `abstain`
     4. Conflicting current vs old doc -> `abstain` or `broaden-local` with conflict notes
     5. Malicious retrieved prompt -> `abstain` with untrusted instruction warning
     6. User asks unsupported claim -> `abstain`
     7. Project-specific question with no project evidence -> `ask-clarification`
   - Phase 12 exit gate certified with 4/4 passing tests (§2355-2360).
