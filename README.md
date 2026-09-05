# AI Chatbot Hub

AI Chatbot Hub is a TypeScript/React chatbot workspace with provider adapters, specialist modes, memory, RAG, creative workflows, local development tools, and a repository-aware coding workflow.

## Current status

The implementation is active and suitable for local development, evaluation, and trusted internal use. It includes the complete **Capability Fusion (CF-01 through CF-10)** stack with persistent disk observability, process supervisors, native Git worktrees, Playwright browser drivers, media localization, Lattice game development tools, and multi-domain canary certification.

- Canonical branch: `main`.
- Latest implementation line: Capability Fusion (CF-01 to CF-10), Canary Certification Suite, polyglot repository-aware coding, structural retrieval, safe structured edits, verification, bounded repair, and review.
- Coding and desktop/local filesystem capabilities are gated via explicit RBAC and exact-scope confirmation.
- Full automated Jest suite: 182 suites passed, 696 tests passed, 2 skipped, 0 failures.
- Client Vitest suite: 31 files passed, 96 tests passed.
- Production server & client build and packaging smoke checks pass.

For release decisions, use the [current project status](docs/PROJECT_STATUS.md), [production feature manifest](docs/implementation/PRODUCTION_FEATURE_MANIFEST.md), [master completion tracker](docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md), and [release evidence index](docs/implementation/RELEASE_EVIDENCE_INDEX.md). Historical documents are retained for audit context and do not override those sources.

## Capabilities

- **Conversation & Specialist Modes**: Conversation-first chat with Ask, Plan, Build, Debug, and Explain modes, plus specialist workflows for creative writing, gaming, GIS, research, Knowledge OS, engineering, and health.
- **Provider Abstraction (CF-04)**: OpenAI-compatible, Anthropic, Gemini, DeepSeek, Ollama, HuggingFace, and dynamic local model endpoint adapters (`ExternalLocalModelAdapter`) with VRAM/RAM leases, SSRF guards, and fallback routing.
- **Typed Agent Teams & Isolated Worktrees (CF-05)**: Multi-agent coordination with cryptographic task envelopes, authority matrices, native Git worktree sandboxing, and bounded child-process tree supervisors (`ProcessTreeSupervisor`).
- **Transparent Browser Jobs (CF-06)**: Playwright-powered browser automation (`PlaywrightBrowserDriver`) with origin allowlists, state-changing cryptographic approval gates, automated trace `.zip` recordings, and video/HAR logging.
- **Consent-Aware Video Localization (CF-07)**: Staged 12-step media localization pipeline with cryptographic consent verification (`MediaConsentRecord`), voice cloning authorization gates, disk-budgeted sandboxing, and production FFmpeg adapters (`ProductionMediaEngineAdapter`).
- **Deterministic Lattice Game Development (CF-08)**: Deterministic Mulberry32 PRNG simulation engine with collision resolution, turn replays, non-visual ASCII/Markdown matrices, isometric SVG renderers, and specialist agent tool definitions (`simulate_lattice_game`, `render_lattice_scenario`).
- **Unified Capability Hub & Governance (CF-09)**: Real-time capability inventory, maturity stages, exact-scope confirmation dialogs with WCAG 2.1 AA focus containment, and authenticated JWT Bearer API communication.
- **Persistent Observability & Promotion Gates (CF-10)**: Append-only disk persistence (`CapabilityPersistenceStore`), live SLO monitoring, error budget tracking, webhook alerting (`AlertNotificationDispatcher`), and automated degradation rollbacks.
- **Multi-Domain Canary Certification Suite**: Automated end-to-end certification harness verifying hardware probing, worktree/process isolation, browser execution, media processing, gaming simulation, authorization, and persistent observability.
- **Repository-Aware Coding**: Polyglot capability detection, manifests, instructions, symbol/relationship indexing, structural retrieval, adaptive context allocation, preconditioned multi-file patches, diagnostics, verification, repair, and review.

## Local development

### Prerequisites

- Node.js 22.12 or newer (Node.js 22 and 24 LTS are supported).
- npm.
- Ollama for local models, or credentials for a supported remote provider.
- Optional native tools only for the local features that need them.

### Install

```bash
npm ci
npm --prefix client ci
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Configure only the providers and integrations you intend to use. Never commit `.env`, API keys, or files from the `API Keys` directory.

### Run the development app

```bash
npm run dev
```

- Client: <http://localhost:3000>
- API: <http://localhost:3001>

### Run the built local app

```bash
npm run build
npm start
```

Open <http://localhost:3001>. A successful local build is not production certification.

## Coding workflow

The coding workflow is intended for a trusted local workspace. It can:

1. Inspect repository instructions, manifests, build systems, symbols, relationships, diagnostics, and tests.
2. Allocate evidence to the selected model according to task intent and context budget.
3. Produce an unauthorized structured patch for review.
4. Apply changes only through explicit authorization and file preconditions.
5. Run supported verification commands, report unavailable toolchains honestly, and perform bounded repair/review flows.

Credential paths are excluded from repository discovery, reads, and edits. The coding workflow does not provide a hosted sandbox or certify arbitrary code execution.

## Provider configuration

Provider secrets belong in local environment configuration, not in source or documentation. Common variables include:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

The explicitly authorized coding benchmark supports `openai`, `gemini`, and `deepseek` through `CODING_EVAL_PROVIDER` and `CODING_EVAL_MODEL`. Benchmark network access is disabled unless `--live-model` is explicitly supplied.

## Verification commands

```bash
npm run type-check:server
npm run type-check:tests
npm run lint:server
npm test -- --runInBand
npm run build
npm run test:security
npm run test:e2e:services
npm run check:phase2
npm run release:check
npm run audit:release
```

`release:check` is the automated behavioral gate. `audit:release` orchestrates all 18 handbook groups, packages the artifact, and records the explicit release decision. Do not lower or bypass thresholds or set lifecycle attestation variables without their supporting evidence.

## Deployment boundaries

See [Deployment Modes](docs/DEPLOYMENT_MODES.md).

- Local development and built-local runs are not production deployments.
- GitHub Pages is a static demo unless connected to a separately deployed API.
- Local filesystem, command execution, Sprite Lab, FL Studio, desktop capture, and similar integrations must remain local-only until separately certified.
- A market release still requires hosted architecture, authentication and tenancy review, secrets management, TLS, backups, monitoring, rollback, abuse controls, provider canaries, cross-platform QA, and release-candidate sign-off.

## Documentation map

- [Project status and next release work](docs/PROJECT_STATUS.md)
- [Quickstart](docs/guides/QUICKSTART.md)
- [Setup guide](docs/guides/SETUP_GUIDE.md)
- [Setup prerequisites](docs/guides/SETUP_PREREQUISITES.md)
- [Deployment modes](docs/DEPLOYMENT_MODES.md)
- [Production feature manifest](docs/implementation/PRODUCTION_FEATURE_MANIFEST.md)
- [Master production tracker](docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md)
- [Polyglot coding plan](docs/implementation/POLYGLOT_CODING_CAPABILITY_UPGRADE_PLAN.md)
- [Coding benchmark evidence](docs/implementation/evidence/coding-upgrade/)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Release audit automation](docs/RELEASE_AUDIT_AUTOMATION.md)

## Contributing

Keep user-facing documentation aligned with the feature manifest and release evidence. Do not describe an implementation as production-supported unless the relevant feature record and exact-commit evidence say so. Run the applicable type-check, lint, test, build, security, and release checks before publishing changes.

## License

MIT
