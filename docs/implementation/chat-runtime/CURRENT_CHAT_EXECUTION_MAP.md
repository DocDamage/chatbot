# Current Chat Execution Map

> Comprehensive architecture inventory and entry point map for the AI Chatbot Hub runtime.  
> Document ID: `CRK-P00-T01`  
> Plan Reference: `AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md` Section CRK PHASE 00  
> Baseline Commit: `178224d9c5b7891b78f52ddc781a319faeab64de`  
> Status: `VERIFIED`

---

## 1. Executive Summary & Purpose

This document establishes the verified inventory of all entry points in `DocDamage/chatbot` that execute chat, agentic reasoning, or language model inferences.

Prior to the Canonical Chat Runtime & Knowledge Platform (CRK) initiative, request execution was split across legacy route handlers, multiple orchestrator classes (`Orchestrator`, `EnhancedOrchestrator`), standalone specialist genius agents, and direct agent pipelines. This map provides the baseline required to consolidate all chat requests into a single canonical `ChatRuntime` (Phase 01) while preserving backward compatibility and domain-specific specialist capabilities.

---

## 2. Global Execution Route Inventory

| Route | Method | Auth & Policy | Request Schema | Orchestration / Handler | Memory Path | RAG Path | Model Router | Prompt Builder | Caching | Streaming | Persistence | Client Consumer | Production Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/api/chat` | `POST` | `rateLimiter`, `validateChatRequest`, `sanitizeInput` | `ChatRequestDto` | `legacy-chat.ts` (branches to Specialists, Task Orch, NLU, Wikipedia, or `EnhancedOrchestrator`) | `ConversationManager` (user & assistant messages) | Wikipedia (`ONLINE_KNOWLEDGE_FALLBACK`), `LocalKnowledgeAnswerer`, RAG via Orchestrator | Internal `detectUserIntent`, NLU confidence, or `ModelRouter` via Orchestrator | Inline string concatenation in `legacy-chat.ts` & `EnhancedOrchestrator` | Semantic cache via `EnhancedOrchestrator` | No (Simulated SSE available at `/stream`) | SQLite / Postgres `conversations` & `messages` | `client/src/components/AssistantChat.tsx` | Production Candidate |
| `/api/chat/stream` | `POST` | Route-level (unauthenticated default) | `{ message, sessionId, userId }` | `chat-stream.ts` wrapping `EnhancedOrchestrator.processRequest` | Inside `EnhancedOrchestrator` (`MemoryService`) | `RAGService.processQuery` inside Orchestrator | `ModelRouter` inside Orchestrator | Inline inside Orchestrator | Semantic cache inside Orchestrator | Yes (simulated chunking over SSE) | Session state in Orchestrator memory | Direct API / Streaming clients | Production Preview |
| `/api/v1/chat` | `POST` | `rateLimiter`, `validateChatRequest`, `requireReady` | `ChatRequest` (`{ message, sessionId, userId }`) | `v1/chat.ts` wrapping `orchestrator.processRequest` | `EnhancedOrchestrator` (`MemoryService`) | `EnhancedOrchestrator` | `EnhancedOrchestrator` | Inline Orchestrator | Semantic cache | No | Orchestrator memory | External v1 API integrations | Production Candidate (Compatibility) |
| `/api/v2/chat` | `POST` | `rateLimiter`, `validateChatRequest`, `requireReady` | `ChatRequest` (`{ message, sessionId, userId }`) | `v2/chat.ts` wrapping `orchestrator.processRequest` | `EnhancedOrchestrator` (`MemoryService`) | `EnhancedOrchestrator` | `EnhancedOrchestrator` | Inline Orchestrator | Semantic cache | No | Orchestrator memory | External v2 API integrations | Production Candidate (Compatibility) |
| `/api/v2/chat/stream` | `POST` | `rateLimiter`, `validateChatRequest`, `requireReady` | `ChatRequest` (`{ message, sessionId, userId }`) | `v2/chat.ts` -> `streamChat` (`chat-stream.ts`) | `EnhancedOrchestrator` (`MemoryService`) | `EnhancedOrchestrator` | `EnhancedOrchestrator` | Inline Orchestrator | Semantic cache | Yes (simulated chunking over SSE) | Orchestrator memory | Browser PW tests / External v2 stream | Production Preview |
| `/api/chat/quick-replies` | `GET` | `asyncHandler` | Query params: `lastMessage`, `lastResponse`, `context` | `QuickRepliesService` (`src/core/suggestions/QuickReplies.ts`) using primary LLM adapter | None | None | Primary adapter directly | `QuickRepliesService` inline prompt | None | No | None | `AssistantChat.tsx`, `ConversationToolsPanel.tsx` | Production Preview |
| `/api/code/ask` | `POST` | `developerOnly`, `auditPrivilegedRequest('code')`, Mode Guard | `{ message: string, runVerification?: boolean, mode?: string }` | `CodingAgent.handle` via `src/server/routes/code.ts` | None | None | Configured coding model adapter or `services.orchestrator.llmAdapter` | `CodingAgent` system / task prompt | None | No | None | Developer Studio / Code Workspace UI | Local / Developer Preview |
| `/api/code/plan` | `POST` | `developerOnly`, `auditPrivilegedRequest('code')`, Mode Guard | `{ message: string }` | `CodingAgent.plan` | None | None | `CodingAgent` heuristic/template | `CodingAgent` plan template | None | No | None | Code Workspace UI | Local / Developer Preview |
| `/api/code/patch` | `POST` | `developerOnly`, `auditPrivilegedRequest('code')`, Mode Guard | `{ message: string }` | `CodingAgent.createPatch` | None | None | `CodingAgent` diff generator | `CodingAgent` diff template | None | No | None | Code Workspace UI | Local / Developer Preview |
| `/api/code/review` | `POST` | `developerOnly`, `auditPrivilegedRequest('code')` | `{ diff: string, focus?: string[] }` | `CodingAgent.review` | None | None | `CodingAgent` static rule checker | Static rule checks | None | No | None | Code Workspace UI | Local / Developer Preview |
| `/api/code/verify` | `POST` | `developerOnly`, `auditPrivilegedRequest('code')`, Mode Guard | `{ commands?: string[] }` | `CodingAgent.verify` (runs command verification harness) | None | None | Process execution (`child_process`) | N/A | None | No | None | Code Workspace UI | Local / Developer Preview |
| `/api/rag/query` | `POST` | `developerOnly`, `auditPrivilegedRequest('rag-query')`, `requireReady` | `{ query: string, useVectorSearch?: boolean, category?: string }` | `RAGService.processQuery` (`src/server/routes/rag-query.ts`) | None | Vector Store + Document Manager | `RAGService` LLM adapter | Inline synthesis prompt | RAG cache | No | None | RAG / Knowledge Admin UI | Production Preview |
| `/api/knowledge-online/answer` | `POST` | `developerOnly`, `auditPrivilegedRequest('knowledge-online')`, `requireReady` | `{ query: string, domain?: string, freshnessDays?: number }` | `KnowledgeOnlinePipeline` (`src/server/routes/knowledge-online.ts`) | None | Live online search + synthesis | Primary orchestrator LLM adapter | Inline synthesis template | None | No | None | Knowledge Online UI | Production Preview |
| `/api/knowledge-os/ask` | `POST` | `adminOnly`, `auditPrivilegedRequest('knowledge-os')`, `requireReady` | `{ query: string }` | `KnowledgeOsChatAgent.ask` (`src/server/routes/knowledge-os.ts`) | Read-only SQL state | Knowledge Graph + DB chunks metadata | None (deterministic structured agent) | Dynamic SQL / Graph summary | None | No | None | Knowledge OS Workspace | Admin Only |
| `/api/desktop-companion/dictate` | `POST` | Local guard | `{ audioBase64, mode, targetLanguage, instructionPrompt }` | `VoiceDictationEngine` + `OllamaLocalAIBackend` | None | None | Local Ollama (`qwen3:8b`) | Dictation task prompt | None | No | Ephemeral | Desktop Floating Companion | Local Only Experimental |
| `/api/desktop-companion/clipboard-action` | `POST` | Local guard | `{ action, rawClipboardText, targetLanguage }` | `ClipboardActionService` + `OllamaLocalAIBackend` | None | None | Local Ollama (`qwen3:8b`) | Inline action prompts | None | No | Ephemeral | Desktop Floating Companion | Local Only Experimental |
| `/api/desktop-companion/synthesize` | `POST` | Local guard | `{ text, voiceId, speed }` | `LocalTTSProvider` (`WindowsSapiTTSBackend`) | None | None | SAPI / Piper TTS engine | N/A | None | No | Ephemeral | Desktop Floating Companion | Local Only Experimental |
| `/api/desktop-companion/screen-capture` | `POST` | Local guard (explicit user triggered) | `{ bounds, redactSensitiveText, userTriggered }` | `ScreenContextCaptureService` + OCR | None | None | OCR / Vision backend | N/A | None | No | Ephemeral | Desktop Floating Companion | Local Only Experimental |
| `/api/<specialist>/ask` (20+ domains) | `POST` | `routeManifest` readiness & privilege rules | Domain-specific query/message | Specialist agents (e.g. `MathGeniusAgent`, `ScienceInventionGeniusAgent`, `LegalCivicGeniusAgent`) | Domain stores | Domain knowledge bases / static json / wiki | Specialist LLM adapter or rule engine | Specialist prompt templates | Domain caches | No | Domain state where configured | Capability Hub & Studio UIs | Production Preview / Local |

---

## 3. Deep Dive: The Primary `/api/chat` Route (`legacy-chat.ts`)

The route at `/api/chat` is the central traffic hub for the user-facing web application (`client/src/components/AssistantChat.tsx`). However, it contains extensive divergent dispatch logic:

```text
Incoming POST /api/chat
  │
  ├─► rateLimiter & validateChatRequest & sanitizeInput
  ├─► enrichChatRequestWithPlan
  ├─► Persist user message in ConversationManager
  │
  ├─► Check ConversationalTaskOrchestrator.handle(sessionId, message, mode)
  │     └─► If handled: send & persist task output
  │
  ├─► Check ModePolicy.detectUserIntent(message)
  │     └─► If mode switch required: prompt user to switch mode
  │
  ├─► If mode === 'plan':
  │     └─► PlanDocumentService.createPlan() -> return markdown plan response
  │
  ├─► HumanLanguageRouter.route(message, mode)
  │     ├─► If confidence >= 0.75: specialist mode resolved
  │     └─► Else: inferChatSpecialistMode(message, mode)
  │
  ├─► Check shouldPreferLocalLibraryAnswer()
  │     └─► LocalKnowledgeAnswerer.answer(message, 'ask')
  │
  ├─► If specialistMode resolved:
  │     ├─► creative_writing / roleplay -> CreativeWritingAgent
  │     ├─► knowledge_os -> KnowledgeOsChatAgent
  │     ├─► coding -> CodingAuthorization -> CodingAgent.handle
  │     ├─► math / market / gamedev / gaming -> Specialist Genius Agent
  │     ├─► pop_culture / history / science:
  │     │     ├─► LocalKnowledgeAnswerer.answer()
  │     │     └─► If miss: WikipediaSource search + generateKnowledgeFallback() via Orchestrator
  │     ├─► music / suno / fl_studio / logic / pro_tools / mix_master -> Music/Mix Agents
  │     └─► Generic agents (story, legal, health, security, business, philosophy, language, geography, engineering)
  │           └─► If miss: generateKnowledgeFallback()
  │
  ├─► If default mode ('ask' or undefined):
  │     ├─► LocalKnowledgeAnswerer.answer(message, 'ask')
  │     └─► If miss & fallback enabled: generateKnowledgeFallback()
  │
  └─► Fallback: deps.getOrchestrator().processRequest(request)
        └─► EnhancedOrchestrator.processRequest()
              ├─► ContractGate validation
              ├─► SemanticCache check
              ├─► inferTaskType & ModelRouter.route()
              ├─► Parallel RAG retrieval + MemoryService context
              ├─► FunctionCaller / Tool calling (if enabled)
              ├─► LLMAdapter generation
              ├─► ValidationPipeline (safety, hallucination, ground check)
              ├─► ProvenanceLedger commit
              └─► Response return
