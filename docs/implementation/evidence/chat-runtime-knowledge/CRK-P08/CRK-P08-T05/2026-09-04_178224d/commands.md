# Evidence Commands — CRK-P08-T05: Knowledge Router Exit Gate

## 1. Targeted Unit & Integration Tests
```powershell
npm test -- src/types/knowledge-router.test.ts src/core/knowledge/__tests__/knowledge-router.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 2 test suites passed, 9 tests passed.

## 2. Server Linter
```powershell
npm run lint:server
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors, 0 warnings.

## 3. Full Type Checking
```powershell
npm run type-check
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors across server, tests, and client.
