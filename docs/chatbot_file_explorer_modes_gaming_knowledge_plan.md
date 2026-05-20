# Chatbot File Explorer, Mode Guardrails, Gaming Module, and Online Knowledge Ingestion Plan

**Repository:** `DocDamage/chatbot`  
**Branch scanned:** `main`  
**Plan date:** 2026-05-20  
**Status:** Plan-only. No implementation changes have been made.

## 1. Goal

Add four major capabilities to the chatbot application:

1. A Codex/IDE-style file explorer that lets users browse, search, preview, and load repo/workspace files into chat context.
2. A DAW-style audio browser for `fl_studio`, `pro_tools`, `logic`, and related music modes, including in-browser audio preview similar to FL Studio’s browser.
3. Hard mode guardrails:
   - `plan` mode creates and saves Markdown plans only.
   - `implement` mode is the only mode allowed to write code or generate/apply patches.
   - `debug` mode is the only mode allowed to perform debugging workflows.
4. A dedicated `gaming` module that goes beyond the current `gamedev` agent and can answer broad gaming questions, game-making questions, engine questions, platform questions, modding questions, lore questions, and game-analysis questions.
5. A knowledge-miss flow: when local knowledge lacks an answer, prompt the user to search online; after retrieval, ingest the learned information into the local knowledge database.

## 2. Current Repo Scan Summary

The repo is a TypeScript/React AI Chatbot Hub with an Express backend, a React/Vite client, provider abstraction, RAG, a service initializer, specialist agents, upload processing, repo tools, and multiple specialist routes.

Key existing pieces to reuse:

- `client/src/components/AssistantChat.tsx`
  - Active chat UI.
  - Sends `/api/chat` requests with `message`, `sessionId`, `mode`, and a mode-specific system prompt.
  - Already supports `plan`, `implement`, `debug`, music/DAW modes, and `fl_studio_control`.
- `client/src/components/ModeSelector.tsx`
  - Current client-side mode list and mode picker.
  - Needs a new `gaming` mode and stricter client-side warnings/CTA behavior.
- `src/server/index.ts`
  - Central API route stack and `/api/chat` routing.
  - Already initializes specialist modes and routes requests to agents.
  - Needs mode policy enforcement before specialist/generic routing.
- `src/core/agents/CodingAgent.ts`
  - Current coding agent gathers evidence, builds a plan, returns an empty patch, and can verify/review.
  - Needs explicit separation between plan-only, implement-only, and debug-only workflows.
- `src/core/agents/CodePlanner.ts`
  - Already creates structured code plans.
  - Should be wrapped by a Markdown plan persistence service.
- `src/server/routes/code.ts`
  - Existing code endpoints include ask, plan, patch, review, verify, file search, and symbols.
  - Needs mode restrictions and plan-save endpoints.
- `src/core/tools/RepoTools.ts`
  - Already has safe path logic, file listing, repo search, file read, symbols, references, import graph, command tools, and disabled patch apply behavior.
  - Best starting point for the file explorer backend.
- `src/core/rag/DocumentManager.ts` and `src/core/rag/DocumentIngester.ts`
  - Already ingest text/files/directories and persist chunks into RAG.
  - Best starting point for online-learning ingestion.
- `src/core/tools/WebSearcher.ts`
  - Already supports DuckDuckGo, Google CSE, Bing, and a registered `search_web` tool.
  - Best starting point for “go online” when local knowledge misses.
- `src/core/knowledge/LocalKnowledgeAnswerer.ts`
  - Currently returns a no-local-record message and stops.
  - Needs to return a structured knowledge miss instead.
- `src/core/agents/gamedev/GameDevGeniusAgent.ts`
  - Existing game-dev module focuses on game design, balance, prototypes, engines, mechanics, and level design.
  - Useful foundation, but it is not yet a broad `gaming` module.
- `src/core/nlu/phrasebooks/gamedev.phrasebook.ts`
  - Very small current phrasebook.
  - Needs a broader gaming phrasebook.
- `client/src/components/FLStudioControlPanel.tsx`
  - Existing FL Studio control cockpit.
  - New audio browser should sit beside or under this panel in music/DAW modes.

## 3. Non-Negotiable Behavior Rules

### 3.1 Plan mode

