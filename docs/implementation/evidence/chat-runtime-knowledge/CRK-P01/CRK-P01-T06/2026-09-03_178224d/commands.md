# Evidence Commands — CRK-P01-T06: Shadow Mode & Phase 01 Exit Gate

## 1. Targeted Unit Tests
```powershell
npm run test -- src/core/chat/ChatRuntimeShadowRunner.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 1 test suite passed, 3 tests passed.

## 2. Combined Phase 01 Regression Suite
```powershell
npm run test -- src/types/chat-runtime.test.ts src/core/chat/ChatRequestNormalizer.test.ts src/core/chat/ChatRuntime.test.ts src/core/chat/ChatRuntimeFactory.test.ts src/core/chat/ChatRuntimeCompatibilityAdapter.test.ts src/core/chat/ChatRuntimeShadowRunner.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 6 test suites passed, 47 tests passed.

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
- **Output Summary**: 0 errors across server, tests, client.
