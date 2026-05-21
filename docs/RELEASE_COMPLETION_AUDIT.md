# Release Completion Audit

Generated: 2026-05-20

This file tracks release-readiness findings and required fixes.

Status values:
- Open: Finding exists and no fix has been confirmed.
- In Progress: Fix work has started but is not complete.
- Fixed: Fix has been implemented but not fully verified.
- Verified: Fix has been proven by a build, test, typecheck, lint, runtime check, or clear manual inspection.
- Blocked: Fix cannot proceed until a dependency or decision is resolved.

Verification rule: Do not mark any item Verified unless the Verification field names the proof.

Current verification baseline: No build, test, typecheck, lint, runtime check, or production packaging smoke test was run while creating this tracker. All findings below remain Open until fixes are implemented and verified.

## A1

- ID: A1
- Severity: Blocker
- File/path: README.md; package.json; client/vite.config.ts; src/server/index.ts
- Feature/system: Production entry points and client/server serving
- Problem: Production startup serves the API on port 3001 but does not visibly serve the built React client, while the README points users to the dev client on port 3000.
- Fix: Add a production serving strategy: either serve client/dist from Express with SPA fallback or document/package a two-process deployment behind a reverse proxy. Update README, package scripts, deployment docs, and smoke tests.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm run release:check` and an isolated production smoke on port 3101 with memory-only RAG: `/health/ready` returned 200, `/` served the built React HTML, and anonymous `/api/files/tree` returned 401.

## A2

- ID: A2
- Severity: High
- File/path: src/server/index.ts
- Feature/system: API gateway and route registration
- Problem: The server entry point is monolithic and mixes configuration validation, middleware, service initialization, settings persistence, specialist routing, health checks, route mounting, and process startup. Several route factories are instantiated inside request handlers.
- Fix: Split bootstrap, middleware, route registration, settings, chat, admin, specialist, and static serving into separate modules. Instantiate routers once at startup and document the route manifest.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/routeManifest.test.ts src/server/chatRequest.test.ts src/types/chat.test.ts` and `npm run release:check`. The legacy chat endpoint moved to `src/server/routes/legacy-chat.ts`, health/metrics moved to `src/server/healthRoutes.ts`, provider settings moved to `src/server/routes/settings.ts`, and high-risk/service route registration is manifest-backed in `src/server/routeManifest.ts`.

## A3

- ID: A3
- Severity: Medium
- File/path: client/src/App.tsx; client/src/components/ChatInterface.tsx; client/src/components/MessageInput.tsx
- Feature/system: React entry point and duplicate chat UI
- Problem: The active app renders AssistantChat, while an older ChatInterface/MessageInput stack still exists and is unreachable from the entry point.
- Fix: Remove the obsolete chat stack or intentionally route it behind a documented dev/test path. Consolidate duplicated prompt and mode logic.
- Status: Verified
- Verification: Verified 2026-05-20 by static inspection and `cd client; npm run build`. The obsolete `ChatInterface`/`MessageInput` stack and dependent message components were removed; `App.tsx` renders only `AssistantChat`.

## A4

- ID: A4
- Severity: High
- File/path: src/server/index.ts
- Feature/system: Startup readiness
- Problem: Server startup and some request paths wait for service initialization using polling loops instead of bounded readiness behavior.
- Fix: Add bounded startup timeout, explicit readiness state, per-subsystem readiness reporting, and fail-fast behavior for unrecoverable initialization failures.
- Status: Verified
- Verification: Verified 2026-05-20 with bounded startup/request readiness, explicit startup state, `/health/ready` subsystem reporting, fail-fast startup timeout, and health route coverage for ready, initializing, failed, and degraded states. Covered by `npm test -- --runTestsByPath src/server/healthRoutes.test.ts --runInBand` and `npm run release:check`.

## B1

- ID: B1
- Severity: High
- File/path: tsconfig.json
- Feature/system: TypeScript quality gate
- Problem: Root TypeScript strictness is disabled, library checks are skipped, and client/e2e/tests are excluded from the main typecheck.
- Fix: Enable strict mode incrementally and add separate server, client, and test TypeScript configs wired into CI.
- Status: Verified
- Verification: Verified 2026-05-20 by enabling strict root TypeScript, adding strict test typecheck coverage, wiring server/test/client typecheck into `npm run type-check`, and passing `npm run type-check` plus `npm run release:check`.

## B2

- ID: B2
- Severity: High
- File/path: eslint.config.js
- Feature/system: Linting
- Problem: ESLint ignores the entire client and disables correctness rules that would catch unused code, unsafe any usage, production console logging, and accidental dead code.
- Fix: Add client lint coverage, re-enable key correctness rules, and allow exceptions only through documented inline suppressions.
- Status: Verified
- Verification: Verified 2026-05-20 by splitting lint into server and client gates, linting `client/src`, and passing `npm run lint` plus `npm run release:check`.