Plan mode must never write code, generate implementation code, apply patches, run implementation commands, or debug errors.

Plan mode is allowed to:

- Inspect relevant files.
- Create a written implementation plan.
- Save the plan as a Markdown file.
- Return the plan summary to chat.
- Offer a UI action: “Switch to Implement”.

Plan mode response must include:

- `planId`
- `planPath`
- `savedMarkdown: true`
- `suggestedNextMode: "implement"`
- a visible “Switch to Implement” CTA in the UI.

### 3.2 Implement mode

Implement mode is the only mode allowed to:

- Generate code changes.
- Create patches.
- Apply patches when enabled.
- Write or modify files.
- Run implementation-oriented commands.
- Convert a saved plan into code.

Implement mode may load a saved plan and selected files from the file explorer.

### 3.3 Debug mode

Debug mode is the only mode allowed to:

- Diagnose stack traces.
- Investigate runtime errors.
- Run debugging/verification commands.
- Propose bug fixes.
- Inspect logs as part of a bug workflow.

If the user pastes a stack trace or asks for debugging in any non-debug mode, the app should respond with:

“Debugging is only available in Debug mode. Switch to Debug to investigate this issue.”

The UI should show a “Switch to Debug” action.

## 4. Phase 1 — Shared Mode Policy and Guardrails

### Files to add

- `src/types/modes.ts`
- `src/core/modes/ModePolicy.ts`
- `src/core/modes/ModePolicy.test.ts`

### Files to update

- `src/server/index.ts`
- `src/server/routes/code.ts`
- `client/src/components/AssistantChat.tsx`
- `client/src/components/ModeSelector.tsx`

### Design

Create a shared mode vocabulary:

- `ask`
- `plan`
- `implement`
- `debug`
- `explain`
- `gaming`
- `gamedev`
- `music`
- `suno`
- `fl_studio`
- `fl_studio_control`
- `pro_tools`
- `logic`
- `mix_master`
- existing specialist modes

Create deterministic policy helpers:

- `canPlan(mode)`
- `canImplement(mode)`
- `canDebug(mode)`
- `canRunCommands(mode)`
- `canGeneratePatch(mode)`
- `canApplyPatch(mode)`
- `requiresSwitchForIntent(mode, intent)`

The server must enforce policy before calling coding, patch, command, or debug flows. Client-side warnings are helpful, but server enforcement is required.

### Acceptance criteria

- `/api/chat` in `plan` mode never returns code-writing output.
- `/api/code/patch` rejects requests unless mode is `implement`.
- `/api/code/verify` rejects debugging-style commands unless mode is `debug` or explicitly safe verification attached to implement.
- Stack traces in `ask`, `plan`, or `implement` return a switch-to-debug prompt.
- Feature implementation requests in `plan` return a saved Markdown plan and switch-to-implement prompt.

## 5. Phase 2 — Markdown Plan Persistence

### Files to add

- `src/core/planning/PlanDocumentService.ts`
- `src/server/routes/plans.ts`
- `src/core/planning/PlanDocumentService.test.ts`

### Files to update

- `src/core/agents/CodingAgent.ts`
- `src/core/agents/CodePlanner.ts`
- `src/server/index.ts`
- `client/src/components/AssistantChat.tsx`

### Storage

Save plans under:

- `plans/YYYY-MM-DD/<slug>-<short-id>.md`

Each plan should include:

- Title
- User request
- Mode
- Created timestamp
- Affected files guessed from evidence
- Implementation phases
- Acceptance criteria
- Risks
- Verification checklist
- “Implementation entry point” instructions for implement mode

### API

Add:

- `POST /api/plans`
  - Creates a plan from user request.
  - Saves Markdown.
  - Returns `planId`, `planPath`, `title`, `summary`, and `suggestedNextMode`.
- `GET /api/plans`
  - Lists saved plans.
- `GET /api/plans/:planId`
  - Reads saved plan metadata and content.
- `POST /api/plans/:planId/load`
  - Loads a plan into chat context.

### UI

When a plan is created, assistant message should show:

- Saved plan path.
- Brief summary.
- “Switch to Implement” button.
- “Open Plan” button.
- “Copy Plan Path” button.

### Acceptance criteria

