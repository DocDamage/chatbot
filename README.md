# AI Chatbot Hub

AI Chatbot Hub is a broad TypeScript/React chatbot application with provider abstraction, specialist modes, memory, RAG, local-development tools, creative workflows, and operational endpoints.

> **Release classification:** This repository is under a formal production-completion program. It is not currently certified as production-ready. At the `P00-T02` classification baseline, commit `027eacd948cadb0f8b749385c51acd13a287051c` dated `2026-08-04`, the manifest contained 136 records: 0 `PRODUCTION_SUPPORTED`, 105 `PRODUCTION_PREVIEW`, 24 `LOCAL_ONLY_EXPERIMENTAL`, and 7 `DISABLED_OR_REMOVED`.

## Authoritative release status

Use these files for current release decisions:

- [Master Production Completion Tracker](docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md) — authoritative task status.
- [Production Feature Manifest](docs/implementation/PRODUCTION_FEATURE_MANIFEST.md) — authoritative feature boundary and support category.
- [Release Evidence Index](docs/implementation/RELEASE_EVIDENCE_INDEX.md) — commit-bound evidence for verified tasks.

The older May 2026 status, audit, and feature-tracker documents are historical snapshots. Their former `Fixed` or `Verified` labels describe implementation or checks performed at the time; they do not certify current manual QA, deployment verification, security review, backup/restore, accessibility, provider canaries, or production support.

### Verification vocabulary

- **Implemented:** code or documentation exists; no verification is implied.
- **Automated-verified:** named automated checks passed against a stated commit and date.
- **Manual-verified:** a documented human runtime workflow passed against a stated commit, environment, and date.
- **Deployment-verified:** the intended deployed environment passed smoke, dependency, persistence, security, and operational checks against a stated commit and date.
- **Production-supported:** all applicable release gates are verified and recorded in the manifest and evidence index.
- **Production preview:** implemented or reachable, but one or more release gates remain unverified.
- **Local-only experimental:** intended only for a trusted local machine and not approved for hosted exposure.
- **Disabled or removed:** not reachable in the supported product surface.

## Feature overview

The repository contains or explores:

- Ollama and remote LLM provider adapters.
- Specialist chat modes and routing.
- Conversation, memory, RAG, provenance, and validation services.
- Creative writing, gaming, GIS, SEC, Knowledge OS, and other specialist workflows.
- File, audio, coding, local-tool, Sprite Lab, and desktop-integration features.
- Health, metrics, administration, export, webhook, and deployment support.

Presence in the repository does not establish production support. Consult the feature manifest before relying on a capability.

## Architecture

```text
Client → Gateway → Router/Orchestrator → Contract Gate
       → State Snapshot → Memory/RAG → Specialist Agent
       → Validators → Persistence/Provenance → Response
```

## Getting started for development evaluation

### Prerequisites

- Node.js 20 LTS or newer.
- npm.
- Ollama for local text generation, or a configured supported remote provider.
- Optional native tools only for the local features that require them.

### Install

```bash
npm ci
npm --prefix client ci
```

Copy the canonical [`.env.example`](.env.example) to `.env` and supply development-safe values. Follow [Setup Prerequisites](docs/guides/SETUP_PREREQUISITES.md) for OS-specific and optional native dependencies. Do not reuse production secrets.

Typical local settings include:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=replace-with-at-least-32-random-characters
CORS_ORIGIN=http://localhost:3000
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
LOG_LEVEL=info
```

### Development mode

```bash
npm run dev
```

- Client: `http://localhost:3000`
- API: `http://localhost:3001`

### Client layout

The default client opens to a focused, conversation-first chat view with a small set of practical modes: Ask, Plan, Build, Debug, and Explain. Provider configuration and advanced tools are intentionally kept behind the gear-shaped **Settings** menu. Use **Open advanced workspace** there when you need specialist modes, file/audio context, research, local tools, GIS, DAW controls, or Sprite Lab.

### Built local evaluation

```bash
npm run build
npm start
```

Then open `http://localhost:3001`. This proves only that the documented local build/start path works when it is actually run successfully. It does not by itself prove production deployment readiness.

## Deployment boundaries

See [docs/DEPLOYMENT_MODES.md](docs/DEPLOYMENT_MODES.md).

- A local development or built-local run is not a production deployment.
- GitHub Pages or another static host is only a static demo unless it is deliberately connected to a separately deployed API.
- Local filesystem, local command, Sprite Lab, FL Studio, and similar desktop integrations must remain local-only unless a later verified task changes their classification.
- Production architecture, database, Redis, secrets, TLS, backups, monitoring, rollback, and provider support remain subject to later tasks and ADRs.

## Current API examples

### `POST /api/chat`

```json
{
  "message": "Hello",
  "sessionId": "unique-session-id",
  "userId": "optional-user-id"
}
```

The exact response shape and authorization policy must be taken from the current implementation and API documentation. Example payloads are not release certification.

### Knowledge expansion and deep research

When local confidence is too low, the chatbot can ask permission to search the internet. The approved research flow searches the selected category plus related categories, reviews up to twelve accepted sources, fetches readable page evidence when available, and produces a cited synthesis. The UI shows a final review containing the synthesis, sources, and cross-category searches before **Save to Knowledge Base** becomes available.

Saved research is persisted through the normal `DocumentManager`/RAG path with source URLs, retrieval time, approval identity, primary and related category tags, cross-reference metadata, content hashes, and rollback information. Full webpages are not copied blindly; the stored research artifact is a synthesized, source-grounded document plus bounded evidence excerpts.

The research endpoint is `POST /api/knowledge-online/research` with `{ "query": "...", "domain": "gaming" }`. Saving still requires the existing explicit approval endpoint.

### Health endpoints

The repository includes health endpoints such as `/health`, `/health/live`, and `/health/ready`. Their operational meaning must be verified in the intended deployment before production use.

## Security note

Privileged and local-only routes must not be exposed based solely on README examples. Authentication, authorization, CSRF, CORS, path safety, upload policy, outbound-request policy, local execution, secret handling, and audit controls remain subject to the production-completion tracker.

## Project structure

```text
.
├── src/                         # Server, core services, providers, policies, types
├── client/                      # React/Vite client
├── config/                      # Production boundary and release configuration
├── scripts/release/             # Reproducible inventories and Phase 2 policy checks
├── docs/architecture/generated/ # Generated repository and reachability evidence
├── docs/implementation/         # Authoritative production-completion governance
├── docs/                        # Product, setup, and historical documentation
└── package.json                 # Root scripts and dependencies
```

## Contributing

Do not describe a merged feature as production-supported unless the feature manifest and evidence index show that status against an exact commit. New production-completion work must follow the one-task, one-thread handoff process in `docs/implementation/handoffs/CURRENT_HANDOFF.md`.

## Optional local integrations

- [PyScrappy](https://github.com/DocDamage/PyScrappy): guarded MCP research through `/api/research` when explicitly enabled.
- [mex](https://github.com/DocDamage/mex): development-time code graph and drift checks; not required at runtime.
- [book-to-skill](https://github.com/DocDamage/book-to-skill): source-preserving documentation export via `npm run export:skill`.
- [E.V. assistant](https://github.com/DocDamage/ev-assistant): related local voice-assistant reference; this repository's Electron companion reuses `/api/chat` and does not execute arbitrary desktop commands.

See [docs/integrations/research-and-companion.md](docs/integrations/research-and-companion.md) for setup, boundaries, and verification evidence.

## License

MIT