```

### Critical Findings in `/api/chat`:
1. **Three Independent Retrieval Paths**:
   - `LocalKnowledgeAnswerer` queries `ragDocumentStore` directly for static wiki passages.
   - `WikipediaSource` queries public Wikipedia online API directly and constructs raw markdown facts.
   - `EnhancedOrchestrator` invokes `RAGService.processQuery` with vector embeddings.
2. **Four Disconnected Prompt Construction Points**:
   - `generateKnowledgeFallback()` in `legacy-chat.ts` assembles inline prompt strings.
   - Specialist genius agents assemble individual prompt strings.
   - `CodingAgent` constructs patch/plan/review prompts.
   - `EnhancedOrchestrator` constructs inline system/user messages.
3. **Partial Grounding & Provenance**:
   - When requests hit specialist agents or `LocalKnowledgeAnswerer`, they bypass `ValidationPipeline` and `ProvenanceLedger`.
   - Only requests reaching `EnhancedOrchestrator` receive formal validation and provenance tracking.

---

## 4. Orchestration Class Call Sites

### 4.1 Production Instantiations

- **`src/core/initialization/ServiceInitializer.ts` (Line 272)**:
  - Instantiates `EnhancedOrchestrator` with:
    - `llmAdapter`
    - `imageAdapter`
    - Config containing: `ragService`, `modelRouter`, `safetyPipeline`, `semanticCache`, `toolRegistry`, `functionCaller`, `codingAgent`.
  - Exposes `orchestrator` on the `InitializedServices` contract.

- **`src/server/index.ts` (Lines 187, 193, 200)**:
  - Injects `orchestrator` into `createChatRouter(orchestrator)` (`v1/chat.ts`).
  - Injects `orchestrator` into `createChatRouterV2(orchestrator)` (`v2/chat.ts`).
  - Injects `getOrchestrator: () => orchestrator` into `createLegacyChatHandlers` (`legacy-chat.ts`).

### 4.2 Test-Suite Instantiations

- **`src/core/orchestrator/__tests__/Orchestrator.test.ts` (Lines 16, 57, 75)**:
  - Directly tests base `Orchestrator` with mock LLM and Image adapters.
- **`src/core/orchestrator/__tests__/EnhancedOrchestrator.comprehensive.test.ts` (Lines 28, 76, 102, 126, 142, 178)**:
  - Tests `EnhancedOrchestrator` with RAG, tools, model routing, and safety pipeline configurations.
- **`src/core/orchestrator/__tests__/enhanced-orchestrator-matrix.test.ts` (Lines 14, 37, 49, 65)**:
  - Tests branch coverage across cache hits, contract violations, and RAG toggles.
- **`src/core/orchestrator/EnhancedOrchestrator.coding.test.ts` (Lines 21, 52)**:
  - Tests coding delegation branch when `TaskType.CODE_GENERATION` is detected.
- **`src/server/__tests__/chat.test.ts` (Line 16)**:
  - Tests server chat endpoints using an `EnhancedOrchestrator` instance.

---

## 5. Real-Time and Streaming Execution Paths

### 5.1 Server-Sent Events (SSE)
- **Path**: `POST /api/chat/stream` and `POST /api/v2/chat/stream`
- **Handler**: `streamChat` in `src/server/routes/chat-stream.ts`
- **Mechanics**:
  - Sets SSE headers (`text/event-stream`, `no-cache`, `keep-alive`, `X-Accel-Buffering: no`).
  - Awaits `orchestrator.processRequest()`.
  - Splits the full string response on whitespace and emits simulated token chunks with 50ms artificial delay.
- **Target Improvement (CRK Phase 01)**:
  - True token-by-token streaming from provider adapters supporting `ReadableStream` / async iterables, with backpressure handling.

### 5.2 WebSockets
- **Path**: `ws://<host>:<port>`
- **Handler**: `WebSocketServer` in `src/core/realtime/WebSocketServer.ts`
- **Mechanics**:
  - Handles client connections, session subscriptions (`subscribe`/`unsubscribe`), and session broadcasting (`broadcastToSession`).
  - **Does NOT execute LLM inferences directly**. Inferences initiated over HTTP post updates into `WebSocketServer` for multi-client synchronization.

