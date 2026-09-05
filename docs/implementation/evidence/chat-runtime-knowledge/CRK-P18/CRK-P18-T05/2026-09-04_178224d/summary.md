# Summary — CRK-P18-T05: Tool Result Truthfulness & Side-Effect Ledger Exit Gate

## Phase 18 Deliverables Summary

1. **Standard Tool Result Contract (CRK-P18-T01)**:
   - `src/types/tool-truth.ts` (115 lines)
   - Canonical `CanonicalToolResult` and `ToolResult` schemas with 6 execution statuses: `'success' | 'failed' | 'blocked' | 'cancelled' | 'partial' | 'not_run'`, digest, output refs, error metadata, and verification refs (§2989-3010).
   - Unit tests: 4/4 passed (`src/types/tool-truth.test.ts`).

2. **Side-Effect Ledger (CRK-P18-T02)**:
   - `src/core/tools/SideEffectLedger.ts` (172 lines)
   - Auditable mutation ledger tracking: actor, authorization token / approval ID, input hash, exact target, status ('pending' | 'applied' | 'failed' | 'rolled_back'), changed resources, rollback snapshots, and verification status (§3013-3025).

3. **Response Language Truthfulness (CRK-P18-T03)**:
   - `src/core/tools/ToolLanguageTruthfulness.ts` (147 lines)
   - Strictly enforces the allowed status-to-language matrix (§3026-3039). Prohibits claiming file modifications when tools failed or were blocked/cancelled. Provides deterministic auto-correction when language overclaims.

4. **Coding Truth Bridge (CRK-P18-T04)**:
   - `src/core/tools/CodingTruthBridge.ts` (144 lines)
   - Reuses structured patch and verification objects from the coding system without maintaining a separate truth model (§3040-3045). Binds test executions directly into the ledger.

5. **Failure Test Suite & Phase 18 Exit Gate (CRK-P18-T05)**:
   - `src/core/tools/__tests__/tool-truthfulness-failure.test.ts` (230 lines)
   - Verifies all 6 mandatory failure conditions (§3046-3056):
     1. Provider returns success text but tool failed -> detected & corrected.
     2. Tool throws after partial write -> recorded as failed/partial in ledger with rollback snapshot details.
     3. Approval expires -> blocked state; response restricted to permission/policy wording.
     4. Verification command unavailable -> success + unverified; strictly prohibits claiming "verified".
     5. Cancellation during action -> recorded as cancelled in ledger; response restricted to "cancelled".
     6. Process exits zero but expected artifact missing -> verification failure recorded in ledger and tool result.
   - 7/7 tests passed; Phase 18 exit gate certified (§3057-3063).
