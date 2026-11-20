# Start here

This bundle accompanies the **Chatbot Game Development and ROM Engineering Implementation Plan** for `DocDamage/chatbot`.

## Contents

- `IMPLEMENTATION_PLAN.md`: complete plan, baseline evidence, phase gates, integration map, edge cases, SQL/query design, native/ROM details, and full reference-source appendix.
- `AGENT_HANDOFF.md`: implementation instructions for the coding agent.
- `VALIDATION.md`: exact checks executed for this bundle and what remains unverified.
- `src/common`: canonical JSON/digests and Unicode validation.
- `src/project`: project-aware file roles and version/build parsing/resolution.
- `src/knowledge`: snapshot/chunk identity, eligibility, embedding spaces, and bounded rank fusion.
- `src/engine`: sealed proposals, capability/authority guards, durable state reducer, and evidence evaluation.
- `src/rom`: exact ROM identity, explicit address windows, checked byte edits, and patch round-trip validation.
- `sql`: additive SQLite schema and a scoped retrieval query. Apply through the app's migration ledger after integration, not manually to the live database.
- `native`: a Godot 4.7 reference observation probe and its mandatory native qualification cases.
- `tests` and `scripts`: executable TypeScript and SQLite checks using synthetic data.
- `validation`: retained compiler/test output from preparation of this bundle.

## Check the reference code

Use Node 22.12–24 and npm. The tested runtime is recorded in `VALIDATION.md`.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:sql
```

The SQL tests also require Python 3 with SQLite FTS5 support. On Windows the launcher uses `python`; elsewhere it uses `python3`. If your Python executable has another name, set the task-specific `CHATBOT_TEST_PYTHON` environment variable to its executable path. No pip dependencies are required.

This kit has **no production npm dependencies**. TypeScript and Node type definitions are development dependencies with exact versions and a lockfile. Tests use `node:test`; the application currently uses Jest, so port the cases into that suite during integration instead of making the app run two overlapping test harnesses unnecessarily.

## What this bundle does not claim

It does not install game-engine integrations, crawl documentation, start models, run a native game, or patch a commercial ROM. It supplies complete reference implementations of critical contracts and pure logic, plus concrete integration tasks. Native editors, corpus acquisition, real embedding providers, authenticated approval issuance, durable worker execution, actual BPS/IPS codecs and emulator drivers remain explicit application work.

The Godot script has been reviewed against the documented 4.7 APIs but has not been executed in a Godot runtime here. Qualify it using `native/QUALIFICATION.md` before enabling that capability. Synthetic ROM test buffers and the clearly labelled test codec are not game ROMs or real patch codecs.

## Recommended first action

Start with **G00** in the plan: preserve the current repo, establish focused regression cases, correct proposal identity and unsupported-action semantics, and prevent false verification. Continue to project profiles, versioned knowledge retrieval, and one complete Godot checkpoint workflow. Do not jump directly to a database replacement or broad claims of autonomous multi-engine support.