---

## 6. Compatibility APIs vs. Canonical UI Traffic

| API Path | Client Source | Protocol | Status & Migration Plan |
|---|---|---|---|
| `POST /api/chat` | `AssistantChat.tsx` | REST JSON | **Canonical UI Traffic**. Phase 01 will route this internally through `ChatRuntime` while preserving the exact `ChatResponseDto` JSON envelope. |
| `POST /api/chat/stream` | Browser E2E / direct consumers | SSE | **Target Streaming Route**. Will connect to `ChatRuntime.streamRequest()`. |
| `POST /api/v1/chat` | External scripts & integrations | REST JSON | **Compatibility API**. Remains active as a thin wrapper mapping `v1` DTOs into `ChatRuntime`. |
| `POST /api/v2/chat` | Modern external integrations | REST JSON | **Compatibility API**. Preserves current v2 response contract. |
| `POST /api/v2/chat/stream` | Modern streaming clients | SSE | **Compatibility Streaming API**. Preserves SSE event schema (`connected`, `chunk`, `complete`, `error`). |
| `/api/<specialist>/ask` | Domain Studio UIs | REST JSON | **Specialist Workspace APIs**. Maintained for direct studio access; will delegate to unified runtime policy in Phase 02/08. |

---

## 7. Immediate Architectural Risks & Redundancies

