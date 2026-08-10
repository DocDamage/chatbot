# Desktop Companion

This is an optional Electron shell for the existing AI Chatbot Hub. It keeps the conversation and memory in the chatbot server by using the normal `/api/chat` endpoint; it does not create a second LLM, memory store, or tool policy.

## Run

1. Start the chatbot server from the repository root with `npm run dev:server`.
2. In this directory, run `npm install` once.
3. Run `npm start`.
4. Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space`) to hide/show the companion.

The companion uses Electron's Chromium speech APIs for microphone input and speech synthesis for replies. Availability depends on the installed OS speech provider. Typed input always remains available. For offline Whisper or richer TTS, the existing server-side `VoiceAgent` can be extended later without changing the companion's chat contract.

Desktop control is intentionally not implemented directly here. Commands that can affect files, processes, or applications should flow through the chatbot's existing local-tools planning and approval endpoints.
