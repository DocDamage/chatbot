```bash
# Phase 09 Schema Unit Tests
npx jest src/types/retrieval-scoring.test.ts

# Phase 09 Benchmark Suite & Exit Gate
npx jest src/core/knowledge/__tests__/version-conflict-benchmark.test.ts

# Full TypeScript Compilation & Type Check
npm run type-check

# Server Linter
npm run lint:server
```
