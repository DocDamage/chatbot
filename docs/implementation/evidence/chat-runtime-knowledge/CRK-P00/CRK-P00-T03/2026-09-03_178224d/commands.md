# Verification Commands: CRK-P00-T03

```powershell
# 1. Execute baseline capture test harness
npx jest src/core/evals/__tests__/ChatBehaviorBaselineHarness.test.ts --runInBand

# 2. Type integrity across repository
npm run type-check

# 3. Linter validation
npm run lint:server
```
