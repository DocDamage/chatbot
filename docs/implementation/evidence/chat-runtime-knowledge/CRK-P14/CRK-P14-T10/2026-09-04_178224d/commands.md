# Verification Commands — CRK-P14-T10: Curated Source-Code Pack Exit Gate

```bash
# Type Check
npm run type-check

# Lint Check
npm run lint:server

# Phase 14 Unit and Integration Tests
npx jest src/types/source-code-pack.test.ts src/core/knowledge/__tests__/source-code-retrieval-benchmark.test.ts
```
