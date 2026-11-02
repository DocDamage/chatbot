# Commands — CRK-P16-T06: Feedback Consolidation Exit Gate

```bash
# Schema & unit verification
npx jest --runTestsByPath src/types/feedback.test.ts

# Exit gate integration suite
npx jest --runTestsByPath src/core/feedback/__tests__/feedback-consolidation-integration.test.ts

# Client component tests
npm --prefix client run test -- src/components/ResponseFeedbackBar.test.tsx

# TypeScript type check
npm run type-check

# Server lint
npm run lint:server
```