## B3

- ID: B3
- Severity: Medium
- File/path: client/package.json
- Feature/system: Client build/test setup
- Problem: The client package has only dev, build, and preview scripts; it has no lint, unit test, component test, accessibility test, or coverage script.
- Fix: Add client lint/test/coverage/a11y scripts and wire them into root CI/release validation.
- Status: Verified
- Verification: Verified 2026-05-20 by adding client type-check/lint/test/coverage/a11y scripts, Vitest/Testing Library component/API tests, coverage thresholds, and root release wiring. Passed `cd client; npm run test`, `cd client; npm run coverage`, `cd client; npm run a11y`, and `npm run release:check`.

## B4

- ID: B4
- Severity: Medium
- File/path: jest.config.js
- Feature/system: Test coverage
- Problem: Jest is configured for Node/TypeScript roots only and lacks client coverage and coverage thresholds.
- Fix: Add React test tooling, route/security/service coverage, and explicit coverage thresholds.
- Status: Verified
- Verification: Verified 2026-05-20 by adding Jest coverage thresholds, adding Vitest/Testing Library client tests with whole-client-source coverage thresholds, wiring server and client coverage into CI and `npm run release:check`, and passing `npm run test:coverage -- --runInBand` plus `cd client; npm run coverage`.

## C1

- ID: C1
- Severity: High
- File/path: client/src/components/AssistantChat.tsx; src/server/index.ts; src/core/orchestrator/Orchestrator.ts; src/core/orchestrator/EnhancedOrchestrator.ts
- Feature/system: Chat request contract
- Problem: The UI sends systemPrompt, loadedFiles, loadedAudio, activePlanId, and activeFileBrowserMode, but the backend chat request contract and orchestrator paths do not reliably consume these fields.
- Fix: Define a shared typed chat DTO, validate it server-side, and feed files/audio/plans/system instructions into the correct specialist or orchestrator context.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/types/chat.test.ts src/server/chatRequest.test.ts` and `npm run release:check`. Shared chat DTO validation now covers system prompts, loaded files, loaded audio, and active plans; orchestrator and coding-specialist paths receive rendered context.

## C2

- ID: C2
- Severity: High
- File/path: client/src/components/AssistantChat.tsx; src/server/routes/plans.ts; src/core/planning/PlanDocumentService.ts
- Feature/system: Plan mode to Implement mode workflow
- Problem: Plan mode saves a Markdown plan and the UI can switch to Implement, but the saved plan is not loaded into the implement agent context.
- Fix: Add UI plan-load behavior, include plan content/ID in implement requests, and make the coding agent explicitly consume activePlanId.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/chatRequest.test.ts src/types/chat.test.ts` and `npm run release:check`. Implement requests with `activePlanId` are enriched from saved Markdown plan content, rendered into the shared chat context, and passed into the coding agent context bundle.

## C3

- ID: C3
- Severity: Medium
- File/path: src/server/routes/code.ts; client/src/components/AssistantChat.tsx
- Feature/system: Code-agent API routing
- Problem: Dedicated /api/code routes exist for ask, plan, patch, review, verify, file search, and symbols, but the visible UI posts only to /api/chat.
- Fix: Add UI actions for code-agent workflows or remove/disable unused production routes.
- Status: Verified
- Verification: Verified 2026-05-20 by adding the Code Workflows panel to code-focused chat modes, mapping ask, plan, patch, review, verify, file search, and symbol lookup controls to `/api/code/*`, and covering the client API plus UI route mapping in `client/src/api/code.test.ts` and `client/src/components/CodeWorkflowPanel.test.tsx`. Passed `cd client; npm run test -- --run src/api/code.test.ts src/components/CodeWorkflowPanel.test.tsx src/components/AssistantChat.test.tsx`, `npm run type-check`, `npm run lint`, and `npm run release:check`.

## C4

- ID: C4
- Severity: Medium
- File/path: src/server/index.ts; client/src/App.tsx; client/src/components/AssistantChat.tsx
- Feature/system: Conversation/share/quick-reply/document routes
- Problem: Backend routes exist for conversations, sharing, quick replies, and document search, but there is no visible UI navigation or controls for them.
- Fix: Add tested UI workflows or remove/disable the unused endpoints from production.
- Status: Verified
- Verification: Verified 2026-05-20 by adding a backend-only Conversation Tools panel with visible workflows for conversation history refresh/load/delete, current-session sharing, quick replies, and document search. Covered by `client/src/api/conversations.test.ts` and `client/src/components/ConversationToolsPanel.test.tsx`; passed `cd client; npm run test -- --run src/api/conversations.test.ts src/components/ConversationToolsPanel.test.tsx src/components/AssistantChat.test.tsx`, `npm run type-check`, `npm run lint`, and `npm run release:check`.

