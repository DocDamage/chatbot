# AI Chatbot Hub — Current Project Status

Updated: 2026-10-30 (America/New_York)

## Personal daily-use checkpoint

The current implementation branch is `codex/daily-use-readiness`, based on `feat/dabook-integration` at `e19cfea`. It prepares the app for a personal local daily-use trial with Ollama. This is a local-use checkpoint, not hosted-production certification.

Implemented changes:

- Normal browser chat and versioned chat use the canonical runtime with the real configured provider.
- Bounded conversation history, attachment content, and persistent conversation variables reach the model prompt.
- Conversation state uses the existing SQLite/PostgreSQL abstraction. The application reports persistence failures instead of silently claiming durable storage.
- History is available in the main UI; reopening a conversation restores its original session ID. New chat creates a separate session.
- Explicit local mode provides short-lived local browser authentication, restricted to the loopback application origin. Other deployment profiles retain their existing authentication requirements.
- Document retrieval does not generate a second answer. SQLite search has a bounded, ranked fallback for natural questions whose framing words are absent from a source.
- Citations resolve to evidence actually supplied to the model and cited in its response. Saved replies preserve source cards and warnings.
- Provider failures return HTTP 503 rather than placeholder answers. Readiness reflects unavailable Ollama models.
- Operational CLI commands run actual checks or inspect the local database. Unsupported installation, update, and shadow-report commands fail explicitly.
- `setup:local`, `start:local`, `doctor:local`, and `verify:local` provide a repeatable local workflow.

## Verification

Real Ollama verification passed generation, multi-turn recall, document upload/retrieval/citations, actual server restart, versioned APIs, history persistence, and provider-failure behavior using an isolated temporary database. The browser also reopened a conversation after restarting the main server and correctly recalled its project name.

Server/client/test type checks, server/client lint, 198 client tests, six browser accessibility checks, operational CLI smoke, packaging smoke, database backup, and repository policy checks passed. The broad server run passed 2,957 tests and found two outdated test-fixture failures. Both were corrected and their complete suites passed a 25-test rerun with open-handle detection; two additional operational database checks also passed. Seven built-server browser regression tests passed. See [the verification record](implementation/evidence/daily-use/2026-10-30/verification.json) for the exact scope and results.

## Start and maintain

Run `npm run start:local`, then open <http://127.0.0.1:3001>. Use `npm run doctor:local` to inspect readiness and `npm run kb:backup` for a consistent database backup. See [Daily local use](DAILY_USE.md) for configuration, rollback, and limitations.

## Remaining boundaries

Scanned-PDF OCR and DABOOK Phase 5 remain unfinished. External editors, voice, media workflows, and other specialist capabilities need separate setup and validation. Hosted deployment and public commercial release remain uncertified. The September handoff's program-completion statement does not establish end-to-end production readiness.

The master production tracker and feature manifest retain their production-release authority; this daily-use work does not promote experimental capabilities or close unrelated production tasks. The earlier Capability Fusion integration remains associated with GitHub PR #171.
