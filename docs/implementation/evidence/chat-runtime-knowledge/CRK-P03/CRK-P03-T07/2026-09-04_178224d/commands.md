# Evidence Commands — CRK-P03-T07: Conversation State & Follow-up Exit Gate

## 1. Targeted Unit & Regression Tests
```powershell
npm run test -- src/types/conversation-state.test.ts src/core/state/ConversationVariableExtractor.test.ts src/core/state/ConversationStateReducer.test.ts src/core/state/ConversationStateService.test.ts src/core/state/ConversationContextSelector.test.ts src/core/state/__tests__/conversation-followup-regression.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 6 test suites passed, 26 tests passed.

## 2. Server Linter
```powershell
npm run lint:server
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors, 0 warnings.

## 3. Type Checking
```powershell
npm run type-check
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors across server, tests, and client.