## D1

- ID: D1
- Severity: Blocker
- File/path: client/src/components/SettingsMenu.tsx; src/server/index.ts
- Feature/system: Settings UI and provider configuration
- Problem: Settings UI exposes provider and API-key configuration through unauthenticated routes that can rewrite .env and reinitialize services.
- Fix: Require admin auth, CSRF protection, audit logging, strict validation, and move secret storage out of runtime .env writes.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Settings reads/writes reject anonymous and developer-token requests and allow admin-token writes in the production auth policy harness; runtime `.env` writes were removed in favor of process-only updates.

## D2

- ID: D2
- Severity: Medium
- File/path: client/src/components/AssistantChat.tsx; client/src/components/StatusBar.tsx
- Feature/system: Connection status UI
- Problem: The chat status bar is hardcoded as connected.
- Fix: Bind status to real API/WebSocket readiness, show reconnecting/error states, and test disconnect/reconnect behavior.
- Status: Verified
- Verification: Verified 2026-05-20 by binding `AssistantChat` connection state to `/health/ready`, rendering connected, degraded, connecting, and disconnected labels in `StatusBar`, and covering all UI states in `client/src/components/StatusBar.test.tsx`. Passed `cd client; npm run test -- --run src/components/StatusBar.test.tsx`, health route readiness tests, and `npm run release:check`.

## D3

- ID: D3
- Severity: Blocker
- File/path: client/src/components/KnowledgeOSPanel.tsx; src/server/routes/knowledge-os.ts
- Feature/system: Knowledge OS UI and privileged mutations
- Problem: Knowledge OS UI exposes graph build, wiki writes, wiki ingestion, memory approval, evidence loading, and repository import; backend routes lack visible auth middleware.
- Fix: Put Knowledge OS mutation/read-sensitive endpoints behind admin auth and split public read-only endpoints from privileged actions.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Knowledge OS routes are protected with admin-only policy; anonymous and developer-token requests are rejected while an admin token can access the summary route.

## D4

- ID: D4
- Severity: Medium
- File/path: client/src/components/AudioPreviewBrowser.tsx; src/server/routes/audio.ts; src/core/audio/AudioLibraryService.ts
- Feature/system: Audio browser and audio analysis
- Problem: Audio browsing/metadata is visible, but deeper audio analysis returns 501 and waveform extraction returns empty fallback data.
- Fix: Implement waveform extraction and analysis or remove/disable routes/UI/documentation implying those features.
- Status: Verified
- Verification: Verified 2026-05-20 by replacing the placeholder waveform/analyze behavior with deterministic PCM WAV waveform extraction, amplitude analysis, and structured unsupported states for non-decodable audio. Covered by `npm test -- --runTestsByPath src/core/audio/AudioLibraryService.test.ts src/server/routes/__tests__/feature-expansion-routes.test.ts --runInBand` and `npm run release:check`.

## D5

- ID: D5
- Severity: High
- File/path: client/src/components/AssistantChat.tsx; client/src/components/ChatInterface.tsx; src/core/orchestrator/Orchestrator.ts
- Feature/system: Image response UI
- Problem: Legacy code supports image fields and image generation, but the active AssistantChat renderer handles text only and active chat routing does not surface image generation.
- Fix: Wire image generation into the active orchestrator/UI or remove image-generation claims and controls.
- Status: Verified
- Verification: Verified 2026-05-20 by removing Stable Diffusion controls from `client/src/components/SettingsMenu.tsx`, removing Stable Diffusion from settings API/status and `env.example`, aligning README/quickstart/setup docs with text-only active chat behavior, and passing `npm run release:check`.

## E1

- ID: E1
- Severity: High
- File/path: client/src/components/AssistantChat.tsx; src/server/index.ts
- Feature/system: Conversation persistence
- Problem: Active chat stores messages only in component state while backend conversation APIs exist separately.
- Fix: Hydrate/save/delete/select conversations through backend persistence and add visible conversation history UI.
- Status: Verified
- Verification: Verified 2026-05-20 by wiring `/api/chat` persistence through the initialized `ConversationManager`, adding database session upsert before message insert, reusing the same manager for conversation/share endpoints, and adding a visible Conversation Tools panel for history refresh/load/delete and sharing. Covered by `npm test -- --runTestsByPath src/core/conversation/ConversationManager.test.ts --runInBand`, `cd client; npm run test -- --run src/components/ConversationToolsPanel.test.tsx`, and `npm run release:check`.

## E2