- A plan request creates a real `.md` file.
- The app never enters implementation from plan mode automatically.
- The user must explicitly switch to implement mode to start coding.
- Implement mode can load the plan context by `planId`.

## 6. Phase 3 — Codex/IDE-Style File Explorer

### Files to add

- `src/core/files/FileExplorerService.ts`
- `src/server/routes/files.ts`
- `src/core/files/FileExplorerService.test.ts`
- `client/src/components/FileExplorerPanel.tsx`
- `client/src/components/FileExplorerPanel.css`
- `client/src/components/FilePreviewPane.tsx`
- `client/src/components/LoadedFilesBar.tsx`
- `client/src/api/files.ts`

### Files to update

- `src/server/index.ts`
- `client/src/App.tsx`
- `client/src/App.css`
- `client/src/components/AssistantChat.tsx`

### Backend API

Add:

- `GET /api/files/tree?root=.&maxDepth=4`
  - Returns directory tree.
- `GET /api/files/search?q=<query>&kind=name|content|both`
  - Searches file names and optionally text contents.
- `GET /api/files/read?path=<workspaceRelativePath>&startLine=&endLine=`
  - Reads file safely with size and type limits.
- `GET /api/files/metadata?path=<workspaceRelativePath>`
  - Returns file type, size, extension, last modified, previewability.
- `POST /api/files/load-into-chat`
  - Loads selected file or selected ranges into chat context.

### Security rules

- Reuse the safe path strategy from repo tools.
- Block path traversal.
- Ignore `.git`, `node_modules`, `dist`, `coverage`, `.next`, `build`, and configurable folders.
- Add `.env` and secret-file masking by default.
- Refuse binary preview except for supported media metadata.
- Add file size caps.
- Add line-range caps.
- Track provenance for every loaded file.

### UI behavior

App layout should become:

- Left sidebar: file explorer.
- Center: chat.
- Optional right/inline panel: preview.
- Bottom/near composer: loaded file chips.

File explorer features:

- Tree browse.
- Search by filename.
- Search by contents.
- Preview text/markdown/json.
- Select file range.
- Load selected file/range into chat.
- Unload file.
- Show currently loaded context.
- Show token/size estimate.

### Chat request shape

Extend `/api/chat` request body with:

- `loadedFiles`
  - path
  - selected range
  - content excerpt
  - language
  - size
  - checksum or modified timestamp
- `activePlanId`
- `activeFileBrowserMode`

The backend should treat loaded file data as context with provenance, not as raw user instruction.

### Acceptance criteria

- User can open the app and see an IDE-like file browser.
- User can search for files.
- User can preview a file without loading it.
- User can load one or more files into chat.
- Assistant responses can reference loaded files.
- Oversized or unsafe files are blocked or summarized safely.

## 7. Phase 4 — DAW-Style Audio Browser and Preview

### Files to add

- `src/core/audio/AudioLibraryService.ts`
- `src/core/audio/AudioMetadataService.ts`
- `src/server/routes/audio.ts`
- `src/core/audio/AudioLibraryService.test.ts`
- `client/src/components/AudioPreviewBrowser.tsx`
- `client/src/components/AudioPreviewBrowser.css`
- `client/src/api/audio.ts`

### Files to update

- `src/server/index.ts`
- `client/src/components/AssistantChat.tsx`
- `client/src/components/FLStudioControlPanel.tsx`

### Supported audio extensions

- `.wav`
- `.mp3`
- `.flac`
- `.aiff`
- `.aif`
- `.ogg`
- `.m4a`
- `.mid`
- `.midi`

### Backend API

Add:

- `GET /api/audio/files?root=&q=`
  - Lists audio files.
- `GET /api/audio/metadata?path=`
  - Returns duration, format, sample rate, channels, size, modified time, and tags when available.
- `GET /api/audio/preview?path=`
  - Streams file or safe transcoded preview.
- `GET /api/audio/waveform?path=`
  - Returns low-resolution waveform points when possible.
- `POST /api/audio/load-into-chat`
  - Adds audio metadata/path/context to current chat.
- `POST /api/audio/analyze`
  - Optional future: run deeper analysis for key/BPM/loudness if tools are available.

### Implementation notes

