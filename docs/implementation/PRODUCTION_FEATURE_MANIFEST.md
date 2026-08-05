# Production Feature Manifest

> Authoritative Phase 0 classification of the currently discovered product surface. This file records what is reachable or present; it does **not** certify production readiness.

## Manifest metadata

- Repository: `DocDamage/chatbot`
- Baseline branch: `main`
- Baseline commit inspected: `ea1257ea07c83d36b82e079c7ab408fa33f2b737`
- Manifest task: `P00-T02`
- Working branch: `agent/p00-t02-production-feature-manifest`
- Created: `2026-08-04`
- Release version: `Unscheduled`
- Runtime QA evidence at creation: none for the assembled production deployment

## Classification rules

Exactly four status categories are permitted:

- `PRODUCTION_SUPPORTED`: fully verified against the production-completion definition.
- `PRODUCTION_PREVIEW`: implemented or reachable, but missing one or more production gates, runtime evidence, security proof, accessibility proof, provider canary, recovery proof, or deployment certification.
- `LOCAL_ONLY_EXPERIMENTAL`: intended for a trusted local machine or desktop integration and not approved for hosted exposure.
- `DISABLED_OR_REMOVED`: not registered/reachable, intentionally hidden, or default-denied until a later task gives it a dedicated manifest record and verification path.

The classification is deliberately conservative. A route, component, test file, provider adapter, or successful build does not by itself prove production support. Because the current release program has not completed CI restoration, security hardening, accessibility verification, deployment certification, backup/restore, provider canaries, or full manual QA, **no feature is classified as `PRODUCTION_SUPPORTED` in this baseline manifest**.

## Status summary

| Status category | Count |
|---|---:|
| `PRODUCTION_SUPPORTED` | 0 |
| `PRODUCTION_PREVIEW` | 105 |
| `LOCAL_ONLY_EXPERIMENTAL` | 24 |
| `DISABLED_OR_REMOVED` | 7 |
| **Total records** | **136** |

## Feature records

Coverage wording is descriptive, not a pass claim. “Present” means a test or eval file/path was found; the release gate remains uncertified unless the runtime-evidence column cites a committed evidence bundle.

