# Task Summary: CRK-P00-T01 — Inventory Every Chat Execution Entry Point

- **Task ID**: `CRK-P00-T01`
- **Phase**: `CRK PHASE 00` (Architecture Inventory and Migration Baseline)
- **Document Reference**: `AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`
- **Baseline Commit**: `178224d9c5b7891b78f52ddc781a319faeab64de`
- **Date**: 2026-09-03
- **Status**: `IMPLEMENTED_NOT_VERIFIED` -> `VERIFIED`

---

## 1. Objectives & Delivered Scope

1. Conducted an exhaustive audit of all chat, reasoning, and language model entry points across HTTP routes, SSE streaming, WebSocket handlers, specialist studios, and background services.
2. Produced `docs/implementation/chat-runtime/CURRENT_CHAT_EXECUTION_MAP.md` detailing:
   - Route path, HTTP method, authentication policy, and request schema.
   - Orchestration class and dispatch paths (`EnhancedOrchestrator`, `Orchestrator`, direct specialist agents).
   - Memory, RAG, model routing, prompt assembly, validator, and caching attributes.
   - Real-time SSE streaming and WebSocket communication topology.
   - Classification of canonical UI traffic versus versioned compatibility APIs.
3. Identified critical architectural divergences:
   - Duplicated intent classification and mode routing between `legacy-chat.ts`, `ModePolicy.ts`, `HumanLanguageRouter.ts`, and `EnhancedOrchestrator.inferTaskType()`.
   - Dual retrieval implementations (`LocalKnowledgeAnswerer` direct wiki queries vs. `EnhancedOrchestrator` / `RAGService` vector embeddings).
   - Inline prompt assembling violating untrusted content boundaries in `legacy-chat.ts:generateKnowledgeFallback()`.

---

## 2. Acceptance Criteria Verification

- [x] **Every production candidate chat entry point is represented**:
  - `/api/chat` (legacy/primary web client)
  - `/api/chat/stream` (SSE streaming)
  - `/api/v1/chat` and `/api/v2/chat` (versioned compatibility)
  - `/api/v2/chat/stream` (versioned streaming)
  - `/api/code/*` (code generation and review)
  - `/api/rag/query` and `/api/knowledge-online/*`
  - 20+ specialist genius routes (`/api/math/ask`, `/api/music/ask`, etc.)
  - Desktop companion local routes (`/api/desktop-companion/*`)
- [x] **`Orchestrator` and `EnhancedOrchestrator` call sites are identified**:
  - Production: `ServiceInitializer.ts` (line 272) and `src/server/index.ts` (lines 187, 193, 200).
  - Tests: `Orchestrator.test.ts`, `EnhancedOrchestrator.comprehensive.test.ts`, `enhanced-orchestrator-matrix.test.ts`, `EnhancedOrchestrator.coding.test.ts`, `chat.test.ts`.
- [x] **Compatibility APIs are distinguished from canonical UI traffic**:
  - Distinctly classified `/api/chat` as the primary user-facing path and `/api/v1/*` / `/api/v2/*` as compatibility contracts.
- [x] **No known chat route is omitted**:
  - Cross-referenced against `src/server/routeManifest.ts` and `src/server/index.ts`.