- ID: E2
- Severity: Medium
- File/path: client/src/components/AssistantChat.tsx; src/core/orchestrator/EnhancedOrchestrator.ts; src/core/orchestrator/Orchestrator.ts
- Feature/system: Knowledge-miss CTA flow
- Problem: The UI listens for knowledgeMiss fields, but the active chat response contract has no stable typed knowledge-miss field.
- Fix: Add a typed knowledge-miss response shape and deterministic server logic for insufficient local knowledge coverage.
- Status: Verified
- Verification: Verified 2026-05-20 by adding a typed `knowledgeMissDetail` payload to local-miss chat responses, preserving legacy miss fields for compatibility, and updating the AssistantChat parser to show the CTA for typed misses and clear it on non-miss responses. Covered by `npm test -- --runTestsByPath src/server/routes/legacy-chat.test.ts src/core/knowledge/KnowledgeMissHandler.test.ts src/core/knowledge/LocalKnowledgeAnswerer.test.ts --runInBand`, `cd client; npm run test -- --run src/components/AssistantChat.test.tsx`, and `npm run release:check`.

## E3

- ID: E3
- Severity: High
- File/path: client/src/api/knowledge.ts; src/server/routes/knowledge-online.ts; src/core/knowledge/OnlineKnowledgeIngestionService.ts
- Feature/system: Online knowledge ingestion
- Problem: Online search and ingestion are unauthenticated, and ingestion persists snippets with fixed confidence without source-quality review.
- Fix: Require authenticated approval, source policy, provenance, deduplication, review queue, and rollback/delete support.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/core/knowledge/OnlineKnowledgeIngestionService.test.ts src/server/routes/__tests__/feature-expansion-routes.test.ts src/server/__tests__/release-security.test.ts` and `npm run release:check`. Online knowledge routes remain protected by developer/admin route policy, ingestion now requires explicit approval, source policy rejects local/private/unsupported URLs, previews carry review tokens, metadata includes provenance and approval fields, duplicate content is skipped, and rollback is exposed through document-manager delete hooks when available.

## F1

- ID: F1
- Severity: Blocker
- File/path: src/server/routes/files.ts; src/core/files/FileExplorerService.ts; client/src/components/FileExplorerPanel.tsx
- Feature/system: Workspace file access
- Problem: Workspace file tree, search, read, metadata, and load-into-chat routes are public and can expose previewable workspace files.
- Fix: Require auth and workspace-read permission, add allowlisted roots, disable by default in production, and audit reads.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Workspace file routes are protected in production routing and anonymous file access returns 401 while a developer token succeeds.

## F2

- ID: F2
- Severity: Blocker
- File/path: src/server/routes/code.ts; src/core/modes/ModePolicy.ts; src/core/tools/CommandRunner.ts; src/core/agents/VerificationRunner.ts
- Feature/system: Command verification API
- Problem: The /api/code/verify route is unauthenticated and can run allowlisted build/test commands when the caller supplies an allowed mode.
- Fix: Require developer/admin auth, job queue limits, per-user rate limits, auditing, and hosted-mode disablement.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Anonymous `/api/code/verify` access returns 401 and a developer bearer token can run the allowlisted verification flow against a stubbed agent.

## F3

- ID: F3
- Severity: Blocker
- File/path: src/server/routes/knowledge-os.ts
- Feature/system: Knowledge OS persistence and database access
- Problem: Knowledge OS routes include unauthenticated wiki, memory, governance, graph, repository import, and database ask/query endpoints.
- Fix: Apply role-based auth per route, split read-only from admin endpoints, and add audit trails.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Knowledge OS routes are protected with admin-only policy; anonymous and developer-token requests are rejected while an admin token can access the summary route.

## F4

- ID: F4
- Severity: Blocker
- File/path: src/server/index.ts; src/core/config/ConfigValidator.ts
- Feature/system: Runtime configuration persistence
- Problem: Runtime settings can rewrite .env, including NODE_ENV=development and a fallback JWT secret value.
- Fix: Remove runtime .env writes, use a secure admin-only config store/secrets manager, and prevent production posture downgrade.
- Status: Verified
- Verification: Verified 2026-05-20 by removing runtime `.env` writes from the settings endpoint, accepting only allowlisted provider keys as process-scoped updates, and covering production settings reads/writes plus setup key export/persistence policy in security tests. Covered by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts src/server/routes/setup.test.ts --runInBand` and `npm run release:check`.

## F5

- ID: F5
- Severity: High
- File/path: src/server/index.ts
- Feature/system: Webhook management
- Problem: Webhook registration, listing, and deletion routes are unauthenticated.
- Fix: Require admin auth, validate URLs against SSRF rules, store secrets securely, and audit changes.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Webhook URL validation rejects unsupported protocols, loopback/private hosts, and non-HTTPS production URLs; webhook management remains admin-only in production routing.

## F6

