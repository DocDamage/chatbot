# Evidence Commands — CRK-P02-T05: Bot Profile Routes & Phase 02 Exit Gate

## 1. Targeted Route Tests
```powershell
npm run test -- src/server/routes/__tests__/bot-profiles.test.ts
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
(Get-Content src/server/routes/bot-profiles.ts).Count
```
- **Result**: 96 lines (< 300 lines limit).
