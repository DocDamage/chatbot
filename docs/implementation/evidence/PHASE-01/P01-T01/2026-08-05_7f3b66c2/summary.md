# P01-T01 Reproduction Summary

## Status

`VERIFIED`

## Baseline

- Repository: `DocDamage/chatbot`
- Branch: `agent/p01-t01-reproduce-latest-ci-failure`
- Baseline commit: `7f3b66c2c4ecf10028be6bbee4a68c64f651b8d0`
- Evidence implementation commit: `b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4`
- Diagnostic workflow run: `30982260932`
- Runner: Ubuntu 24.04 x64, Node 20.20.2, npm 10.8.2

## Reproduction result

The user-supplied standalone client build failed before Vite with 14 `TS2304` errors for the Node-style `global` identifier. The exact prescribed monorepo sequence passed after both root and client dependencies were installed. The supplemental client production build also passed and produced the Vite bundle.

The environment comparison identifies a package-isolation defect:

1. `client/tsconfig.json` includes all of `src`, so production `tsc` compiles test files.
2. Fourteen test statements use Node's `global` identifier.
3. The client package does not declare `@types/node`; the root package does.
4. A full root install makes the root Node declarations available during client type resolution and masks the standalone-client failure.

This task records the defect but does not repair it. P01-T02 must make client tests and builds independent of ancestor `node_modules`, while preserving clipboard success and failure coverage.

## Global references reported by the standalone build

- `client/src/api/code.test.ts:10`
- `client/src/api/code.test.ts:20`
- `client/src/api/conversations.test.ts:15`
- `client/src/components/AssistantChatPanelScope.test.tsx:75`
- `client/src/components/AssistantChatPanelScope.test.tsx:84`
- `client/src/components/AssistantChatPanelScope.test.tsx:96`
- `client/src/components/CodeWorkflowPanel.test.tsx:12`
- `client/src/components/CodeWorkflowPanel.test.tsx:78`
- `client/src/components/ConversationToolsPanel.test.tsx:12`
- `client/src/components/ConversationToolsPanel.test.tsx:104`
- `client/src/components/FLStudioControlPanel.test.tsx:12`
- `client/src/components/KnowledgeOnlinePanel.test.tsx:12`
- `client/src/components/LocalRunApprovalPanel.test.tsx:22`
- `client/src/components/SpriteLabPanel.test.tsx:15`

## Other findings

- The previously reported clipboard assertion failures did not reproduce: all 25 client test files and 63 client tests passed.
- Client lint still reports the existing unused `err` warning assigned to P01-T03.
- Server coverage remains approximately 37.83% statements and 28.02% branches.
- The stale `docs/30-seconds-of-code` gitlink cleanup warning remains assigned to P01-T04.
- No application or test source was changed.
