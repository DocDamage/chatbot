# Evidence Commands — CRK-P06-T08: Dataset Registry & Knowledge Pack Infrastructure Exit Gate

## 1. Targeted Unit & Integration Tests
```powershell
npm test -- src/types/knowledge-datasets.test.ts src/types/knowledge-packs.test.ts src/core/knowledge/__tests__/knowledge-infrastructure-integration.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 3 test suites passed, 11 tests passed.

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
