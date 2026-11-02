# Canonical Chat Runtime Architecture

## 1. Overview
The Canonical Chat Runtime (`ChatRuntime`) serves as the single unified entry point for all conversation interactions across web UI, voice inputs, desktop companions, and third-party integrations (e.g., Slack, GitHub). It replaces fragmented legacy pipelines with a deterministic, layered execution pipeline.

## 2. Core Request Pipeline
Every request follows the canonical pipeline:

```text
User Request / API / Voice / Integration
               │
               ▼
   [ChatRequestNormalizer]
         ├── Tenant / User / Session resolution
         ├── Model override validation
         └── Attachment parsing
               │
               ▼
   [ConversationStateService]
         ├── Active conversation lookup
         ├── Variable extraction & persistence
         └── Context selection
               │
               ▼
   [ChatContextPlanner]
         ├── Signal extraction (keywords, structure, symbols)
         ├── Retrieval routing (explicit no-retrieval vs targeted packs)
         └── Query construction
               │
               ▼
   [KnowledgeRetrievalOrchestrator]
         ├── Authority scoring & freshness weighting
         ├── Cross-encoder reranking
         └── Grounding verification
               │
               ▼
   [ModelExecutionEngine]
         ├── Capability tier selection
         ├── Prompt assembly with delimiters
         └── Circuit-breaker streaming execution
               │
               ▼
   [NormalizedChatResponse]
         ├── Answer text & structured citations
         ├── Grounding confidence & trace ID
         └── Diagnostic run metrics
```

## 3. Key Components
- **`ChatRequestNormalizer`**: Validates schema and maps divergent channel payloads into a strictly typed `NormalizedChatRequest`.
- **`ChatContextPlanner`**: Formulates bounded retrieval plans without unnecessary RAG invocations for chitchat, creative writing, or mathematical derivation.
- **`BotProfileResolver`**: Enforces a 5-tier precedence hierarchy (`System Policy` > `Workspace` > `Role` > `User Default` > `Session Override`) ensuring non-weakening security boundaries.
- **`ToolApprovalService`**: Secures tool invocations with cryptographic HMAC signatures, preventing unauthorized arbitrary shell or database execution.
- **`ChatRuntimeShadowRunner`**: Evaluates new runtime logic in shadow mode without modifying active conversation states or triggering side effects.

## 4. Failure Modes & Fallback Strategy
When a downstream provider or model experiences high latency or errors, the runtime activates pre-configured circuit breakers to fall back to backup providers or graceful degradation modes, recording full diagnostic telemetry in `ChatRunRepository`.
