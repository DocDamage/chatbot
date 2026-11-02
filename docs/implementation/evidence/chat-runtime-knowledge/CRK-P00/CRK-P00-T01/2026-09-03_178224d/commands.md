# Verification Commands: CRK-P00-T01

```powershell
# 1. Source verification & route inspection
git grep -n "new Orchestrator\|new EnhancedOrchestrator"
Select-String -Path "src/server/index.ts" -Pattern "chat"
Get-ChildItem -Path src/server/routes -Recurse

# 2. Schema and type integrity (server, tests, and client)
npm run type-check

# 3. Linter validation
npm run lint:server

# 4. Targeted route and chat tests
npx jest src/server/routes/__tests__/versionedChat.test.ts src/server/routes/__tests__/route-legacy-chat-matrix.test.ts --runInBand
```
