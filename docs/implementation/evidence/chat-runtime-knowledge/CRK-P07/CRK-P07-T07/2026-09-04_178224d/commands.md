# Evidence Commands — CRK-P07-T07: Official Documentation Pack Exit Gate

## 1. Targeted Unit & Retrieval Evaluation Tests
```powershell
npm test -- src/types/official-docs.test.ts src/core/knowledge/__tests__/official-docs-retrieval-eval.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 2 test suites passed, 8 tests passed.

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
