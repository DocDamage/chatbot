---
name: agents
description: Always-loaded project anchor. Read this first. Contains project identity, non-negotiables, commands, and pointer to ROUTER.md for full context.
last_updated: 2026-08-10
---

# AI Chatbot Hub

## What This Is
<!-- One sentence. What does this project do?
     Length: 1 sentence maximum.
     Not a tagline — a factual description of what the software does.
     Example: "A REST API for managing inventory across multiple warehouse locations." -->

Production-oriented TypeScript/React chatbot with provider routing, RAG, memory, tools, specialist modes, and optional local desktop integrations.

## Non-Negotiables
- Never commit secrets, local `.env` files, generated databases, or credentials.
- Keep external research and local desktop actions behind explicit approval and audit paths.
- Reject private/local URL targets before calling external research tools.
- Preserve source-backed provenance when content enters RAG.

## Commands
- Dev: `npm run dev`
- Test: `npm test`; `npm run type-check:tests`
- Lint: `npm run lint:server`; `npm run lint:client`
- Build/release: `npm run build`; `npm run release:check`
- Research bridge: `npx mex-agent check`; `npm run export:skill -- docs <output>`

## Code Graph
The repo is indexed into `.mex/graph.db`. Use it to avoid re-reading code you already have — it is one tool alongside Grep/Glob, not a replacement for them.
- If you know the symbol name, go straight to it: `mex graph query <who-calls|what-calls|where-defined> <symbol>` and `mex graph get <id>` are exact and cheap. This is the strongest part of the graph. Give it exact names — an approximate name can return a confident wrong match.
- Exploring an unfamiliar task? `mex graph scope "<task>"` returns a compact JSONL manifest (`meta`, `fact`s, `summary`). Scope matches on words, not meaning: if your phrasing does not share vocabulary with the code, results will be weak. Treat it as a starting point, never as a complete answer.
- If the manifest does not clearly contain what you need, use Grep/Glob instead. Do not expand node ids that look irrelevant, and do not re-run `scope` with reworded phrasing more than once — that costs more than searching directly.
- Treat any source the graph DOES return as ALREADY READ; do not re-open those files.
- Pick 1-3 relevant node ids from the manifest and expand only those with `mex graph get <id> --detail source`.
- Before editing a symbol, run `mex impact <symbol|file>` to see affected callers and scaffold memory.
- If a result is `truncated`, do NOT repeat the broad query — narrow the task or use the summary's `suggestedNextCommands`. Scale through a few focused calls, never one giant response.
- During `mex sync`, adjudicate any AMBIGUOUS grounding; after repairs, ensure the refreshed grounding is re-emitted.

## Scaffold Growth
After meaningful work, run GROW:
- Ground: what changed in reality?
- Record: update `ROUTER.md` and relevant `context/` files
- Orient: create or update a `patterns/` runbook if this can recur
- Write: bump `last_updated` on changed scaffold files and run `mex log` when rationale matters

The scaffold grows from real work, not just setup. See the GROW step in `ROUTER.md` for details.

## Navigation
At the start of every session, read `ROUTER.md` before doing anything else.
For full project context, patterns, and task guidance — everything is there.
