# Research and desktop companion integrations

Related upstream projects: [PyScrappy](https://github.com/DocDamage/PyScrappy), [E.V. assistant](https://github.com/DocDamage/ev-assistant), [mex](https://github.com/DocDamage/mex), and [book-to-skill](https://github.com/DocDamage/book-to-skill). The broader capability review and implementation boundaries are documented in [capability-workspaces.md](capability-workspaces.md).

## mex

`mex` is a development-time project-context layer. Run `npx mex-agent graph` from the repository root to refresh `.mex/graph.db`, then use `npx mex-agent scope "your task"` or `npx mex-agent check` when working on the codebase. The database is ignored because it is generated and can be rebuilt locally.

The chatbot does not depend on mex during production startup.

## PyScrappy

PyScrappy remains an external Python/MCP process. Install its MCP extra separately and set:

```env
PYSCRAPPY_ENABLED=true
PYSCRAPPY_MCP_COMMAND=pyscrappy-mcp
PYSCRAPPY_MCP_ARGS=[]
```

The chatbot exposes the capability only when configured. The `scrape_web_page` tool and `/api/research/scrape` route reject non-HTTP(S), localhost, private-network, and link-local targets. Results are capped before they enter the model context. The existing online-knowledge approval flow should be used when scraped material is persisted into RAG.

## book-to-skill-compatible export

`npm run export:skill -- <source-file-or-directory> <output-directory>` creates `SKILL.md`, a chapter directory, and lightweight glossary/cheatsheet files. It is deterministic and source-preserving; it does not pretend that a generated summary is authoritative. The resulting bundle can be refined or consumed by an Agent Skills-compatible coding host while the chatbot continues to ingest the original documents through RAG.

## Desktop voice companion

The Electron app in `desktop-companion/` uses browser speech recognition and speech synthesis where the installed Chromium/OS provider supports them. Typed input remains available. Each companion install stores one session ID locally and sends turns to the normal `/api/chat` endpoint, so server-side conversation persistence and the chatbot's existing modes remain in charge.

The companion does not execute arbitrary desktop commands. File, process, and application actions must continue through the chatbot's local-tools plan/approval/start flow.

## Verified local setup

The optional PyScrappy MCP extra is installed in the ignored `.venv-pyscrappy/` environment and exposes `scrape_url`. The chatbot server has been exercised through `/api/research/status` and `/api/research/scrape` against `https://example.com`. The Electron companion dependencies install cleanly and report Electron `v43.3.0`; microphone permission and OS speech-provider behavior still require manual desktop validation.
