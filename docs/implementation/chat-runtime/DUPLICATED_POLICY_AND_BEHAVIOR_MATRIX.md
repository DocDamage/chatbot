# Duplicated Policy and Behavior Matrix

> Architectural duplication audit and future owner service assignments.  
> Document ID: `CRK-P00-T02`  
> Plan Reference: `AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md` Section CRK PHASE 00  
> Baseline Commit: `178224d9c5b7891b78f52ddc781a319faeab64de`  
> Status: `VERIFIED`

---

## 1. Executive Summary

This audit catalogs duplicated, fragmented, or competing logic across 12 critical runtime concerns in `DocDamage/chatbot`.

### Strict Phase 00 Rule
> **No duplicate code is removed during Phase 00.**  
> All existing code paths must remain intact until the canonical runtime and its supporting services (`ChatRuntime`, `ContextPlanner`, `PromptAssembler`, `ModelPolicyEngine`, etc.) are introduced, shadow-tested, and certified in subsequent phases.

---

## 2. Comprehensive Duplication Matrix

| # | Concern | Current Implementation Locations | Problem & Divergence | Designated Future Canonical Owner | Migration Risks & Prerequisites |
|---|---|---|---|---|---|
| 1 | **Inline System Prompts** | - `src/core/orchestrator/EnhancedOrchestrator.ts:263`<br>- `src/core/orchestrator/Orchestrator.ts:106`<br>- `src/server/routes/legacy-chat.ts:277`<br>- `src/core/rag/RAGService.ts:163`<br>- `src/core/rag/ReRanker.ts:81`<br>- `src/core/rag/ContextCompressor.ts:86`<br>- `src/core/rag/QueryExpander.ts:35`<br>- `src/core/safety/SelfCheckSafety.ts:47`<br>- `src/core/safety/ConstitutionalAI.ts:53`<br>- `src/core/suggestions/QuickReplies.ts:41` | Unversioned, untyped strings constructed inline. Hardcoded prompt text interpolates untrusted user or retrieved text without injection defenses. | `PromptAssembler` (CRK Phase 11) & `BotProfile` (CRK Phase 02) | Changing prompt syntax can alter model response formatting; requires golden baseline regression suite (`CRK-P24`). |
| 2 | **Task Classifiers** | - `src/core/orchestrator/EnhancedOrchestrator.ts:415` (`inferTaskType`)<br>- `src/core/providers/EnsembleAdapter.ts:89` (`inferTaskType`)<br>- `src/server/routes/legacy-chat.ts:549` (`inferChatSpecialistMode`) | Three independent sets of hardcoded string patterns and regexes mapping messages to tasks (`code`, `math`, `creative`, `analysis`, etc.). An identical prompt can classify differently depending on the entry point. | `ContextPlanner` & `IntentAnalyzer` (CRK Phase 05) | Inconsistent classification shifts execution between coding agent, specialist genius, and general LLM; must preserve deterministic fallback rules. |
| 3 | **Intent Classifiers** | - `src/core/router/IntentRouter.ts`<br>- `src/core/nlu/HumanLanguageRouter.ts`<br>- `src/core/modes/ModePolicy.ts:detectUserIntent`<br>- `src/server/routes/legacy-chat.ts:455-493` | `IntentRouter` classifies into general intents (`GREETING`, `HELP`, etc.), `HumanLanguageRouter` computes phrase confidence for specialist routing, and `ModePolicy` detects mode switch intent. They run sequentially and can disagree. | `IntentAnalyzer` / `WorkflowEngine` (CRK Phase 04 / Phase 05) | Routing conflicts could suppress specialist modes if confidence thresholds are modified without evaluation data. |
| 4 | **`shouldUseRAG` Logic** | - `src/core/orchestrator/EnhancedOrchestrator.ts:515` (`shouldUseRAG`)<br>- `src/server/routes/legacy-chat.ts:236` (`publicKnowledgeQuery`)<br>- `src/server/routes/legacy-chat.ts:576` (`shouldPreferLocalLibraryAnswer`)<br>- `src/server/routes/legacy-chat.ts:287` (`useRAG: false`) | `EnhancedOrchestrator` uses question words (`what`, `who`, `why`); `legacy-chat.ts` strips question phrases and uses disjointed regexes for local vs online Wikipedia lookups. Broad RAG is disabled on generative fallback. | `KnowledgeRouter` (CRK Phase 08) & `ContextPlanner` (CRK Phase 05) | Aggressive RAG increases latency and token costs; insufficient RAG causes hallucinations. Needs threshold tuning per knowledge pack. |
| 5 | **Model Selection** | - `src/core/providers/ModelRouter.ts`<br>- `src/core/providers/local/LocalModelRoutingPolicy.ts`<br>- `src/core/providers/FreeModelRegistry.ts`<br>- `src/server/routes/code.ts:configuredCodingAdapter`<br>- `src/server/routes/desktop-companion.ts` | `ModelRouter` selects cloud providers (OpenAI, Anthropic, OpenRouter) via static tables; `LocalModelRoutingPolicy` selects local models (Ollama, llama.cpp) based on privacy modes; `code.ts` and `desktop-companion.ts` instantiate models directly. | `ModelPolicyEngine` (CRK Phase 10) | Cloud fallback when local models are unavailable must respect privacy boundaries and never silently degrade. |
| 6 | **Retry Loops** | - `src/core/orchestrator/EnhancedOrchestrator.ts:295-388`<br>- `src/core/orchestrator/Orchestrator.ts:109-188`<br>- `src/core/providers/local/ExternalLocalModelAdapter.ts:208-213`<br>- `src/core/rag/CorrectiveRetriever.ts:135`<br>- `src/utils/retry.ts` | Ad-hoc `while (attempts < maxRetries)` loops in orchestrators that ignore the standardized `retry` utility in `src/utils/retry.ts`. Inconsistent backoff, jitter, and error-filtering behaviors. | `ChatRuntime` (CRK Phase 01) via unified `retry` utility | Uncontrolled retries cause cascading timeouts under load; client-error 4xx codes must not be retried. |
| 7 | **Fallback Strings** | - `src/core/orchestrator/EnhancedOrchestrator.ts:394`<br>- `src/core/orchestrator/Orchestrator.ts:208`<br>- `src/server/routes/legacy-chat.ts:459`<br>- `src/server/routes/legacy-chat.ts:505`<br>- Specialist agent default responses | Static hardcoded strings returned when model generation or routing fails. Some label response model as `'fallback'` with warnings; others return silent clarification text. Violates Global Engineering Rule 7.5. | `ChatRuntime` & `AbstentionService` (CRK Phase 12) | Must report provider failure transparently without exposing stack traces or fake successes. |
| 8 | **Response Validation** | - `src/core/validator/Validators.ts` (`ValidationPipeline`)<br>- `src/core/safety/SafetyPipeline.ts`<br>- `src/core/safety/ConstitutionalAI.ts`<br>- `src/core/safety/SelfCheckSafety.ts`<br>- `src/core/safety/UncertaintyQuantifier.ts`<br>- `src/core/contracts/ContractGate.ts` | Two completely parallel pipelines: `ValidationPipeline` (safety, tone, schema) and `SafetyPipeline` (SelfCheck, Constitutional, fact check, uncertainty). `EnhancedOrchestrator` runs both sequentially, doubling latency. Specialist routes bypass both entirely. | `ResponseQualityGate` (CRK Phase 17) & `SafetyPipeline` (CRK Phase 01) | Consolidating must not weaken existing safety or contract gates; requires benchmarking validation latency. |
| 9 | **Citation Formatting** | - `src/core/rag/CitationTracker.ts`<br>- `src/core/orchestrator/EnhancedOrchestrator.ts:335-340`<br>- `src/server/routes/legacy-chat.ts:58-187`<br>- `src/core/study/StructuredNotesEngine.ts`<br>- `src/core/study/StudySourceIngestEngine.ts` | `CitationTracker.formatCitations()` is duplicated inline in `EnhancedOrchestrator.ts`. `legacy-chat.ts` implements custom Wikipedia fact extraction and date formatting. Study engines use custom `[Source: title - chapter]` strings. | `CitationFormatter` & `ProvenanceUX` (CRK Phase 15) | Clients rely on footnote parsing; format changes must be backward-compatible with frontend UI renderers. |
| 10 | **Memory Writes** | - `src/server/routes/legacy-chat.ts:440-443` (`ConversationManager`)<br>- `src/core/orchestrator/EnhancedOrchestrator.ts:377` (`MemoryService`)<br>- `src/core/orchestrator/Orchestrator.ts:219` (`MemoryService`)<br>- `src/server/routes/v1/chat.ts` (none)<br>- `src/server/routes/v2/chat.ts` (none) | Severe divergence: `/api/chat` writes to SQL tables (`conversations`, `messages`) via `ConversationManager`. `/api/v1/chat` and `/api/v2/chat` only write to in-memory `MemoryService` and never persist to disk. | `ConversationStateManager` (CRK Phase 03) | Unifying memory persistence requires consistent session ID generation and transactional writes across both SQL and cache. |
| 11 | **Feedback Collection** | - `src/server/index.ts:340-367` (`FeedbackService`)<br>- `src/core/rl/FeedbackCollector.ts`<br>- `src/core/rl/RewardModel.ts`<br>- `src/core/learning/ModelUpdater.ts` | Disconnected feedback stores: user ratings from the UI hit `FeedbackService` and are stored in isolation. The reinforcement learning `FeedbackCollector` and `RewardModel` never receive user feedback from `/api/feedback`. | `FeedbackConsolidationService` (CRK Phase 16) | User feedback must be audited and sanitized before feeding into any evaluation or fine-tuning pipelines. |
| 12 | **Request Tracing & Diagnostics** | - `src/core/observability/logger.ts`<br>- `src/core/observability/metrics.ts`<br>- `src/core/provenance/ProvenanceLedger.ts`<br>- `src/middleware/auth.ts:auditPrivilegedRequest`<br>- Per-route `Date.now() - startTime` | No unified `requestId` or `traceId` propagated across middleware, routes, orchestrators, subagents, and database queries. Artifact IDs are generated randomly via `uuidv4()` without correlation to requests. | `ChatDiagnosticsEngine` (CRK Phase 23) & `ChatRuntime` (CRK Phase 01) | Introducing tracing headers (`x-request-id`, `x-trace-id`) must not break existing API contracts or clients. |

