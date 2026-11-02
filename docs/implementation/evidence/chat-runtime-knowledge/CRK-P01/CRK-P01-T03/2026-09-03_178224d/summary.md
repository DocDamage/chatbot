# Evidence Summary — CRK-P01-T03: Build ChatRuntime

## Task Information
- **Task ID**: `CRK-P01-T03`
- **Task Title**: Build `ChatRuntime`
- **Phase**: `CRK PHASE 01` — Canonical Chat Runtime
- **Repository**: `DocDamage/chatbot`
- **Branch**: `codex/cf04-cf10-integration`
- **Commit**: `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Date**: `2026-09-03`
- **Status**: `VERIFIED`

---

## Deliverables & Architecture
Created [`src/core/chat/ChatRuntime.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntime.ts) (266 lines) and unit test suite [`src/core/chat/ChatRuntime.test.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntime.test.ts) (266 lines) providing the canonical orchestrating façade for all chat interactions:

1. **Dependency Injected Orchestrating Façade**:
   - Composes 10 discrete stage services via `ChatRuntimeDependencies`:
     - `IChatPolicyResolver`: Resolves bot profile policy, model restrictions, and context budgets.
     - `IChatStateService`: Loads and commits conversation message history and variables.
     - `IChatTaskAnalyzer`: Analyzes intent, task type, tool requirements, and grounding need.
     - `IChatWorkflowResolver`: Resolves specialized agent workflows.
     - `IChatContextPlanner`: Formulates context plan and retrieval/memory/tool/model strategies.
     - `IChatContextExecutor`: Executes retrieval and gathers memory/tool items.
     - `IChatModelPolicyEngine`: Selects model, provider, temperature, and tokens.
     - `IChatPromptAssembler`: Constructs structured prompt envelope.
     - `IChatGenerator`: Calls model provider for text generation.
     - `IChatResponsePipeline`: Validates safety, verifies tool claims, attaches citations and grounding.
     - Optional `IChatRunRecorder`: Records trace starts, stage timings, completion, or failure.

2. **Strict Stage Ordering & Timing Instrumentation**:
   - Executes canonical lifecycle stages:
     `policyResolution` -> `stateLoad` -> `taskAnalysis` -> `workflowResolution` -> `contextPlanning` -> `contextExecution` -> `modelSelection` -> `promptAssembly` -> `generation` -> `validationAndGrounding` -> `stateCommit`.
   - Records discrete millisecond timings for every stage in `ChatTraceContext.stageTimings`.

3. **No Direct Environment Variable Access**:
   - Zero direct reads of `process.env` in `ChatRuntime.ts`, strictly adhering to plan §838.

4. **Schema Conformance & Error Boundary**:
   - Enforces `chatRuntimeResultSchema.parse(...)` before returning the final response.
   - Throws typed `ChatRuntimeError` wrapping stage failures and notifies `runRecorder.fail(...)`.

---

## Verification Summary
- **Unit Tests**: 5/5 passed in `src/core/chat/ChatRuntime.test.ts`.
- **Combined Regression Suite**: 52/52 passed across `chat-runtime.test.ts`, `ChatRequestNormalizer.test.ts`, `ChatRuntime.test.ts`, `chat.test.ts`, and `ChatBehaviorBaselineHarness.test.ts`.
- **Type Check**: 0 errors across server, tests, and client (`npm run type-check`).
- **Linter**: 0 errors/warnings (`npm run lint:server`).
- **Source Size Rule**: `src/core/chat/ChatRuntime.ts` is 266 lines (< 300 line ceiling).