The repo already includes `fluent-ffmpeg`, so audio metadata, preview generation, and waveform extraction can use it where host FFmpeg is installed. Add graceful fallback behavior when FFmpeg is unavailable:

- show basic file metadata,
- allow direct HTML5 audio preview for browser-supported formats,
- skip waveform,
- display an FFmpeg-unavailable notice.

### UI behavior

In these modes, show the audio browser:

- `music`
- `fl_studio`
- `fl_studio_control`
- `pro_tools`
- `logic`
- `mix_master`

The audio browser should feel like FL Studio’s browser:

- folder list,
- audio file list,
- one-click preview,
- stop preview when another sample is clicked,
- duration and format badges,
- optional waveform,
- “Load into chat”,
- optional “Use in DAW plan” for FL Studio control mode.

Do not autoplay by default. Preview starts only on user click.

### Acceptance criteria

- Switching to FL Studio, Pro Tools, or Logic shows an audio browser.
- Clicking an audio file previews it in-browser.
- Chat can receive audio metadata and file path context.
- Missing FFmpeg does not break the app.
- Unsafe paths are blocked.

## 8. Phase 5 — Dedicated Gaming Module

### Files to add

- `src/core/agents/gaming/GamingGeniusAgent.ts`
- `src/core/agents/gaming/GamingIntentClassifier.ts`
- `src/core/agents/gaming/GamingKnowledgeRouter.ts`
- `src/core/nlu/phrasebooks/gaming.phrasebook.ts`
- `src/server/routes/gaming.ts`
- `src/core/agents/gaming/GamingGeniusAgent.test.ts`

### Files to update

- `src/core/nlu/phrasebooks/index.ts`
- `src/core/initialization/ServiceInitializer.ts`
- `src/server/index.ts`
- `client/src/components/ModeSelector.tsx`
- `client/src/components/AssistantChat.tsx`
- `src/core/knowledge/LocalKnowledgeAnswerer.ts` or a new generic domain answerer

### Scope

The `gaming` module should cover:

- Game design
- Game development
- Engines: Godot, Unity, Unreal, Phaser, RPG Maker, GameMaker
- Level design
- Combat design
- Economy and progression
- Game feel
- UI/HUD design
- Pixel art and animation pipelines
- Modding
- Emulation concepts
- Save editors and ROM hacking concepts
- Game lore and franchise questions
- Hardware/platform differences
- Esports and competitive mechanics
- Speedrunning and routing
- Accessibility
- QA/playtesting
- Game audio
- Game business/monetization when relevant

### Relationship with existing `gamedev`

Keep `gamedev` as the specialized implementation/design agent. Add `gaming` as the broader umbrella agent.

Routing:

- `gaming` handles broad game questions.
- `gamedev` handles build/design/prototype/balance implementation requests.
- The `gaming` agent can delegate to `GameDevGeniusAgent` for game development tasks.

### UI

Add a `Gaming` mode in `ModeSelector`:

- Label: `Gaming`
- Description: `Games, game dev, engines, lore, modding, strategy`
- Placeholder: `Ask about games, engines, design, modding, lore, or strategy...`

### Acceptance criteria

- `gaming` mode appears in the UI.
- Explicit `gaming` mode routes to `GamingGeniusAgent`.
- Broad gaming questions no longer get forced into pop culture or generic chat.
- Game-dev questions can still delegate to existing `GameDevGeniusAgent`.
- Gaming knowledge can use local RAG and online-ingest flow.

## 9. Phase 6 — Knowledge Miss, Online Search Prompt, and Ingestion

### Files to add

- `src/core/knowledge/KnowledgeMiss.ts`
- `src/core/knowledge/KnowledgeMissHandler.ts`
- `src/core/knowledge/OnlineKnowledgeIngestionService.ts`
- `src/server/routes/knowledge-online.ts`
- `client/src/components/KnowledgeMissPrompt.tsx`
- `client/src/api/knowledge.ts`
- `src/core/knowledge/OnlineKnowledgeIngestionService.test.ts`

### Files to update

- `src/core/knowledge/LocalKnowledgeAnswerer.ts`
- `src/server/index.ts`
- `src/core/initialization/ServiceInitializer.ts`
- `client/src/components/AssistantChat.tsx`

### Current problem