- ID: F6
- Severity: High
- File/path: src/server/routes/setup.ts; src/core/config/APIKeyManager.ts; src/server/index.ts
- Feature/system: API-key setup wizard
- Problem: API-key setup routes exist but appear disconnected from active routing; if mounted, they expose sensitive key save/delete/import/export behavior and use fallback encryption if no secret is configured.
- Fix: Either remove the setup wizard or mount it only behind admin auth, remove key export, and require strong encryption configuration.
- Status: Verified
- Verification: Verified 2026-05-20 by route manifest inspection, `npm test -- --runTestsByPath src/core/config/APIKeyManager.test.ts src/server/routes/setup.test.ts src/server/routeManifest.test.ts`, and `npm run release:check`. `/api/setup` remains unmounted from production routing, the setup router is admin-only if mounted, browser-originated setup mutations require CSRF, plaintext key export returns 410, and persisted API keys require `API_KEY_ENCRYPTION_SECRET` with at least 32 characters.

## F7

- ID: F7
- Severity: High
- File/path: src/server/index.ts; src/core/initialization/ServiceInitializer.ts; src/core/orchestrator/EnhancedOrchestrator.ts; src/core/orchestrator/Orchestrator.ts
- Feature/system: Stable Diffusion and image generation
- Problem: Stable Diffusion is availability-checked and configurable, but the active EnhancedOrchestrator chat path does not wire image generation.
- Fix: Wire image generation into the active chat path and UI, or remove Stable Diffusion settings/documentation claims.
- Status: Verified
- Verification: Verified 2026-05-20 by removing Stable Diffusion startup probing from `src/server/index.ts`, removing Stable Diffusion settings/env exposure, confirming remaining README/setup mentions state the active chat surface is text-only, and passing `npm run release:check`.

## F8

- ID: F8
- Severity: High
- File/path: src/core/agents/CodingAgent.ts; src/core/agents/PatchGenerator.ts; src/server/routes/code.ts
- Feature/system: Patch generation
- Problem: Patch generation route and agent method exist, but createPatch returns an empty patch and PatchGenerator only creates empty diffs.
- Fix: Implement patch generation with file selection, unified diff creation, validation, approval, and rollback.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/core/agents/PatchGenerator.test.ts` and `npm run release:check`. Explicit replace/append patch requests now produce non-empty unified diffs, track changed files, and reject paths outside the workspace; approval/apply/rollback workflow remains scoped to existing code-route behavior.

## G1

- ID: G1
- Severity: Medium
- File/path: client/src/components/ModeSelector.tsx; src/server/index.ts; src/core/initialization/ServiceInitializer.ts
- Feature/system: Specialist agents and modes
- Problem: Backend initializes/routes specialist agents that are not exposed as selectable UI modes.
- Fix: Add UI modes for supported specialists or remove them from production initialization/routing.
- Status: Verified
- Verification: Verified 2026-05-20 by exposing backend specialist domains as selectable UI modes for math, market, game dev, story, legal/civic, health, security, business, philosophy, language, geography, and engineering, with matching placeholders and system prompts. Covered by `cd client; npm run test -- --run src/components/ModeSelector.test.tsx src/components/AssistantChat.test.tsx`, existing specialist route/agent tests, and `npm run release:check`.

## G2

- ID: G2
- Severity: Medium
- File/path: client/src/components/SettingsMenu.tsx; src/server/index.ts; client/src/components/FLStudioControlPanel.tsx
- Feature/system: FL Studio MCP bridge/control
- Problem: Settings expose FL Studio MCP command/args/cwd configuration, but chat routing runs FL Studio control in dry-run mode only.
- Fix: Label feature as dry-run only or implement privileged confirmed apply flow with DAW state feedback.
- Status: Verified
- Verification: Verified 2026-05-20 by labeling FL Studio settings as dry-run-first bridge configuration, adding explicit control-panel state text for dry-run/offline/live-capable modes, and testing that mode plus confirmation are sent to FL Studio command routes. Covered by `cd client; npm run test -- --run src/components/FLStudioControlPanel.test.tsx src/components/SettingsMenu.test.tsx`, `npm run type-check`, `npm run lint`, and `npm run release:check`.

## G3

- ID: G3
- Severity: Medium
- File/path: src/core/initialization/ServiceInitializer.ts
- Feature/system: Knowledge base bootstrapping
- Problem: Startup creates example knowledge-base content when the private knowledge base directory is missing.
- Fix: Do not create placeholder knowledge documents at runtime; move samples to docs or dev fixtures.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/core/initialization/ServiceInitializer.test.ts src/server/routeManifest.test.ts` and `npm run release:check`. Missing private knowledge-base directories are now skipped during startup instead of being created with placeholder documents.

## H1

