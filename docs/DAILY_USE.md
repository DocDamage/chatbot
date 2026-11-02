# Daily local use

This setup runs the chatbot on your computer with Ollama. The supported daily-use target is personal chat, conversation history, and answers from your local documents. Specialist and desktop tools retain their existing approval rules and experimental status.

## Start

From the repository root, run:

```powershell
npm run start:local
```

Open <http://127.0.0.1:3001>. Keep the terminal running; press Ctrl+C there to stop the application.

On first run, setup creates an ignored `.env` with a random signing secret and selects an installed Ollama model, preferring `qwen3:8b`. It starts Ollama if needed. Existing configuration is preserved. Setup does not download models or configure a paid API. The application listens on loopback.

Use **New chat** to start a separate conversation and **History** to reopen a saved one. Reopened conversations continue under their original session ID. Successful replies and references are saved to `data/chatbot.db`; restarting the server preserves them.

Normal chat uses the canonical runtime. It includes bounded conversation history and attachment content, retrieves local evidence without generating an extra answer, and shows references only for sources the answer actually cites. A model failure returns an error instead of a fabricated success. The server reports degraded readiness when Ollama is unavailable or the selected model is missing.

The local browser obtains a short-lived local session automatically. Local sign-in is unavailable in hosted, development, and test profiles and when the server is configured to listen on all interfaces. This convenience is for a trusted single-user computer.

## Check the installation

```powershell
npm run doctor:local
npm run verify:local
```

`doctor:local` checks the selected model, database integrity, conversation-state table, and application readiness.

`verify:local` runs the built server against an isolated temporary database on port 4317. It makes real Ollama requests and checks multi-turn recall, document upload, retrieval and citations, actual process restart, the versioned APIs, history, and provider failures. It removes its temporary workspace afterwards. Build first after changing source code.

## Configuration and recovery

- Keep `.env` private. Run `npm run kb:backup` for a consistent SQLite backup of chat history, state, and document indexes under `data/backups`. Copying only `chatbot.db` while the app is running can omit recent WAL transactions.
- If chat reports that its model is unavailable, start Ollama and check `ollama list`. `OLLAMA_MODEL` must match an installed model name.
- `OLLAMA_CONTEXT_TOKENS` defaults to 8192 and controls both the provider context window and the prompt budget. Larger values consume more memory.
- `CHAT_RUNTIME_ENABLED=false` restores the earlier chat route as a rollback option. Restart the server after changing configuration.
- DABOOK is enabled by setup when its local Python environment exists. Scanned PDFs still require OCR support; voice, external editors, and other specialist integrations need their own setup and validation.

## Verification commands

Canonical smoke/evaluation commands now run actual offline test suites. Knowledge list, statistics, and integrity commands inspect the configured local SQLite database. Dataset checks report failure when there are no installed manifests to inspect. `knowledge:install`, `knowledge:update`, and `chat:runtime:shadow-report` explicitly return an unsupported-operation error until operational handlers exist; they do not claim work was performed.
