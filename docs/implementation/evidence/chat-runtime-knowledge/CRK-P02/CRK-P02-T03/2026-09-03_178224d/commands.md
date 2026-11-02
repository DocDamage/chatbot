# Evidence Commands — CRK-P02-T03: Create Default Profile

## 1. Targeted Unit Tests
```powershell
npm run test -- src/core/profiles/DefaultBotProfile.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 1 test suite passed, 3 tests passed.

## 2. Server Linter
```powershell
npm run lint:server
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors, 0 warnings.

## 3. Source File Size
```powershell
(Get-Content src/core/profiles/DefaultBotProfile.ts).Count
```
- **Result**: 93 lines (< 300 lines limit).
