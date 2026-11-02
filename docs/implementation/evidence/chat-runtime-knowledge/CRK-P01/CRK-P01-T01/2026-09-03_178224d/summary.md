# Evidence Summary — CRK-P01-T01: Define Runtime Schemas

## Task Information
- **Task ID**: `CRK-P01-T01`
- **Task Title**: Define Runtime Schemas
- **Phase**: `CRK PHASE 01` — Canonical Chat Runtime
- **Repository**: `DocDamage/chatbot`
- **Branch**: `codex/cf04-cf10-integration`
- **Commit**: `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Date**: `2026-09-03`
- **Status**: `VERIFIED`

---

## Deliverables & Architecture
Created [`src/types/chat-runtime.ts`](file:///c:/dev/Chatbot/src/types/chat-runtime.ts) (211 lines) and unit test suite [`src/types/chat-runtime.test.ts`](file:///c:/dev/Chatbot/src/types/chat-runtime.test.ts) (325 lines) defining canonical TypeScript contracts and Zod validation schemas for the unified runtime:

1. **`NormalizedChatRequest` & `normalizedChatRequestSchema`**:
   - `requestId`: string (1-128 chars)
   - `sessionId`: string (1-128 chars)
   - `userId`: optional string (max 128 chars)
   - `message`: string (trimmed, 1-50000 chars)
   - `mode`: optional string (max 100 chars)
   - `botProfileId`: string (defaults to `'default'`)
   - `explicitSystemInstruction`: optional string (max 16000 chars)
   - `loadedFiles`: `LoadedFileContext[]` (defaults to `[]`)
   - `loadedAudio`: `LoadedAudioContext[]` (defaults to `[]`)
   - `activePlan`: optional `{ id: string; content: string }`
   - `clientCapabilities`: `{ streaming: boolean; citations: boolean; toolApproval: boolean }` (defaults all `false`)
   - `requestedModelPolicy`: optional string (max 100 chars)
   - `metadata`: `Record<string, unknown>` (defaults to `{}`)

2. **`ChatRuntimeResult` & `chatRuntimeResultSchema`**:
   - `requestId`: string
   - `response`: string
   - `model`: `{ provider: string; model: string; policy: string; fallbackUsed: boolean }`
   - `citations`: `CitationRef[]`
   - `toolResults`: `ToolResultSummary[]`
   - `warnings`: string[]
   - `latencyMs`: non-negative number
   - `traceId`: string
   - `grounding`: `{ attempted: boolean; sufficient: boolean; confidence?: number }`

3. **`CitationRef` & `citationRefSchema`**:
   - `id`, `sourceId`, `datasetId`, `title`, `sourceUrl`, `path`, `version`, `chunkId`, `quoteStart`, `quoteEnd`, `authority` (bounded [0, 1]).

4. **`ToolResultSummary` & `toolResultSummarySchema`**:
   - `toolCallId`, `toolName`, `status` (`'success' | 'failed' | 'requires_approval'`), `summary`, `error`, `durationMs`.

5. **`ChatContextPlan` & `chatContextPlanSchema`**:
   - `requestId`, `traceId`, `taskClassification`, `retrievalStrategy`, `memoryStrategy`, `toolStrategy`, `modelStrategy`, `budgetLimits`.

6. **`TaskClassificationResult` & `taskClassificationResultSchema`**:
   - `taskType`, `intent`, `confidence` ([0, 1]), `specialistDomain`, `heuristicSignals`, `requiresTools`, `requiresGrounding`.

7. **`ChatTraceContext` & `chatTraceContextSchema`**:
   - `traceId`, `requestId`, `sessionId`, `userId`, `parentSpanId`, `stageTimings`, `createdAt`.

8. **Security & Privacy Enforcement**:
   - Strict avoidance of internal chain-of-thought, reasoning traces, or hidden model thoughts in public DTOs.
   - Verified that undeclared reasoning properties are stripped by Zod parsing.

---

## Verification Summary
- **Unit Tests**: 10/10 passed in `src/types/chat-runtime.test.ts`.
- **Cross-Suite Validation**: 27/27 passed (`chat-runtime.test.ts`, `chat.test.ts`, `ChatBehaviorBaselineHarness.test.ts`).
- **Type Check**: Passed across server, tests, and client (`npm run type-check`).
- **Linter**: Passed with 0 errors/warnings (`npm run lint:server`).
- **Source Size Rule**: `src/types/chat-runtime.ts` is 211 lines (well under the 300-line ceiling).
