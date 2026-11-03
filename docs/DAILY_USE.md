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

`verify:local` runs the built server against an isolated temporary database on port 4317. It makes real Ollama requests and checks multi-turn recall, document upload, retrieval and citations, actual process restart, the versioned APIs, history, and provider failures. It removes its temporary workspace afterwards. Build first after changing source code. Verification also restores an online backup into a separate database and checks saved history and document answers through the restarted application. Each run records its result and server log under ignored `data/local-runtime/evaluations/`.

## Configuration and recovery

- Keep `.env` private. Run `npm run kb:backup` for a consistent SQLite backup of chat history, state, and document indexes under `%LOCALAPPDATA%\Chatbot\backups\<checkout-id>` on Windows, or `data/backups` elsewhere. `RAG_BACKUP_DIR` overrides this location. The Windows default keeps the copy off the removable project drive. Copying only `chatbot.db` while the app is running can omit recent WAL transactions.
- If chat reports that its model is unavailable, start Ollama and check `ollama list`. `OLLAMA_MODEL` must match an installed model name.
- `OLLAMA_CONTEXT_TOKENS` defaults to 8192 and controls both the provider context window and the prompt budget. Larger values consume more memory.
- `CHAT_RUNTIME_ENABLED=false` restores the earlier chat route as a rollback option. Restart the server after changing configuration.
- DABOOK is enabled by setup when its local Python environment exists. Scanned PDFs still require OCR support; voice, external editors, and other specialist integrations need their own setup and validation.

## Verification commands

Canonical smoke/evaluation commands now run actual offline test suites. Knowledge list, statistics, and integrity commands inspect the configured local SQLite database. Dataset checks report failure when there are no installed manifests to inspect. `knowledge:install`, `knowledge:update`, and `chat:runtime:shadow-report` now have operational handlers; see [knowledge operations](KNOWLEDGE_OPERATIONS.md).

## Automatic startup and backups on Windows

After `npm run setup:local` and `npm run build`, run `npm run setup:daily` once.
It registers **Chatbot Local Startup** and **Chatbot Local Backup** for the current
user, with no administrator privileges, password storage, or system-wide installation.
Startup runs hidden at sign-in and uses the existing local `.env` and built application.
Ollama is started if needed. No build or model download happens at sign-in.
Run `npm run build` after updating source, then restart the startup task.

Backups run at sign-in and every day at **20:00 in the Windows local timezone**.
To choose another time, run `npm run setup:daily -- -BackupTime 18:30`.
Missed runs start when available; overlapping instances are ignored. Failed tasks
retry every five minutes for up to twelve hours, including when G: is unavailable.
Both tasks run only while this user is signed in; this is personal desktop startup,
not a machine-wide service. An occupied app port is reported rather than taking over
another process. Stop a manually started server before starting the managed task.

```powershell
npm run automation:status
Start-ScheduledTask -TaskName 'Chatbot Local Startup'
Start-ScheduledTask -TaskName 'Chatbot Local Backup'
npm run doctor:local
npm run kb:backup:verify
```

`doctor:local` includes the built server and a verified backup less than 48 hours old.
Task logs live in `data/local-runtime/startup.log` and `backup-task.log`, each with
one previous copy and a 5 MiB rotation threshold. Windows Task Scheduler records
launch failures even when the project drive is absent. `automation:status` reports
last results and next run time. Running tasks can show result 267009; successful
completed backups report 0.

`npm run automation:remove` stops and unregisters only the two tasks belonging to
this checkout. It retains the database, backups, models and configuration. You can
then return to `npm run start:local`. Sign-in behavior is exercised by starting the
registered task during setup; a real future Windows sign-in remains an operating-system check.

## Backup integrity and recovery

The shared backup command uses SQLite's online backup API, includes committed WAL
data, checks SQLite integrity, and records a SHA-256 manifest. It retains up to 30
verified backups within 14 days, always keeping the newest. Retention removes only
verified matching pairs for the same source database; unrelated, damaged and old
unmanaged files are retained for inspection. Use `-- --keep-days=30 --keep-count=60`
to change retention for an interactive backup. Scheduled runs use the defaults.

`npm run kb:backup:verify` validates the latest manifest and restores a temporary
copy without overwriting live data. An explicit manifest can be checked with
`npm run kb:backup:verify -- --manifest=C:/path/to/chatbot-TIMESTAMP-ID.json`.
For real recovery, stop the startup task and app first, move the existing database
and its matching WAL/SHM files aside together, and copy the verified backup database
to `RAG_SQLITE_PATH` before restarting. Do not replace a database while it is open.

These backups contain chat history/state and indexed document content. They do not
back up arbitrary original documents, model downloads, optional tool environments,
source code, or `.env`. Backups are private plaintext user data: protect their folder
and keep an additional copy outside this PC for machine-loss recovery.

## Compare local coding models

Install `qwen3:8b` and `qwen3-coder:30b` in Ollama, then run
`npm run compare:coding-models`. The command downloads nothing and changes no default. `-- --probes-only --models=qwen3-coder:30b,qwen3:8b` repeats only throughput probes in reverse order without rerunning integration cases.
It runs the same nine integration cases, including references, structural edits,
documentation, bug repair, multi-file edits, executable/mutation-tested tests,
TypeScript context, fast-check properties and iterative repair, once per model.
Separate fixed-prompt probes record load time, token throughput and VRAM residency.
Probe outputs can reach their token ceiling and are not scored for coding quality;
actual executed integration tests determine pass/fail. Reports and logs are under
ignored `data/coding-tools/comparison-*`. End-to-end timings include tool startup
and network documentation retrieval. This is a local fixture comparison, not a
claim about arbitrary projects. `CODING_OLLAMA_MODEL` can select coding separately
from ordinary `OLLAMA_MODEL` chat. Keep the existing context budgets unless measured
memory use and task quality justify changing them.

## Recorded daily-use configuration

On the tested i5-14600K / 48 GB / RTX 3060 12 GB machine, Qwen3-Coder 30B passed
all nine coding integration cases; qwen3:8b passed eight and produced no patch for
the property-test case. Median idle decode rates were about 21 and 60 tokens/s.
This PC uses `CODING_OLLAMA_MODEL=qwen3-coder:30b` and keeps `OLLAMA_MODEL=qwen3:8b`
for ordinary chat. Those private settings are not committed or forced on other PCs.
See [November 2 evidence](implementation/evidence/daily-use/2026-11-02/README.md).
