# Commands — CRK-P15-T05: Citation and Provenance UX Exit Gate

```bash
# Schema & unit verification
npx jest --runTestsByPath src/types/citation.test.ts

# Exit gate integration suite
npx jest --runTestsByPath src/core/knowledge/__tests__/citation-provenance-integration.test.ts

# Client component tests
npm --prefix client run test -- src/components/SourcesDrawer.test.tsx src/components/WhyThisAnswerModal.test.tsx

# TypeScript type check
npm run type-check

# Server lint
npm run lint:server
```
