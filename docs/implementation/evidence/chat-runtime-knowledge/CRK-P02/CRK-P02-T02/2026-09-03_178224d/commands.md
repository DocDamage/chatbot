# Evidence Commands — CRK-P02-T02: Add Profile Persistence

## 1. Targeted Unit Tests
```powershell
npm run test -- src/core/profiles/BotProfileRepository.test.ts
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
(Get-Content src/core/profiles/BotProfileRepository.ts).Count
```
- **Result**: 169 lines (< 300 lines limit).
