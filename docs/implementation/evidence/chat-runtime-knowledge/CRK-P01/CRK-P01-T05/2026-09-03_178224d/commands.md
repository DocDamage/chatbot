# Evidence Commands — CRK-P01-T05: Build Compatibility Adapter

## 1. Targeted Unit Tests
```powershell
npm run test -- src/core/chat/ChatRuntimeCompatibilityAdapter.test.ts
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
(Get-Content src/core/chat/ChatRuntimeCompatibilityAdapter.ts).Count
```
- **Result**: 96 lines (< 300 lines limit).