---

## 3. Migration Roadmap for Duplicated Concerns

```text
Phase 00: Baseline Inventory (Current)
   │  (No code removed; all duplicates documented and mapped)
   ▼
Phase 01: Canonical Chat Runtime
   │  - Unify retry loops via src/utils/retry.ts
   │  - Introduce standardized requestId / trace context
   │  - Wrap Orchestrator & EnhancedOrchestrator behind ChatRuntime
   ▼
Phase 02 & 03: Bot Profiles & State
   │  - Unify ConversationManager & MemoryService persistence
   ▼
Phase 04 & 05: Workflows & Context Planner
   │  - Consolidate Task & Intent Classifiers into IntentAnalyzer
   │  - Consolidate shouldUseRAG heuristics into ContextPlanner
   ▼
Phase 08 & 10: Knowledge & Model Routers
   │  - Merge cloud ModelRouter & LocalModelRoutingPolicy
   ▼
Phase 11: Prompt & Context Assembler
   │  - Deprecate inline prompt strings across all services
   │  - Enforce untrusted data boundaries for RAG chunks
   ▼
Phase 15, 16 & 17: Citations, Feedback & Quality
   │  - Unify citation formatting under CitationFormatter
   │  - Bridge FeedbackService to FeedbackCollector
   │  - Merge ValidationPipeline & SafetyPipeline into ResponseQualityGate
```

---

## 4. Acceptance Criteria Verification for CRK-P00-T02

- [x] **Each duplicated concern has a designated future owner service** (Tabulated in Section 2 above).
- [x] **No duplicate is removed yet** (Verified: 0 production source lines deleted or refactored in Phase 00).
- [x] **Risks of migration are documented** (Detailed per concern in Section 2).
