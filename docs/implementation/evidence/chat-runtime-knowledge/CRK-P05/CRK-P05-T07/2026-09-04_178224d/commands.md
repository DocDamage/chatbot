# Evidence Commands — CRK-P05-T07: Context Planner Matrix & Phase 05 Exit Gate

## 1. Targeted Unit & Matrix Tests
```powershell
npm test -- src/types/context-plan.test.ts src/core/chat/__tests__/context-planner-matrix.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 2 test suites passed, 12 tests passed.

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
