# Commands — CRK-P17-T05: Response Quality Gate Exit Gate

```bash
# Schema & unit verification
npx jest --runTestsByPath src/types/response-quality.test.ts

# Exit gate integration suite
npx jest --runTestsByPath src/core/validation/__tests__/response-quality-gate.test.ts

# TypeScript type check
npm run type-check

# Server lint
npm run lint:server
```
