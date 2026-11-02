# Evidence Commands — CRK-P02-T01: Define BotProfile

## 1. Targeted Unit Tests
```powershell
npm run test -- src/types/bot-profile.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 1 test suite passed, 5 tests passed.

## 2. Server Linter
```powershell
npm run lint:server
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors, 0 warnings.

## 3. Source File Size
```powershell
(Get-Content src/types/bot-profile.ts).Count
```
- **Result**: 60 lines (< 300 lines limit).
