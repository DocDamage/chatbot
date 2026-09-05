# Verification Commands: CRK-P00-T02

```powershell
# 1. Duplication pattern audits
git grep -n "systemPrompt" src/
git grep -n "inferTaskType\|TaskType" src/
git grep -n "shouldUseRAG" src/
git grep -n -i "retry" src/
git grep -n "fallback" src/core/orchestrator/ src/server/routes/
git grep -n "citation" src/core/
git grep -n "Feedback" src/

# 2. Type integrity
npm run type-check

# 3. Linter validation
npm run lint:server

# 4. Route test execution
npx jest src/server/routes/__tests__/versionedChat.test.ts src/server/routes/__tests__/route-legacy-chat-matrix.test.ts --runInBand
```