| Feature ID | User-visible name | Route(s) / entry point | Component(s) | Service(s) | Persistence | Required role | Hosted/local availability | Status category | Automated test coverage | Runtime QA evidence | Release version |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `CORE-001` | Web application shell | `/` and client catch-all | `App`, `AssistantChat`, `SettingsMenu`, `LocalToolsWorkspace` | Express static serving; React/Vite client | Browser state only | Public UI; backend actions inherit API policy | Hosted + local; static Pages is client-only | `PRODUCTION_PREVIEW` | Component tests present; full browser QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-002` | Core chat API | `POST /api/chat` | `AssistantChat` | Legacy chat handlers; orchestrator; conversation manager | Conversation/session database when enabled | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Route/service/E2E-mock tests present; current release gate not certified | None recorded at baseline | `Unscheduled` |
| `CORE-003` | Version 1 chat API | `/api/v1/*` | No dedicated UI; compatibility API | v1 chat router; orchestrator | Conversation/session database when used | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Route coverage exists indirectly; no production canary | None recorded at baseline | `Unscheduled` |
| `CORE-004` | Version 2 chat API | `/api/v2/*` | No dedicated UI; compatibility API | v2 chat router; orchestrator | Conversation/session database when used | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Route coverage exists indirectly; no production canary | None recorded at baseline | `Unscheduled` |
| `CORE-005` | Authentication and role enforcement | Middleware on privileged routes | No visible login/bootstrap component in active app shell | Bearer auth, role checks, CSRF state-change middleware | Token/session state outside active UI | Authenticated / developer / admin by route | Hosted + local | `PRODUCTION_PREVIEW` | Security tests present; end-to-end login/bootstrap QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-006` | Runtime provider settings | `GET, PUT /api/settings` | `SettingsMenu` | Settings route; service reinitializer; provider adapters | Process environment; update is explicitly non-persistent | Admin | Hosted + local; hidden functionality not role-gated in client | `PRODUCTION_PREVIEW` | Component test and route tests present; secure persistence/rotation QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-007` | Health and dependency status | `GET /health`, `/health/ready`, `/health/live` | `StatusBar` consumes readiness | Health route; dependency probes | None | Public | Hosted + local | `PRODUCTION_PREVIEW` | Health route tests present; deployment readiness not certified | None recorded at baseline | `Unscheduled` |
| `CORE-008` | Application metrics | `GET /api/metrics`, `/metrics` | No production dashboard UI | Metrics collector; Prometheus exporter | In-memory metrics | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Route behavior exists; access control and operations QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-009` | API documentation | `GET /api-docs` | No rendered docs UI | OpenAPI YAML reader | Tracked OpenAPI file | Public | Hosted + local | `PRODUCTION_PREVIEW` | No current completeness certification against all routes | None recorded at baseline | `Unscheduled` |
| `CORE-010` | Conversation management | `GET /api/conversations`, `GET/DELETE /api/conversations/:sessionId` | `ConversationToolsPanel` | ConversationManager | SQLite/PostgreSQL when configured | Authenticated | Hosted + local | `PRODUCTION_PREVIEW` | API/client tests present; ownership/IDOR release evidence absent | None recorded at baseline | `Unscheduled` |
| `CORE-011` | Conversation sharing | `POST /api/conversations/:sessionId/share`, `GET /api/share/:shareId` | `ConversationToolsPanel` | ConversationSharingService | Service-defined share store | Create: authenticated; read: public/password | Hosted + local | `PRODUCTION_PREVIEW` | Component/API tests present; revocation/ownership runtime QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-012` | Message feedback | `POST /api/feedback`, `GET /api/feedback/:messageId` | Conversation tools / message workflow | FeedbackService | Service-defined store | Submit: authenticated; read: public | Hosted + local | `PRODUCTION_PREVIEW` | No complete release evidence | None recorded at baseline | `Unscheduled` |
| `CORE-013` | Custom instructions | `GET, PUT /api/user/instructions` | No dedicated active panel identified | CustomInstructionsService | Service-defined store | Authenticated | Hosted + local | `PRODUCTION_PREVIEW` | No complete release evidence | None recorded at baseline | `Unscheduled` |
| `CORE-014` | Quick replies | `GET /api/chat/quick-replies` | `ConversationToolsPanel` | QuickRepliesService; active LLM adapter | None | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Component/API coverage present; provider failure QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-015` | File upload and document ingestion | `POST /api/upload` | No direct upload control in active app shell | Multer; FileProcessor; DocumentManager | RAG/document persistence when enabled | Authenticated | Hosted + local | `PRODUCTION_PREVIEW` | Some route/security coverage; upload hardening and parser matrix incomplete | None recorded at baseline | `Unscheduled` |
| `CORE-016` | Document metadata search | `GET /api/documents/search` | No dedicated active panel identified | DocumentMetadataManager | Service-defined metadata store | Authenticated | Hosted + local | `PRODUCTION_PREVIEW` | No complete release evidence | None recorded at baseline | `Unscheduled` |
| `CORE-017` | Tool registry discovery | `GET /api/tools`, `/api/tool-catalog/*` | No general tool catalog panel | ToolRegistry; tool catalog router | Tool metadata/database where used | `/api/tools`: public; catalog: developer | Hosted + local | `PRODUCTION_PREVIEW` | Route tests present; authorization/runtime QA incomplete | None recorded at baseline | `Unscheduled` |
| `CORE-018` | Free-model registry | `GET /api/models/free` | Settings/provider UI | FreeModelRegistry | None | Public | Hosted + local | `PRODUCTION_PREVIEW` | No live model capability certification | None recorded at baseline | `Unscheduled` |
| `CORE-019` | Debug request inspection | `GET /api/debug/:requestId` | Debug mode chat only; no dedicated inspector panel | DebugMode | In-memory/service-defined debug state | Authenticated | Hosted + local | `PRODUCTION_PREVIEW` | No release evidence for redaction or ownership | None recorded at baseline | `Unscheduled` |
| `CORE-020` | Reasoning endpoint | `POST /api/reasoning/chain-of-thought` | No dedicated panel | ReasoningEngine; active LLM adapter | None | Authenticated | Hosted + local | `PRODUCTION_PREVIEW` | No privacy/safety/runtime certification | None recorded at baseline | `Unscheduled` |
| `CORE-021` | WebSocket realtime server | WebSocket upgrade on application server when enabled | No explicit realtime client surface identified | WebSocketServer | Connection state only | Unspecified in current initialization | Hosted + local when enabled | `PRODUCTION_PREVIEW` | No authenticated multi-client release evidence | None recorded at baseline | `Unscheduled` |
| `CORE-022` | Administration APIs | `/api/admin/*` | No admin console in active app shell | Admin router; cache/log/health services | Varies by operation | Admin | Hosted + local | `PRODUCTION_PREVIEW` | Admin route tests present; manual operations QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-023` | Administrative exports | `/api/export/*` | No export console in active app shell | Export router | Filesystem/generated exports | Admin | Hosted + local | `PRODUCTION_PREVIEW` | Route-level tests only; privacy/size/runtime QA absent | None recorded at baseline | `Unscheduled` |
| `CORE-024` | Webhook management | `POST/GET /api/webhooks`, `DELETE /api/webhooks/:id` | No webhook UI | WebhookService; outbound URL validator | Service-defined registry | Admin | Hosted + local | `PRODUCTION_PREVIEW` | SSRF validation tests exist; signing/retry/runtime QA incomplete | None recorded at baseline | `Unscheduled` |
| `CORE-025` | Static GitHub Pages client | Pages deployment/client static build | Backend panels hidden by `isStaticPagesBuild` | Vite static build only | Browser-only | Public | Static demo only | `PRODUCTION_PREVIEW` | Build workflow exists but production backend is absent and deployment was not certified | None recorded at baseline | `Unscheduled` |
| `UI-001` | Main assistant chat workspace | `POST /api/chat`, health and supporting APIs | `AssistantChat` | Chat orchestration and panel composition | Browser state + conversation persistence | Public UI | Hosted + local; reduced in static demo | `PRODUCTION_PREVIEW` | `AssistantChat` tests present; current client suite not certified | None recorded at baseline | `Unscheduled` |
| `UI-002` | Mode selector | Mode field in chat request | `ModeSelector` | Mode routing/system prompts | Browser state | Public UI | Hosted + local | `PRODUCTION_PREVIEW` | Component tests present; full keyboard/browser matrix absent | None recorded at baseline | `Unscheduled` |
| `UI-003` | Backend status bar | `GET /health/ready` | `StatusBar` | Health service | Browser state | Public UI | Hosted + local | `PRODUCTION_PREVIEW` | Component tests present | None recorded at baseline | `Unscheduled` |
| `UI-004` | Provider settings dialog | `GET, PUT /api/settings` | `SettingsMenu` | Provider configuration and reinitialization | Runtime environment only | Admin API; client itself has no role gate | Hosted + local | `PRODUCTION_PREVIEW` | Component tests present; auth/bootstrap path absent | None recorded at baseline | `Unscheduled` |
| `UI-005` | Workspace file explorer | `/api/files/*` | `FileExplorerPanel`, `FilePreviewPane` | FileExplorerService | Local filesystem | Developer | Local only intended; currently registered by server | `LOCAL_ONLY_EXPERIMENTAL` | Panel/API tests present; cross-platform/path-abuse runtime QA incomplete | None recorded at baseline | `Unscheduled` |
| `UI-006` | Audio preview browser | `/api/audio/*` | `AudioPreviewBrowser` | Audio discovery/metadata/preview services | Local filesystem | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Panel/API tests present; codec/native-dependency matrix incomplete | None recorded at baseline | `Unscheduled` |
| `UI-007` | Code workflow panel | `/api/code/*`, `/api/plans/*` | `CodeWorkflowPanel`, `PlanActionBar` | CodingAgent; patch/verification/plans | Workspace files + plan store | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Component/route tests present; write/approval/runtime proof incomplete | None recorded at baseline | `Unscheduled` |
| `UI-008` | Conversation tools panel | Conversation, sharing, feedback, quick-reply APIs | `ConversationToolsPanel` | ConversationManager; sharing; feedback; quick replies | Database/service stores | Authenticated for most actions | Hosted + local | `PRODUCTION_PREVIEW` | Component/API tests present; ownership runtime QA absent | None recorded at baseline | `Unscheduled` |
| `UI-009` | Creative composer | `/api/creative/*`, chat creative payload | `CreativeComposerPanel` | CreativeWritingAgent | Creative project/export stores where used | Public in current specialist registration | Hosted + local | `PRODUCTION_PREVIEW` | Component/route tests present; long-form continuity QA incomplete | None recorded at baseline | `Unscheduled` |
| `UI-010` | FL Studio control panel | `/api/flstudio/*` | `FLStudioControlPanel` | FLStudioControlAgent; MCP client; safety gate | Local session/audit state | Public in current specialist registration | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Component/route tests present; live DAW canary absent | None recorded at baseline | `Unscheduled` |
| `UI-011` | Gaming playbooks | `/api/gaming/*`, `/api/gamedev/*` | `GamingPlaybookPanel` | Gaming and GameDev agents | Service-defined playbook data | Public in current specialist registration | Hosted + local | `PRODUCTION_PREVIEW` | No dedicated panel test identified; route tests partial | None recorded at baseline | `Unscheduled` |
| `UI-012` | Knowledge OS console | `/api/knowledge-os/*` | `KnowledgeOSPanel` | Entity linking, graph, wiki, memory, safe DB, governance | Database + local wiki + RAG | Admin | Hosted + local; local wiki/repo actions are environment-bound | `PRODUCTION_PREVIEW` | Route logic present; no dedicated component test or full ownership QA | None recorded at baseline | `Unscheduled` |
| `UI-013` | Online knowledge panel | `/api/knowledge-online/*` | `KnowledgeOnlinePanel`, `KnowledgeMissPrompt` | OnlineKnowledgeIngestionService | Preview/ingest metadata + RAG | Developer | Hosted + local | `PRODUCTION_PREVIEW` | Panel/API tests present; outbound-security/live-source QA incomplete | None recorded at baseline | `Unscheduled` |
| `UI-014` | GIS map panel | `/api/gis/*` | `GISMapPanel`, `GISMapCard` | GIS service/providers | GIS sessions/layers where configured | Public in current specialist registration | Hosted + local | `PRODUCTION_PREVIEW` | Component/route tests present; provider/runtime matrix incomplete | None recorded at baseline | `Unscheduled` |
| `UI-015` | Loaded file and audio context bar | No independent route | `LoadedFilesBar` | Chat request context assembly | Browser state | Public UI | Hosted + local; backend-dependent content | `PRODUCTION_PREVIEW` | No dedicated release evidence | None recorded at baseline | `Unscheduled` |
| `UI-016` | Local run approval console | `/api/local-tools/*` | `LocalRunApprovalPanel` | LocalToolService; LocalRunApprovalService; runner | Database + run output files | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Component/API tests present; hostile-command and restart QA incomplete | None recorded at baseline | `Unscheduled` |
| `UI-017` | Sprite Lab console | `/api/sprite-lab/*` | `SpriteLabPanel` | SpriteLabPlanService; internal/external adapters | Database + workspace output files | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Component/API tests present; external-tool/runtime QA incomplete | None recorded at baseline | `Unscheduled` |
| `UI-018` | Local tools workspace container | Local tool and Sprite Lab APIs | `LocalToolsWorkspace` | Local execution/sprite services | Local database/filesystem | Developer | Local only; hidden in static Pages build | `LOCAL_ONLY_EXPERIMENTAL` | No dedicated container test identified | None recorded at baseline | `Unscheduled` |
| `MODE-001` | Ask | Core chat/orchestrator | `ModeSelector` value `ask`; `AssistantChat` | General Q&A | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-002` | Plan | Core chat + `/api/plans/*` | `ModeSelector` value `plan`; `AssistantChat` | Planning and plan persistence | Conversation/RAG/service stores as applicable | Developer for code/local actions; chat itself public | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-003` | Implement | Core chat + `/api/code/*` | `ModeSelector` value `implement`; `AssistantChat` | CodingAgent and repo tools | Conversation/RAG/service stores as applicable | Developer for code/local actions; chat itself public | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-004` | Debug | Core chat + `/api/code/*`, `/api/debug/:requestId` | `ModeSelector` value `debug`; `AssistantChat` | Coding/debug services | Conversation/RAG/service stores as applicable | Developer for code/local actions; chat itself public | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-005` | Explain | Core chat/orchestrator | `ModeSelector` value `explain`; `AssistantChat` | General explanation | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-006` | Pop Culture | `/api/pop-culture/*` | `ModeSelector` value `pop_culture`; `AssistantChat` | PopCultureGeniusAgent; ChronoKnowledgeEngine | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-007` | History | `/api/history/*` | `ModeSelector` value `history`; `AssistantChat` | HistoryGeniusAgent; ChronoKnowledgeEngine | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-008` | Science | `/api/science/*` | `ModeSelector` value `science`; `AssistantChat` | ScienceInventionGeniusAgent; ChronoKnowledgeEngine | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-009` | Gaming | `/api/gaming/*` | `ModeSelector` value `gaming`; `AssistantChat` | GamingGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-010` | Math | `/api/math/*` | `ModeSelector` value `math`; `AssistantChat` | MathGeniusAgent; deterministic math tools | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-011` | Market | `/api/market/*` | `ModeSelector` value `market`; `AssistantChat` | MarketGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-012` | Game Dev | `/api/gamedev/*` | `ModeSelector` value `gamedev`; `AssistantChat` | GameDevGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-013` | Music Production | `/api/music/*` | `ModeSelector` value `music`; `AssistantChat` | MusicProductionGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-014` | Suno Prompting | `/api/music/*` specialist path | `ModeSelector` value `suno`; `AssistantChat` | SunoGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-015` | FL Studio Advisory | `/api/music/*`, `/api/flstudio/*` | `ModeSelector` value `fl_studio`; `AssistantChat` | FLStudioGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-016` | FL Studio Control | `/api/flstudio/*` | `ModeSelector` value `fl_studio_control`; `AssistantChat` | FLStudioControlAgent; MCP stack | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-017` | Pro Tools Advisory | `/api/music/*` | `ModeSelector` value `pro_tools`; `AssistantChat` | ProToolsGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-018` | Logic Pro Advisory | `/api/music/*` | `ModeSelector` value `logic`; `AssistantChat` | LogicProGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-019` | Mix and Master | `/api/music/*`, `/api/flstudio/*` as applicable | `ModeSelector` value `mix_master`; `AssistantChat` | MixGeniusAgent; music tools | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-020` | Story | `/api/story/*` | `ModeSelector` value `story`; `AssistantChat` | StoryGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-021` | Creative Writing | `/api/creative/*` | `ModeSelector` value `creative_writing`; `AssistantChat` | CreativeWritingAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-022` | Roleplay | `/api/creative/*` | `ModeSelector` value `roleplay`; `AssistantChat` | CreativeWritingAgent roleplay workflows | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-023` | Legal/Civic | `/api/legal/*` | `ModeSelector` value `legal`; `AssistantChat` | LegalCivicGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-024` | Health | `/api/health/*` | `ModeSelector` value `health`; `AssistantChat` | HealthGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-025` | Security | `/api/security/*` | `ModeSelector` value `security`; `AssistantChat` | SecurityGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-026` | Business | `/api/business/*` | `ModeSelector` value `business`; `AssistantChat` | BusinessGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-027` | Philosophy | `/api/philosophy/*` | `ModeSelector` value `philosophy`; `AssistantChat` | PhilosophyGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-028` | Language | `/api/language/*` | `ModeSelector` value `language`; `AssistantChat` | LanguageGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-029` | Geography | `/api/geography/*` | `ModeSelector` value `geography`; `AssistantChat` | GeoCultureGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-030` | GIS | `/api/gis/*` | `ModeSelector` value `gis`; `AssistantChat` | GIS services/providers | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-031` | Engineering | `/api/engineering/*` | `ModeSelector` value `engineering`; `AssistantChat` | EngineeringGeniusAgent | Conversation/RAG/service stores as applicable | Public in current specialist/chat registration | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `MODE-032` | Knowledge OS | `/api/knowledge-os/*` | `ModeSelector` value `knowledge_os`; `AssistantChat` | Knowledge OS service suite | Conversation/RAG/service stores as applicable | Admin for Knowledge OS APIs; chat itself public | Hosted + local | `PRODUCTION_PREVIEW` | Mode selector test plus route/domain eval artifacts where present; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `SPEC-001` | RAG query and citations | RAG query router (registered without fixed mount) | `AssistantChat`, `KnowledgeOSPanel` | RAGService; retriever; DocumentManager | RAG memory + SQLite/PostgreSQL store | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | RAG tests/evals exist; release grounding thresholds not certified | None recorded at baseline | `Unscheduled` |
| `SPEC-002` | Coding agent and patch workflow | `/api/code/*` | `CodeWorkflowPanel` | CodingAgent; PatchGenerator; VerificationRunner; repo tools | Workspace files + database/service state | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Focused tests present; no full hostile-workspace/runtime certification | None recorded at baseline | `Unscheduled` |
| `SPEC-003` | Plan storage and retrieval | `/api/plans/*` | `CodeWorkflowPanel`, `PlanActionBar` | Plans router/service | Workspace plan files | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Route/client tests present; runtime QA absent | None recorded at baseline | `Unscheduled` |
| `SPEC-004` | Workspace file API | `/api/files/*` | `FileExplorerPanel`, `FilePreviewPane` | FileExplorerService | Local filesystem | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Route/service tests present; path matrix incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-005` | Audio discovery and preview API | `/api/audio/*` | `AudioPreviewBrowser` | Audio browser/FFmpeg metadata services | Local filesystem | Developer | Local only intended | `LOCAL_ONLY_EXPERIMENTAL` | Route/client tests present; native dependency QA incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-006` | Local executable detection and run lifecycle | `/api/local-tools/detect`, `/executables`, `/run/plan`, `/run/start-approved`, `/runs*` | `LocalRunApprovalPanel` | LocalToolService; approval service; runner; policy | Database + run output files | Developer | Local only intended; must be blocked in hosted mode | `LOCAL_ONLY_EXPERIMENTAL` | Tests present; production abuse-resistance gate incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-007` | SEC filing ingestion | `/api/sec/*` | No dedicated active panel identified | SEC service/queue/parser | Database + downloaded filings | Developer | Hosted + local | `PRODUCTION_PREVIEW` | Route tests present; live SEC canary/pacing QA absent | None recorded at baseline | `Unscheduled` |
| `SPEC-008` | Education specialist API | `/api/education/*` | Mode/chat surface only | Education services | Service-defined | Developer | Hosted + local | `PRODUCTION_PREVIEW` | Route tests present; vertical-slice QA absent | None recorded at baseline | `Unscheduled` |
| `SPEC-009` | Sprite Lab internal processing | `/api/sprite-lab/status`, `/plan`, `/internal/slice-grid`, `/internal/palette`, `/internal/manifest` | `SpriteLabPanel` | SpriteLabPlanService; InternalSpriteImageAdapter | Workspace files + database | Developer | Local only | `LOCAL_ONLY_EXPERIMENTAL` | Tests present; real image/output QA incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-010` | Sprite Lab external tools | `/api/sprite-lab/external/plan`, `/external/run` | `SpriteLabPanel` | SpriteExternalToolAdapter; local run pipeline | Workspace files + database | Developer | Local only | `LOCAL_ONLY_EXPERIMENTAL` | Tests present; Aseprite/Pixelorama canaries absent | None recorded at baseline | `Unscheduled` |
| `SPEC-011` | Six Sigma Black Belt tools | `/api/sixsigma/*` | Mode/chat surface only | SixSigmaBlackBeltAgent; Cpk, sample size, Gage R&R, DPMO, COPQ, ANOVA, regression, control-chart tools | None/service-defined | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Domain evals and route tests exist; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `SPEC-012` | Chronological knowledge engine | `/api/chrono/*` | Mode/chat surface only | ChronoKnowledgeEngine | RAG/service state | Public in current registration | Hosted + local | `PRODUCTION_PREVIEW` | Route/domain tests exist; runtime QA absent | None recorded at baseline | `Unscheduled` |
| `SPEC-013` | Knowledge base management | `POST /api/knowledge-base/add`, `/file`; `GET /api/knowledge-base/stats` | `KnowledgeOSPanel`, online ingest flow | DocumentManager; RAGService | RAG store/database | Add/file: developer; stats currently public | Hosted + local; file-path ingestion is environment-bound | `PRODUCTION_PREVIEW` | Service tests present; ownership/upload/runtime QA incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-014` | Online knowledge approval and ingestion | `/api/knowledge-online/*` | `KnowledgeOnlinePanel`, `KnowledgeMissPrompt` | OnlineKnowledgeIngestionService | RAG/database | Developer | Hosted + local | `PRODUCTION_PREVIEW` | API/client tests present; SSRF/live-source approval QA incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-015` | Knowledge OS entity and graph operations | `/api/knowledge-os/summary`, `/entities/*`, `/graph/*`, `/import/repositories` | `KnowledgeOSPanel` | EntityLinkingService; KnowledgeGraphIndexer; GitHubRepoKnowledgeImporter | Database + RAG + workspace repository | Admin | Hosted + local; repository indexing is environment-bound | `PRODUCTION_PREVIEW` | Implementation present; ownership, scale and runtime QA absent | None recorded at baseline | `Unscheduled` |
| `SPEC-016` | Knowledge OS local wiki | `/api/knowledge-os/wiki/*` | `KnowledgeOSPanel` | LocalKnowledgeWiki; DocumentManager | Local wiki files + RAG | Admin | Local-first; hosted only with controlled persistent storage | `PRODUCTION_PREVIEW` | Implementation present; path/concurrency/backup QA absent | None recorded at baseline | `Unscheduled` |
| `SPEC-017` | Knowledge OS private memory | `/api/knowledge-os/memory/*` | `KnowledgeOSPanel` | PrivateMemoryStore | Database | Admin endpoint; body/query can currently name user IDs | Hosted + local | `PRODUCTION_PREVIEW` | Implementation present; tenant/IDOR release evidence absent | None recorded at baseline | `Unscheduled` |
| `SPEC-018` | Knowledge OS safe database questions | `/api/knowledge-os/db/ask`, `/db/query`, `/db/schema` | `KnowledgeOSPanel` | SafeDatabaseQuestionAgent | Application database (read-only intent) | Admin | Hosted + local | `PRODUCTION_PREVIEW` | Guardrail code exists; adversarial SQL/runtime certification absent | None recorded at baseline | `Unscheduled` |
| `SPEC-019` | Knowledge OS governance evidence | `/api/knowledge-os/governance/*` | `KnowledgeOSPanel` | GovernanceEvidenceService | Database | Admin | Hosted + local | `PRODUCTION_PREVIEW` | Implementation present; release-eval integration incomplete | None recorded at baseline | `Unscheduled` |
| `SPEC-020` | External knowledge-source search APIs | `POST /api/knowledge/{reddit,youtube,university,papers,github,stackoverflow,news,medium,quora,gutenberg,docs,library-of-congress,entertainment,books,specialized-topics,financial-advice,religion,mental-health,web-design,ui-design,backend-design,music-theory,llm-programming,anatomy,pottery,gardening,cna,dsp,rn,astronomy,astrology,botany,marijuana-growing,wikipedia}` | Knowledge online/RAG flows; no source-specific panels | Source adapters and outbound HTTP clients | Transient results; optional RAG ingestion | Developer via `/api/knowledge` middleware | Hosted + local | `PRODUCTION_PREVIEW` | Mock/unit coverage varies; no complete live-provider/security matrix | None recorded at baseline | `Unscheduled` |
| `SPEC-021` | External URL scraping | `POST /api/knowledge/scrape` | Knowledge online flow | WebScraperSource | Transient/RAG when separately ingested | Developer plus explicit auth middleware | Hosted + local | `PRODUCTION_PREVIEW` | SSRF policy not fully certified | None recorded at baseline | `Unscheduled` |
| `SPEC-022` | Dataset and Telegram ingestion | `POST /api/knowledge/load-csv`, `/load-json`, `/load-telegram` | No dedicated active panel | DatasetLoader; TelegramSource; DocumentManager | Local files + RAG/database | Developer plus explicit auth | Local only intended for file-path loading | `LOCAL_ONLY_EXPERIMENTAL` | No complete path/size/runtime QA | None recorded at baseline | `Unscheduled` |
| `SPEC-023` | Legacy in-memory knowledge graph API | `POST /api/knowledge/graph/entity`, `GET /api/knowledge/graph/query` | No dedicated panel | KnowledgeGraph instantiated per request | In-memory only per request | Developer plus explicit auth | Hosted + local | `PRODUCTION_PREVIEW` | Behavior is not durable; no vertical-slice QA | None recorded at baseline | `Unscheduled` |
| `SPEC-024` | Knowledge fusion | `POST /api/knowledge/fuse` | Knowledge online flow | KnowledgeFusion plus selected source adapters | Transient result | Developer plus explicit auth | Hosted + local | `PRODUCTION_PREVIEW` | No full source/failure/citation release evidence | None recorded at baseline | `Unscheduled` |
| `SPEC-025` | Specialist advisory route family | `/api/{math,market,gamedev,gaming,pop-culture,history,science,music,story,creative,legal,health,security,business,philosophy,language,geography,gis,engineering}/*` | Mode-specific chat and panels | Corresponding specialist agents/services | RAG/database/service state as applicable | Public in current registration unless route adds controls | Hosted + local; GIS/desktop actions vary | `PRODUCTION_PREVIEW` | Route/domain tests vary; none has complete production vertical-slice evidence | None recorded at baseline | `Unscheduled` |
| `PROV-001` | Template fallback model | Core chat through selected provider | `SettingsMenu` label “Local fallback” | TemplateAdapter | None | Admin to select; chat public | Hosted + local | `PRODUCTION_PREVIEW` | Unit behavior exists; fallback may mask provider failure and lacks production acceptance | None recorded at baseline | `Unscheduled` |
| `PROV-002` | Ollama text provider | Core chat/provider adapter | `SettingsMenu` | OllamaAdapter | Local model files outside app | Admin to configure | Local network/local host | `LOCAL_ONLY_EXPERIMENTAL` | Availability probe exists; documented-model canary absent | None recorded at baseline | `Unscheduled` |
| `PROV-003` | OpenAI text provider | Core chat/provider adapter | `SettingsMenu` | OpenAIAdapter | Encrypted secret lifecycle not yet certified | Admin to configure | Hosted + local | `PRODUCTION_PREVIEW` | Adapter code exists; contract/live canary absent | None recorded at baseline | `Unscheduled` |
| `PROV-004` | Anthropic Claude provider | Core chat/provider adapter | `SettingsMenu` | AnthropicAdapter | Secret lifecycle not yet certified | Admin to configure | Hosted + local | `PRODUCTION_PREVIEW` | Adapter code exists; contract/live canary absent | None recorded at baseline | `Unscheduled` |
| `PROV-005` | Google Gemini provider | Core chat/provider adapter | `SettingsMenu` | GeminiAdapter | Secret lifecycle not yet certified | Admin to configure | Hosted + local | `PRODUCTION_PREVIEW` | Adapter code exists; contract/live canary absent | None recorded at baseline | `Unscheduled` |
| `PROV-006` | Hugging Face provider | Core chat/provider adapter | `SettingsMenu` | HuggingFaceAdapter | Secret/model cache outside app | Admin to configure | Hosted + local | `PRODUCTION_PREVIEW` | Adapter code exists; contract/live canary absent | None recorded at baseline | `Unscheduled` |
| `PROV-007` | OpenAI-compatible providers | Core chat/provider adapter | `SettingsMenu` presets for DeepSeek, Kimi/Moonshot, MiniMax, Groq, OpenRouter, Mistral, Together, Cerebras, xAI, custom | OpenAICompatibleAdapter | Secret lifecycle not yet certified | Admin to configure | Hosted + local | `PRODUCTION_PREVIEW` | Generic adapter only; per-provider model claims/canaries absent | None recorded at baseline | `Unscheduled` |
| `PROV-008` | Xenova local embeddings | RAG/document ingestion | Settings fields only | EmbeddingService; Transformers runtime | Local model cache + vector store | Admin/configuration | Hosted + local with downloaded model | `PRODUCTION_PREVIEW` | Implementation exists; deterministic versioning/re-embedding QA absent | None recorded at baseline | `Unscheduled` |
| `PROV-009` | OpenAI embeddings | RAG/document ingestion | Settings fields only | EmbeddingService | Vector store + provider secret | Admin/configuration | Hosted + local | `PRODUCTION_PREVIEW` | No live contract/cost/re-embedding certification | None recorded at baseline | `Unscheduled` |
| `PROV-010` | Ollama embeddings | RAG/document ingestion | Settings fields only | EmbeddingService | Local model + vector store | Admin/configuration | Local network/local host | `LOCAL_ONLY_EXPERIMENTAL` | No live contract/re-embedding certification | None recorded at baseline | `Unscheduled` |
| `PROV-011` | LLaVA vision adapter | Vision-enabled orchestration when configured | No active vision setup surface identified | LLaVAAdapter | Local model outside app | Configuration only | Local only | `LOCAL_ONLY_EXPERIMENTAL` | No active UI path or live canary | None recorded at baseline | `Unscheduled` |
| `PROV-012` | Gemini Vision adapter | Vision-enabled orchestration when configured | No active vision setup surface identified | GeminiVisionAdapter | Provider secret | Configuration only | Hosted + local | `PRODUCTION_PREVIEW` | No active vertical-slice/live canary | None recorded at baseline | `Unscheduled` |
| `PROV-013` | GPT-4V adapter | Vision-enabled orchestration when configured | No active vision setup surface identified | GPT4VAdapter | Provider secret | Configuration only | Hosted + local | `PRODUCTION_PREVIEW` | No active vertical-slice/live canary | None recorded at baseline | `Unscheduled` |
| `PROV-014` | Web search tool provider | Tool-calling paths | No dedicated provider panel | WebSearcher from environment | Transient results | Configuration/tool policy | Hosted + local | `PRODUCTION_PREVIEW` | Tool is registered; provider/outbound-policy certification absent | None recorded at baseline | `Unscheduled` |
| `PROV-015` | GIS provider integrations | `/api/gis/*` | `GISMapPanel` | GIS provider adapters/services | Session/layer storage where configured | Public in current route registration | Hosted + local | `PRODUCTION_PREVIEW` | Tests exist; provider canaries/privacy/rate QA incomplete | None recorded at baseline | `Unscheduled` |
| `PROV-016` | SEC public-data integration | `/api/sec/*` | No dedicated active panel | SEC adapter/queue/parser | Database + files | Developer | Hosted + local | `PRODUCTION_PREVIEW` | Mock/route coverage exists; live approved-user-agent canary absent | None recorded at baseline | `Unscheduled` |
| `PROV-017` | GitHub repository knowledge import | `POST /api/knowledge-os/import/repositories`; knowledge GitHub search | `KnowledgeOSPanel` | GitHubRepoKnowledgeImporter; GitHubSource | Local wiki/RAG/database | Admin or developer by route | Hosted + local | `PRODUCTION_PREVIEW` | Implementation exists; token scope/rate/live import QA absent | None recorded at baseline | `Unscheduled` |
| `INF-001` | SQLite persistence | Application/RAG/data services | No database selection UI | Database; ExpansionDatabase | Local SQLite file | Server configuration | Local single-instance | `PRODUCTION_PREVIEW` | Unit/service tests exist; migration/backup/restore certification absent | None recorded at baseline | `Unscheduled` |
| `INF-002` | PostgreSQL persistence | Application/RAG/data services | No database selection UI | Database PostgreSQL adapter | PostgreSQL | Server configuration | Hosted + local | `PRODUCTION_PREVIEW` | Code path exists; first-class migration CI and restore drill absent | None recorded at baseline | `Unscheduled` |
| `INF-003` | In-memory cache | Orchestrator/service cache paths | No cache UI | MultiLevelCache memory tier; SemanticCache | Process memory | Server configuration | Hosted + local | `PRODUCTION_PREVIEW` | Unit behavior exists; capacity/runtime QA incomplete | None recorded at baseline | `Unscheduled` |
| `INF-004` | Redis cache | Cache paths and health probe | Admin diagnostics only | MultiLevelCache Redis tier; ioredis | Redis | Server configuration | Hosted + local with private Redis | `PRODUCTION_PREVIEW` | Optional code path exists; shared-limit/network/security QA absent | None recorded at baseline | `Unscheduled` |
| `INF-005` | Disk cache | Cache paths | No active UI | MultiLevelCache disk tier | Local filesystem | Server configuration | Local or controlled persistent volume | `LOCAL_ONLY_EXPERIMENTAL` | Optional code path exists; cleanup/concurrency QA absent | None recorded at baseline | `Unscheduled` |
| `INF-006` | RAG corpus bootstrap | Startup background initialization | Health optional-service status | DocumentManager; RAGDocumentStore | Knowledge-base directories + database | Server configuration | Hosted + local | `PRODUCTION_PREVIEW` | Initialization tests exist; large-corpus/restart QA incomplete | None recorded at baseline | `Unscheduled` |
| `INF-007` | Coding knowledge bootstrap | Startup optional initialization | No dedicated UI | CodingKnowledgeBase; KnowledgeLearner | Local corpus/model memory | Server configuration | Local or packaged deployment | `LOCAL_ONLY_EXPERIMENTAL` | Initialization tests exist; production packaging/runtime QA absent | None recorded at baseline | `Unscheduled` |
| `INF-008` | Safety pipeline | Core orchestration | No dedicated policy UI | SafetyPipeline | Transient/service state | Server policy | Hosted + local | `PRODUCTION_PREVIEW` | Safety evals exist; release thresholds not certified | None recorded at baseline | `Unscheduled` |
| `INF-009` | Model router and orchestrator | Core chat and specialist routes | All chat surfaces | ModelRouter; EnhancedOrchestrator; FunctionCaller | Conversation/RAG/cache state | Server policy | Hosted + local | `PRODUCTION_PREVIEW` | Service tests exist; provider failure/cost/cancellation certification absent | None recorded at baseline | `Unscheduled` |
| `INF-010` | Analytics service | Background request/usage instrumentation | No analytics UI identified | AnalyticsService | Service-defined/in-memory | Server | Hosted + local | `PRODUCTION_PREVIEW` | Initialized at startup; operations retention/privacy QA absent | None recorded at baseline | `Unscheduled` |
| `INF-011` | Audit logging | Privileged middleware, MCP/local tools | No general audit viewer in active UI | Audit middleware; McpAuditLogger | Logs/database as implemented | Admin/developer events | Hosted + local | `PRODUCTION_PREVIEW` | Some security tests; completeness/redaction/tamper-resistance QA absent | None recorded at baseline | `Unscheduled` |
| `INF-012` | Media and document processing stack | Upload/audio/sprite/document routes | Upload, audio, Sprite Lab surfaces | Multer, Sharp, FFmpeg, PDF parser, Tesseract/OCR and format handlers | Temporary/local files + RAG | Authenticated/developer by route | Hosted + local depending binaries | `PRODUCTION_PREVIEW` | Partial tests; full format, bomb, cleanup and native-dependency matrix absent | None recorded at baseline | `Unscheduled` |
| `DIS-001` | Unregistered streaming chat router | Source module `src/server/routes/chat-stream.ts`; no active mount found | No active streaming UI path | Chat stream router | None | Not reachable | Unavailable | `DISABLED_OR_REMOVED` | Source exists but active registration was not found | None recorded at baseline | `Unscheduled` |
| `DIS-002` | Unregistered setup/bootstrap router | Source module `src/server/routes/setup.ts`; no active mount found | No setup/login/bootstrap UI in active app shell | Setup router | Service-defined | Not reachable | Unavailable | `DISABLED_OR_REMOVED` | Source/tests may exist; active registration not found | None recorded at baseline | `Unscheduled` |
| `DIS-003` | Dormant scheduler and automation modules | Unregistered `src/core/scheduler/*`, `src/core/automation/*` | No active automation UI | TaskScheduler and automation services | Service-defined | Not reachable from startup found | Unavailable until explicitly registered | `DISABLED_OR_REMOVED` | No startup registration or production workflow evidence | None recorded at baseline | `Unscheduled` |
| `DIS-004` | Dormant device/browser background adapters | Unregistered device/browser modules | No active UI | DeviceAdapter and browser modules | Service-defined | Not reachable from active startup found | Unavailable until explicitly registered | `DISABLED_OR_REMOVED` | Reachability not established | None recorded at baseline | `Unscheduled` |
| `DIS-005` | Legacy or alternate memory systems | Unregistered memory implementations outside active private-memory/conversation/RAG path | No active UI | GraphMemory and other alternate memory modules | Service-defined | Not reachable from active startup found | Unavailable until explicitly registered | `DISABLED_OR_REMOVED` | Reachability not established; P02-T02 must confirm | None recorded at baseline | `Unscheduled` |
| `DIS-006` | Legacy image-generation surface | No active route/settings/chat path | No active image-generation UI | Legacy provider adapters if retained | None | Not reachable | Unavailable | `DISABLED_OR_REMOVED` | README explicitly states image generation is not exposed | None recorded at baseline | `Unscheduled` |
| `DIS-007` | All other unregistered experimental/legacy modules | Any source not reachable from server startup, route registration, active UI, or documented background initialization | None unless later mapped | Unclassified source families pending P02-T02 reachability map | Varies | Not reachable | Unavailable until separately manifested | `DISABLED_OR_REMOVED` | Catch-all is intentionally default-deny; each future activation requires its own stable feature ID | None recorded at baseline | `Unscheduled` |

## Coverage audit

### Active client panels and feature mapping

The active app is a single-page workspace. Every discovered production client component is mapped below.

| Client surface | Manifest record(s) |
|---|---|
| `App` | `CORE-001` |
| `AssistantChat` | `UI-001`, `CORE-002`, `MODE-001` through `MODE-032` |
| `ModeSelector` | `UI-002`, `MODE-001` through `MODE-032` |
| `StatusBar` | `UI-003`, `CORE-007` |
| `SettingsMenu` | `UI-004`, `CORE-006`, `PROV-001` through `PROV-010` |
| `FileExplorerPanel` / `FilePreviewPane` | `UI-005`, `SPEC-004` |
| `AudioPreviewBrowser` | `UI-006`, `SPEC-005` |
| `CodeWorkflowPanel` | `UI-007`, `SPEC-002`, `SPEC-003` |
| `ConversationToolsPanel` | `UI-008`, `CORE-010` through `CORE-014` |
| `CreativeComposerPanel` | `UI-009`, `MODE-021`, `MODE-022` |
| `FLStudioControlPanel` | `UI-010`, `MODE-016` |
| `GamingPlaybookPanel` | `UI-011`, `MODE-009`, `MODE-012` |
| `KnowledgeOSPanel` | `UI-012`, `MODE-032`, `SPEC-015` through `SPEC-019` |
| `KnowledgeOnlinePanel` / `KnowledgeMissPrompt` | `UI-013`, `SPEC-014`, `SPEC-020`, `SPEC-021`, `SPEC-024` |
| `GISMapPanel` / `GISMapCard` | `UI-014`, `MODE-030`, `PROV-015` |
| `LoadedFilesBar` | `UI-015` |
| `PlanActionBar` | `UI-007`, `SPEC-003` |
| `LocalRunApprovalPanel` | `UI-016`, `SPEC-006` |
| `SpriteLabPanel` | `UI-017`, `SPEC-009`, `SPEC-010` |
| `LocalToolsWorkspace` | `UI-018` |

### Chat mode mapping

All 32 values exported by `ModeSelector` are individually recorded as `MODE-001` through `MODE-032`. No active mode is uncategorized.

### `routeManifest.ts` registration mapping

| Registered router name | Manifest record(s) |
|---|---|
| `rag-query` | `SPEC-001` |
| `code` | `SPEC-002` |
| `plans` | `SPEC-003` |
| `files` | `SPEC-004` |
| `audio` | `SPEC-005` |
| `local-tools` | `SPEC-006` |
| `tool-catalog` | `CORE-017` |
| `sec` | `SPEC-007`, `PROV-016` |
| `education` | `SPEC-008` |
| `sprite-lab` | `SPEC-009`, `SPEC-010` |
| `math` | `MODE-010`, `SPEC-025` |
| `market` | `MODE-011`, `SPEC-025` |
| `gamedev` | `MODE-012`, `SPEC-025` |
| `gaming` | `MODE-009`, `SPEC-025` |
| `sixsigma` | `SPEC-011` |
| `chrono` | `SPEC-012` |
| `pop-culture` | `MODE-006`, `SPEC-025` |
| `history` | `MODE-007`, `SPEC-025` |
| `science` | `MODE-008`, `SPEC-025` |
| `music` | `MODE-013` through `MODE-019`, `SPEC-025` |
| `flstudio` | `UI-010`, `MODE-015`, `MODE-016`, `SPEC-025` |
| `story` | `MODE-020`, `SPEC-025` |
| `creative` | `MODE-021`, `MODE-022`, `SPEC-025` |
| `legal` | `MODE-023`, `SPEC-025` |
| `health` | `MODE-024`, `SPEC-025` |
| `security` | `MODE-025`, `SPEC-025` |
| `business` | `MODE-026`, `SPEC-025` |
| `philosophy` | `MODE-027`, `SPEC-025` |
| `language` | `MODE-028`, `SPEC-025` |
| `geography` | `MODE-029`, `SPEC-025` |
| `gis` | `MODE-030`, `UI-014`, `SPEC-025`, `PROV-015` |
| `engineering` | `MODE-031`, `SPEC-025` |
| `knowledge-online` | `SPEC-014` |
| `admin` | `CORE-022` |
| `export` | `CORE-023` |

### Routes registered directly in `src/server/index.ts` or health/settings registration

| Route family | Manifest record(s) |
|---|---|
| `/health`, `/health/ready`, `/health/live` | `CORE-007` |
| `/api/metrics`, `/metrics` | `CORE-008` |
| `/api/v1/*`, `/api/v2/*`, `/api/chat` | `CORE-002`, `CORE-003`, `CORE-004` |
| `/api/knowledge-base/*` | `SPEC-013` |
| `/api/knowledge-os/*` | `UI-012`, `MODE-032`, `SPEC-015` through `SPEC-019` |
| `/api/tools`, `/api/tool-catalog/*` | `CORE-017` |
| `/api/models/free` | `CORE-018` |
| `/api/settings` | `CORE-006`, `UI-004` |
| `/api-docs` | `CORE-009` |
| `/api/upload` | `CORE-015` |
| `/api/feedback*` | `CORE-012` |
| `/api/user/instructions` | `CORE-013` |
| `/api/chat/quick-replies` | `CORE-014` |
| `/api/conversations*`, `/api/share/*` | `CORE-010`, `CORE-011` |
| `/api/documents/search` | `CORE-016` |
| `/api/knowledge/*` | `SPEC-020` through `SPEC-024` |
| `/api/reasoning/chain-of-thought` | `CORE-020` |
| `/api/debug/:requestId` | `CORE-019` |
| `/api/webhooks*` | `CORE-024` |
| Static client and catch-all | `CORE-001`; no separate product capability is claimed |

### Provider, integration, persistence, and background-service mapping

- Text providers are individually mapped by `PROV-001` through `PROV-007`.
- Embedding providers are individually mapped by `PROV-008` through `PROV-010`.
- Vision providers are individually mapped by `PROV-011` through `PROV-013`.
- Web search, GIS, SEC, and GitHub importer integrations are mapped by `PROV-014` through `PROV-017`.
- SQLite, PostgreSQL, memory/Redis/disk caches, RAG bootstrap, coding-knowledge bootstrap, safety, orchestration, analytics, audit, and media/document processing are mapped by `INF-001` through `INF-012`.
- The optional startup jobs `persistedRagRestore`, `privateKnowledgeBaseLoad`, `publicKnowledgeBaseLoad`, and `codingKnowledgeBaseLoad` are covered by `INF-006` and `INF-007`.
- WebSocket initialization is covered by `CORE-021`.
- Local execution, Sprite Lab, filesystem, audio, local model, and FL Studio MCP behavior is explicitly local-only through the relevant `UI`, `SPEC`, and `PROV` records.
- Unregistered scheduler, automation, device, browser, alternate-memory, setup, streaming, image-generation, and any remaining unreachable legacy/experimental source is default-denied by `DIS-001` through `DIS-007`.

## Known boundary defects exposed by this manifest

1. The active client shell exposes settings and local-tool panels but does not expose a complete login/admin-bootstrap workflow.
2. Several specialist routers are public in current registration because they have no explicit mount-level role metadata.
3. Local-only execution and desktop-integration routes are registered by the main server and still require a hosted-mode deny control.
4. The settings API applies changes only to the running process; durable secret-manager-backed persistence is not implemented.
5. Runtime evidence is absent for the assembled deployment, provider canaries, accessibility, backup/restore, rollback, and local-tool abuse resistance.
6. Some reachable route families have only raw JSON or no dedicated user interface.
7. The static Pages build is not a complete deployment and must not be described as the full product.
8. Unregistered source modules remain default-disabled until Phase 2 produces a reachability map and a dedicated feature decision.

## Update policy

- A feature may move to `PRODUCTION_SUPPORTED` only when its complete vertical slice and all applicable global release gates are verified against one exact commit.
- A new route, panel, mode, provider, integration, background job, or local tool must receive a stable feature ID before merge.
- Activating anything covered by `DIS-007` requires replacing the catch-all classification with one or more specific records.
- Status changes must cite automated coverage and committed runtime evidence; narrative claims are insufficient.
- This manifest must be reviewed by every pull request that adds, removes, registers, exposes, or changes the supported status of a feature.