- ID: H1
- Severity: Medium
- File/path: client/src/components/FileExplorerPanel.tsx; client/src/components/AudioPreviewBrowser.tsx
- Feature/system: Static/GitHub Pages compatibility
- Problem: File and audio panels are visible in the app but disabled in static builds because they require the local backend.
- Fix: Hide backend-only panels in static builds or provide a clear product mode with explicit disabled-feature messaging.
- Status: Verified
- Verification: Verified 2026-05-20 by `cd client; npm run build`. `AssistantChat` now hides backend-only File Explorer, Audio Browser, and Knowledge OS panels when `BASE_URL` indicates the static GitHub Pages build.

## H2

- ID: H2
- Severity: Medium
- File/path: src/core/multimodal/ImageProcessor.ts; src/core/multimodal/VideoProcessor.ts
- Feature/system: Media processing fallbacks and temp resources
- Problem: Image/video processing can silently return original/empty/null fallback results and lacks visible release-level resource policy for large media/temp files.
- Fix: Add size/dimension/duration limits, dependency health checks, structured unsupported states, temp cleanup tests, and user-visible errors.
- Status: Verified
- Verification: Verified 2026-05-20 by adding explicit image/video processing policy surfaces, dependency health checks, structured `ok/rejected/unsupported/error` safe results, image byte and decoded-pixel limits, video byte/duration/frame limits, injectable video temp directories, and cleanup after failed safe processing. Covered by `npm test -- --runTestsByPath src/core/multimodal/ImageProcessor.test.ts src/core/multimodal/VideoProcessor.test.ts --runInBand`, `npm run type-check`, `npm run lint`, and `npm run release:check`.

## I1

- ID: I1
- Severity: Medium
- File/path: client/src/api/files.ts; client/src/api/audio.ts; client/src/api/knowledge.ts; client/src/components/AssistantChat.tsx
- Feature/system: Client API error reporting
- Problem: Client API wrappers throw generic messages and discard backend error details.
- Fix: Parse structured API error responses, preserve error codes, and display actionable messages without leaking secrets.
- Status: Verified
- Verification: Verified 2026-05-20 by preserving structured API error status/code/details in `ApiClientError`, showing safe backend messages in file/audio/code/conversation UI surfaces without dumping raw details, and catching online-knowledge CTA failures in `AssistantChat`. Covered by `cd client; npm run test -- --run src/api/errors.test.ts src/api/files.test.ts src/api/audio.test.ts src/api/knowledge.test.ts src/components/FileExplorerPanel.test.tsx src/components/AudioPreviewBrowser.test.tsx src/components/CodeWorkflowPanel.test.tsx src/components/ConversationToolsPanel.test.tsx src/components/AssistantChat.test.tsx`, `npm run type-check`, `npm run lint`, and `npm run release:check`.

## I2

- ID: I2
- Severity: High
- File/path: src/middleware/rateLimiter.ts
- Feature/system: Rate limiting failure behavior
- Problem: Rate limiter fails open on non-rate-limit errors.
- Fix: Make fail-open/fail-closed configurable and default high-risk production routes to fail-closed with monitoring.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. RateLimiter now supports configurable fail-open/fail-closed behavior, defaults to fail-closed in production, and a simulated backend failure returns 503 through Express error handling.

## I3