The current local answerer returns a final response saying the database has no matching record. That behavior should become a structured miss flow.

### New flow

1. User asks a question.
2. Local RAG/domain knowledge is searched.
3. If no sufficient local match:
   - backend returns `knowledgeMiss: true`,
   - proposed web query,
   - recommended sources,
   - `canSearchOnline: true`.
4. UI displays:
   - “I don’t have this in the local knowledge database.”
   - “Search online and learn it?”
   - buttons: `Search Online`, `Cancel`.
5. If user clicks `Search Online`:
   - backend searches using `WebSearcher` and/or specialized sources.
   - results are summarized with source URLs and timestamps.
6. UI shows:
   - answer preview,
   - sources,
   - `Ingest into Knowledge Base` button.
7. If user approves ingestion:
   - backend calls `DocumentManager.addText`,
   - stores metadata:
     - source URL,
     - title,
     - retrieved timestamp,
     - domain,
     - original query,
     - ingestion method,
     - confidence,
     - approvedBy/sessionId.
8. Re-asking the same or similar question should hit local knowledge.

### Optional setting

Add a setting:

- `AUTO_INGEST_ONLINE_KNOWLEDGE=false`

Default should be false. User approval should be required before storing online content.

### Safety and quality rules

- Prefer authoritative sources.
- Store concise summaries and permitted excerpts, not large copied pages.
- Keep provenance metadata.
- Deduplicate by URL and content hash.
- Mark stale/current-event material with retrieval date.
- Respect robots/blocked fetch behavior.
- Keep high-risk domains such as medical, legal, financial, and security in caution mode with citations and timestamps.

### Acceptance criteria

- Local miss returns a UI prompt instead of a dead-end answer.
- User can trigger online search.
- User can ingest retrieved knowledge.
- Subsequent queries can answer from local DB.
- Ingested records include provenance metadata.

## 10. Phase 7 — Tests and Verification

### Unit tests

Add tests for:

- `ModePolicy`
- `PlanDocumentService`
- `FileExplorerService`
- `AudioLibraryService`
- `GamingGeniusAgent`
- `KnowledgeMissHandler`
- `OnlineKnowledgeIngestionService`

### API tests

Add tests for:

- plan creation,
- file tree/search/read/load,
- audio list/metadata/preview route behavior,
- gaming route,
- knowledge miss/search/ingest route,
- mode-policy rejection behavior.

### Client checks

At minimum:

- TypeScript build.
- Manual UI verification.
- File explorer smoke test.
- Audio preview smoke test.
- Mode-switch CTA smoke test.

### Verification commands

Run:

- `npm run type-check`
- `npm test -- --runInBand`
- `npm run build`
- `cd client && npm run build`

## 11. Implementation Order

Recommended order:

1. Add mode policy guardrails first.
2. Add Markdown plan persistence and switch-to-implement CTA.
3. Add file explorer backend routes.
4. Add file explorer UI.
5. Add audio browser backend routes.
6. Add audio browser UI.
7. Add gaming module and route wiring.
8. Add knowledge miss and online ingestion flow.
9. Add tests.
10. Run verification.

This order prevents accidental code-writing behavior while the rest of the UI is being built.

## 12. Risks

- Current client and server define mode concepts separately. They should be unified or kept in strict sync.
- The app has many route factories mounted dynamically; new routes must be mounted in a predictable place to avoid route conflicts.
- Audio preview depends on host/browser support and optional FFmpeg availability.
- Online ingestion can create low-quality or stale knowledge if provenance, dedupe, and user approval are weak.
- Plan/implement/debug restrictions must be enforced server-side, not only through prompts.
- Existing `gamedev` is narrow; adding `gaming` without clear delegation could confuse routing.

## 13. Definition of Done

The feature is done when:

- The app has a Codex-style file browser.
- Users can search, preview, and load files into chat.
- DAW modes show an audio browser with click-to-preview.
- Plan mode creates saved Markdown plans only.
- Plan mode gives a switch-to-implement action.
- Implement mode is the only code-writing mode.
- Debug mode is the only debugging mode.
- A broad Gaming mode exists and routes correctly.
- Knowledge misses prompt online lookup.
- Online results can be ingested into local knowledge with provenance.
- All new server/client paths pass type-check, tests, and build.
