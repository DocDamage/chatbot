# Evidence Commands — CRK-P04-T06: Guided Workflow Engine & Phase 04 Exit Gate

## 1. Targeted Unit & Integration Tests
```powershell
npm run test -- src/types/workflow.test.ts src/core/workflow/WorkflowStateRepository.test.ts src/core/workflow/ToolApprovalBinding.test.ts src/core/workflow/__tests__/workflow-engine-integration.test.ts
```
- **Exit Code**: `0`
- **Output Summary**: 4 test suites passed, 16 tests passed.

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