1. **Dual Orchestrator Implementation**:
   - Both `Orchestrator.ts` and `EnhancedOrchestrator.ts` exist.
   - `Orchestrator` is largely legacy (uses basic `CacheManager` and static intent routing).
   - `EnhancedOrchestrator` contains the comprehensive feature set (semantic cache, RAG, model routing, safety pipeline, tools).
   - Neither handles conversation state variables or structured context budgets cleanly.

2. **Specialist Logic Duplication**:
   - Heuristics to detect specialist modes exist in `ModePolicy.ts`, `HumanLanguageRouter.ts`, `legacy-chat.ts`, and `EnhancedOrchestrator.inferTaskType()`.
   - Queries can receive different answers depending on whether they enter `/api/chat` (routed to specialist genius) or `/api/v1/chat` (routed to orchestrator).

3. **Untrusted Data Injection in Fallbacks**:
   - `generateKnowledgeFallback()` in `legacy-chat.ts` interpolates Wikipedia content directly into the system prompt:
     `const systemPrompt = [request?.systemPrompt, categoryInstruction].filter(Boolean).join('\n\n');`
   - This violates Global Engineering Rule 7.6 ("Retrieved content is data, not instruction"). Phase 11 (`PromptAssembler`) will remediate this boundary.

---

## 8. Handoff & Exit Criteria Verification for CRK-P00-T01

- [x] Every production candidate chat entry point is represented.
- [x] `Orchestrator` and `EnhancedOrchestrator` call sites are identified.
- [x] Compatibility APIs are distinguished from canonical UI traffic.
- [x] No known chat route is omitted.
