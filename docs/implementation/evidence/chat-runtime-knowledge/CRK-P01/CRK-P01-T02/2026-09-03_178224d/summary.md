# Evidence Summary — CRK-P01-T02: Build ChatRequestNormalizer

## Task Information
- **Task ID**: `CRK-P01-T02`
- **Task Title**: Build `ChatRequestNormalizer`
- **Phase**: `CRK PHASE 01` — Canonical Chat Runtime
- **Repository**: `DocDamage/chatbot`
- **Branch**: `codex/cf04-cf10-integration`
- **Commit**: `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- **Date**: `2026-09-03`
- **Status**: `VERIFIED`

---

## Deliverables & Architecture
Created [`src/core/chat/ChatRequestNormalizer.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRequestNormalizer.ts) (279 lines) and unit test suite [`src/core/chat/ChatRequestNormalizer.test.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRequestNormalizer.test.ts) (257 lines) delivering canonical input sanitization, security boundaries, and schema normalization for incoming chat requests:

1. **Input Validation & Sanitization**:
   - Validates non-null payload object.
   - Requires non-empty, non-whitespace string message up to 50,000 characters.
   - Requires non-empty string `sessionId` up to 128 characters.
   - Preserves full Unicode, astral plane emojis, and international characters without truncation or corrupted surrogate pairs.

2. **Canonical Identification & Auth Enforcement**:
   - Generates unique request ID `req_${randomUUID()}` unless authoritatively provided in server context or validly supplied by caller.
   - **Server-Authoritative Identity**: Strictly preserves `serverContext.userId` over any client-supplied claims, preventing client identity spoofing.
   - Resolves `botProfileId` to client specification, server context default, or fallback `'default'`.

3. **Context Attachment Deduplication & Size Bounds**:
   - `loadedFiles`: Deduplicated by normalized `path`. Truncates oversized file content/excerpt to `maxFileContentLength` (default 25,000 chars) and caps total file count to `maxFilesCount` (default 50).
   - `loadedAudio`: Deduplicated by normalized `path` and caps count to `maxAudioCount` (default 20).
   - `activePlan`: Supports structured `{ id, content }` and legacy `activePlanId` + `activePlanContent` pairs. Rejects malformed plan structures (empty ID or non-string content).
   - `explicitSystemInstruction`: Normalizes both `explicitSystemInstruction` and legacy `systemPrompt` (capped at 16,000 chars).

4. **Security: Prototype Pollution Prevention**:
   - Validates that `metadata` is a plain record object (rejects strings, arrays, or primitives).
   - Strips malicious prototype manipulation keys (`__proto__`, `constructor`, `prototype`).

5. **Schema Conformance**:
   - Draft output is parsed and verified by `normalizedChatRequestSchema` to guarantee strict runtime typing before entering the execution pipeline.

---

## Verification Summary
- **Unit Tests**: 21/21 passed in `src/core/chat/ChatRequestNormalizer.test.ts`.
- **Combined Regression Suite**: 47/47 passed across `chat-runtime.test.ts`, `ChatRequestNormalizer.test.ts`, `chat.test.ts`, and `ChatBehaviorBaselineHarness.test.ts`.
- **Type Check**: 0 errors across server, tests, and client (`npm run type-check`).
- **Linter**: 0 warnings/errors (`npm run lint:server`).
- **Source Size Rule**: `src/core/chat/ChatRequestNormalizer.ts` is 279 lines (< 300 line ceiling).