- ID: I3
- Severity: Medium
- File/path: src/middleware/errorHandler.ts; route files; client/src/api/*.ts; client/src/components/AssistantChat.tsx
- Feature/system: API error schema
- Problem: API error responses are inconsistent: some use structured AppError shape while many route handlers return plain error strings.
- Fix: Standardize all API errors to one typed schema and update clients to parse it consistently.
- Status: Verified
- Verification: Verified 2026-05-20 by adding `apiErrorSchema` middleware, normalizing thrown and legacy route errors to `{ success: false, error: { message, code, details } }`, adding typed client parsing through `ApiClientError`, covering representative server/client contracts, and passing `npm run type-check`, `npm run lint`, and `npm run release:check`.

## J1

- ID: J1
- Severity: Medium
- File/path: client/src/components/SettingsMenu.tsx
- Feature/system: Settings modal accessibility
- Problem: Settings dialog uses role=dialog but lacks visible focus trap, Escape close, initial focus, and focus restoration behavior.
- Fix: Implement accessible modal behavior including focus management, Escape handling, inert background, and keyboard tests.
- Status: Verified
- Verification: Verified 2026-05-20 by adding initial focus, Escape close, Tab focus trapping, focus restoration, and keyboard tests in `client/src/components/SettingsMenu.test.tsx`; passed `cd client; npm run test`, `npm run type-check:client`, `npm run lint:client`, and `cd client; npm run coverage`.

## J2

- ID: J2
- Severity: Low
- File/path: client/src/components/ModeSelector.tsx
- Feature/system: Mode dropdown accessibility and shortcuts
- Problem: Mode dropdown uses global shortcuts and displays macOS-style shortcuts without full ARIA/menu semantics or platform-adaptive labels.
- Fix: Add aria-haspopup/expanded/menu/listbox semantics, roving focus or native select behavior, and platform-specific shortcut labels.
- Status: Verified
- Verification: Verified 2026-05-20 by adding `aria-haspopup`, `aria-expanded`, listbox/option semantics, roving focus, Escape/Arrow/Enter keyboard handling, platform-adaptive shortcut labels, and automated tests in `client/src/components/ModeSelector.test.tsx`; passed `cd client; npm run test`, `npm run type-check:client`, `npm run lint:client`, and `cd client; npm run coverage`.

## K1

- ID: K1
- Severity: High
- File/path: src/core/files/FileExplorerService.ts; src/server/routes/files.ts; client/src/components/FileExplorerPanel.tsx
- Feature/system: Workspace search performance
- Problem: File search walks up to 1000 files and reads previewable file contents sequentially for content search.
- Fix: Add auth/rate limits, indexing, debouncing, file-size caps, pagination, and cancellation.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/core/files/FileExplorerService.test.ts src/server/routes/__tests__/feature-expansion-routes.test.ts` and `npm run release:check`. File search remains behind the protected file route group, now supports result limits, offsets, max file scan caps, content-read byte caps, skipped-large-file metadata, paginated route responses, and client-side debounced/cancelled searches.

## K2

- ID: K2
- Severity: Medium
- File/path: src/core/audio/AudioLibraryService.ts; src/server/routes/audio.ts; client/src/components/AudioPreviewBrowser.tsx
- Feature/system: Audio file discovery performance
- Problem: Audio listing walks up to 1000 files and stats each matching file on refresh.
- Fix: Add caching/indexing, directory allowlists, pagination, and auth/rate limiting.
- Status: Verified
- Verification: Verified 2026-05-20 by adding cached audio discovery, max file scan caps, result pagination, truncated/cache metadata, route query parameters, client request cancellation, and a "More audio" flow. Covered by `npm test -- --runTestsByPath src/core/audio/AudioLibraryService.test.ts src/server/routes/__tests__/feature-expansion-routes.test.ts --runInBand`, `cd client; npm run test -- --run src/api/audio.test.ts`, `npm run type-check`, `npm run lint`, and `cd client; npm run coverage`.

## K3

- ID: K3
- Severity: High
- File/path: src/core/initialization/ServiceInitializer.ts; src/server/index.ts
- Feature/system: Startup performance and memory risk
- Problem: Startup initializes many optional services/agents and loads knowledge bases before full readiness.
- Fix: Separate critical startup from lazy/deferred optional service initialization and expose per-subsystem readiness.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/core/initialization/ServiceInitializer.test.ts src/server/routeManifest.test.ts` and `npm run release:check`. Persisted RAG restore, private/public knowledge-base ingestion, and coding knowledge loading now run as tracked optional initialization by default, eager startup remains available through `EAGER_KNOWLEDGE_LOAD=true` and `EAGER_CODING_KNOWLEDGE_LOAD=true`, and `/health` plus `/health/ready` expose optional subsystem status.

## L1

- ID: L1
- Severity: Blocker
- File/path: src/middleware/security.ts; src/core/config/ConfigValidator.ts
- Feature/system: CORS/security headers
- Problem: CORS defaults to wildcard origin while credentials are enabled.
- Fix: Require explicit production CORS origins, reject wildcard-with-credentials, and validate this at startup.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Production config now rejects wildcard CORS with credentials and `corsOptions` no longer defaults production to `*`.

## L2

- ID: L2
- Severity: Blocker
- File/path: src/core/auth/AuthService.ts; src/core/config/ConfigValidator.ts
- Feature/system: JWT authentication
- Problem: AuthService has an insecure default JWT secret.
- Fix: Remove default secret and fail startup without a strong configured secret.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. `AuthService` now throws without `JWT_SECRET` instead of using an insecure default.

## L3

- ID: L3
- Severity: Medium
- File/path: src/middleware/auth.ts
- Feature/system: Optional authentication
- Problem: Optional auth silently fails and continues, which can create ambiguous user behavior if used on sensitive routes.
- Fix: Use optional auth only on explicitly public routes, log invalid-token telemetry, and test no-token/invalid-token/valid-token cases.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. Optional auth keeps no-token and invalid-token requests public, logs invalid-token telemetry, and attaches valid bearer-token users.

## L4

- ID: L4
- Severity: Blocker
- File/path: src/server/routes/audio.ts; src/server/routes/files.ts; src/server/routes/plans.ts; src/server/routes/code.ts; src/server/routes/knowledge-online.ts
- Feature/system: Public high-risk route groups
- Problem: File, audio, plan, code, and online-knowledge routes are public by default.
- Fix: Classify all routes as public/user/admin/internal and apply auth, CSRF, rate-limit, and audit policy consistently.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm test -- --runTestsByPath src/server/__tests__/release-security.test.ts`. File, audio, plan, code, and online-knowledge route groups reject anonymous requests and allow developer tokens in the production auth policy harness.

## M1

- ID: M1
- Severity: Blocker
- File/path: package.json; client/package.json; src/server/index.ts; client/vite.config.ts
- Feature/system: Release packaging
- Problem: Build/start packaging does not prove a complete production app can run from one documented command or topology.
- Fix: Define production artifacts, static serving or reverse proxy topology, environment templates, and smoke tests.
- Status: Verified
- Verification: Verified 2026-05-20 by `npm run release:check` and an isolated production smoke on port 3101 with memory-only RAG: `/health/ready` returned 200, `/` served the built React HTML, and anonymous `/api/files/tree` returned 401.

## M2

- ID: M2
- Severity: High
- File/path: jest.config.js; client/package.json; eslint.config.js; CI config
- Feature/system: Release validation gates
- Problem: There is no complete release gate covering server, client, routes, security, and accessibility.
- Fix: Add CI stages for server typecheck/lint/unit/integration, client typecheck/lint/unit/a11y, e2e smoke, security route tests, and packaging smoke.
- Status: Verified
- Verification: Verified 2026-05-20 by splitting CI into explicit release stages for server typecheck, test typecheck, client typecheck, server/client lint, security route tests, route/service tests, e2e smoke, client test/a11y scripts, and packaging smoke, then passing `npm run test:release` and `npm run release:check`. Hosted CI still needs to run on the branch before merge.

## M3

- ID: M3
- Severity: Medium
- File/path: src/server/routes/admin.ts
- Feature/system: Admin validation/observability
- Problem: Admin cache clear and log retrieval are placeholders or simplified implementations.
- Fix: Implement real cache-layer clearing and log retrieval or remove endpoints from production.
- Status: Verified
- Verification: Verified 2026-05-20 by implementing real admin cache clearing across cache services with supported clear/flush methods, adding whole-cache clearing to memory/Redis/disk cache layers, and replacing placeholder log retrieval with bounded, allowlisted, redacted log tail reads. Covered by `npm test -- --runTestsByPath src/server/routes/admin.test.ts --runInBand`, `npm run type-check`, `npm run lint`, and `npm run release:check`.

## N1

- ID: N1
- Severity: High
- File/path: README.md; src/core/orchestrator/EnhancedOrchestrator.ts; src/core/orchestrator/Orchestrator.ts; src/server/index.ts
- Feature/system: Feature documentation accuracy
- Problem: README claims production-grade dual text/image behavior and Stable Diffusion integration, but active chat path does not wire image generation.
- Fix: Align docs with active behavior or complete active image-generation wiring.
- Status: Verified
- Verification: Verified 2026-05-20 by README/docs review and `npm run release:check`. README, quickstart, setup docs, env example, and planning roadmap no longer claim active dual text/image chat; they state or preserve that the active production chat surface renders text only.

## N2

- ID: N2
- Severity: Medium
- File/path: docs/reports/STUBS_AND_PLACEHOLDERS_REPORT.md; src/core/multimodal/ImageProcessor.ts; src/core/multimodal/VideoProcessor.ts; src/core/tools/WebSearcher.ts
- Feature/system: Internal audit documentation freshness
- Problem: The stubs/placeholders report is stale and contradicts current source for image, video, and web search implementations.
- Fix: Regenerate the report from current source or mark it archived with a superseding report.
- Status: Verified
- Verification: Verified 2026-05-20 by replacing `docs/reports/STUBS_AND_PLACEHOLDERS_REPORT.md` with a current-source report that supersedes the stale 2025-12-21 findings, documents implemented ImageProcessor/VideoProcessor/WebSearcher behavior, and preserves only current optional-dependency/provider limitations. Confirmed with `rg` source/report scans and `npm run release:check`.

## N3

- ID: N3
- Severity: High
- File/path: README.md; src/server/index.ts; client/vite.config.ts; client/src/api/runtime.ts
- Feature/system: Developer handoff and deployment-mode docs
- Problem: Docs do not clearly distinguish local dev, static demo, and full production API+client deployment modes.
- Fix: Add deployment-mode documentation with supported features, required env vars, disabled static-build features, and smoke-test checklist.
- Status: Verified
- Verification: Verified 2026-05-20 by README update and new `docs/DEPLOYMENT_MODES.md`, with local dev, full production, static demo caveats, required env vars, privileged route policy, and smoke checklist documented.
