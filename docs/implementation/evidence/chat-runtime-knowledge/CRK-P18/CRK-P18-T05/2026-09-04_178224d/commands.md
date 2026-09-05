# Commands — CRK-P18-T05: Tool Result Truthfulness & Side-Effect Ledger Exit Gate

```bash
# Schema & unit verification
npx jest --runTestsByPath src/types/tool-truth.test.ts

# Exit gate failure test suite
npx jest --runTestsByPath src/core/tools/__tests__/tool-truthfulness-failure.test.ts

# TypeScript type check
npm run type-check

# Server lint
npm run lint:server
```
