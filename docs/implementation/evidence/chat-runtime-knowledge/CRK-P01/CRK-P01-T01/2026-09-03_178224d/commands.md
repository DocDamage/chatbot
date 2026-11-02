# Evidence Commands — CRK-P01-T01: Define Runtime Schemas

## Environment
- Node: `v24.15.0`
- npm: `11.6.2`
- OS: Windows 11
- Branch: `codex/cf04-cf10-integration`
- Commit: `178224d9c5b7891b78f52ddc781a319faeab64de`

## Commands Executed

### 1. Focused Unit Tests for Runtime Schemas
```powershell
npx jest src/types/chat-runtime.test.ts
```
**Exit Code**: `0`
**Result**: 10 passed, 10 total.

### 2. Regression & Baseline Suite
```powershell
npx jest src/types/chat.test.ts src/types/chat-runtime.test.ts src/core/evals/__tests__/ChatBehaviorBaselineHarness.test.ts
```
**Exit Code**: `0`
**Result**: 27 passed, 27 total across 3 suites.

### 3. Type Checking
```powershell
npm run type-check
```
**Exit Code**: `0`
**Sub-tasks**:
- `npm run type-check:server` (tsc --noEmit) -> Exit Code `0`
- `npm run type-check:tests` (tsc --noEmit -p tsconfig.tests.json) -> Exit Code `0`
- `npm run type-check:client` (cd client && npm run type-check) -> Exit Code `0`

### 4. Code Quality & Linting
```powershell
npm run lint:server
```
**Exit Code**: `0`
**Result**: 0 errors, 0 warnings.
