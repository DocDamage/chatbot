# AI Chatbot Hub — Implementation Handoff (Archive)

## Status

- Repository: `DocDamage/chatbot`
- Branch: `codex/cf04-cf10-integration`
- Active Program: Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- Task Completed: `CRK-P22-T05` — Voice and External Input/Output Adapters Exit Gate (`VERIFIED & CERTIFIED`)
- Base Commit: `178224d`
- Exit Gate Evidence: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P22/CRK-P22-T05/2026-09-04_178224d/`

---

## Deliverables Summary

1. **Input Adapter Contracts & Schemas (CRK-P22-T01 to T05)**:
   - `src/types/input-adapters.ts` (90 lines)
   - Typed contracts for `ChatInputAdapter`, `VoiceInputPayload`, `SpeechToTextMetadata`, `TextToSpeechResult`, `AudioRetentionPolicy`, `IntegrationMessagePayload`.
   - Unit tests: `src/types/input-adapters.test.ts` (3/3 passed).

2. **Voice Input Adapter (CRK-P22-T01, T02, T04, T05)**:
   - `src/core/adapters/VoiceInputAdapter.ts` (72 lines)
   - Validates explicit microphone consent before audio/transcript processing.
   - Enforces zero-retention audio buffer policies.
   - Separates STT provider/model metadata from downstream chat model metadata.

3. **Voice Output Adapter (CRK-P22-T03, T04)**:
   - `src/core/adapters/VoiceOutputAdapter.ts` (45 lines)
   - Converts canonical `ChatRuntimeResult` into speech synthesis parameters.
   - Preserves strict invariant: text-to-speech generation never modifies, truncates, or alters canonical response text.

4. **Chat Input Adapter Factory (CRK-P22-T01, T04)**:
   - `src/core/adapters/ChatInputAdapterFactory.ts` (86 lines)
   - Concrete adapters for `web`, `voice`, `integration` (e.g. Slack/GitHub), and `desktop_companion`.
   - Channels all entry points into `NormalizedChatRequest`.

5. **Phase 22 Exit Gate Suite**:
   - `src/core/adapters/__tests__/voice-external-adapters.test.ts` (7/7 passed).
