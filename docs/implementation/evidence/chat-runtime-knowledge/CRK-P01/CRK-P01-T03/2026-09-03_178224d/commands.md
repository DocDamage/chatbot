# Evidence Commands — CRK-P01-T03: Build ChatRuntime

## 1. Targeted Unit Tests
```powershell
npm run test -- src/core/chat/ChatRuntime.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 1 test suite passed, 5 tests passed.

## 2. Combined Regression Suite
```powershell
npm run test -- src/types/chat-runtime.test.ts src/core/chat/ChatRequestNormalizer.test.ts src/core/chat/ChatRuntime.test.ts src/server/__tests__/chat.test.ts src/core/evals/__tests__/ChatBehaviorBaselineHarness.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 5 test suites passed, 52 tests passed.

## 3. Server Linter
```powershell
npm run lint:server
```
- **Exit Code**: `0`
- **Output Summary**: 0 errors, 0 warnings.

## 4. Full TypeScript Check
```powershell
npm run type-check
```
- **Exit Code**: `0`
- **Output Summary**: Passed across `type-check:server`, `type-check:tests`, and `type-check:client`.

## 5. Source File Size Verification
```powershell
(Get-Content src/core/chat/ChatRuntime.ts).Count
```
- **Result**: 266 lines (compliant with < 300 lines limit).
