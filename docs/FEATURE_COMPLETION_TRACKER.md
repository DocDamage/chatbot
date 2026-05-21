# Feature Completion Tracker

Generated: 2026-05-20
Updated: 2026-05-20

This file tracks **new product capabilities being planned or built**. It is intentionally separate from `RELEASE_COMPLETION_AUDIT.md`, which should only track release-readiness findings in existing code.

Status values:
- Open: Feature requirement exists and implementation has not started.
- In Progress: Work has started but is not complete.
- Fixed: Implementation exists but is not fully verified.
- Verified: Feature has been proven by a build, test, typecheck, lint, runtime check, or clear manual inspection.
- Blocked: Work cannot proceed until a dependency or product decision is resolved.

Verification rule: Do not mark any item Verified unless the Verification field names the proof.

Current verification baseline: No build, test, typecheck, lint, runtime check, or production packaging smoke test was run while creating this tracker. All new-feature items remain Open or Blocked until implementation and verification are completed.

---

# Creative Writing and Roleplay Release Track

This track defines a production-grade creative writing and roleplay system. It supports ordinary fiction, genre fiction, horror, fantasy, science fiction, westerns, romance, mature themes, interactive roleplay, long-form drafting, revision, persistence, and export. It must be implemented as a first-class product capability, not as ad hoc generic chat behavior.

## CW1

- ID: CW1
- Severity: High
- File/path: client/src/components/ModeSelector.tsx; client/src/components/AssistantChat.tsx; src/server/index.ts; src/core/modes/ModePolicy.ts
- Feature/system: Creative Writing mode registration
- Problem: There is no first-class Creative Writing / Roleplay mode in the visible mode selector, mode hints, placeholders, system prompt selection, backend mode policy, or specialist routing.
- Fix: Add a dedicated `creative_writing` mode and `roleplay` submode. Register them in the UI mode selector, chat placeholders, mode hints, server mode inference, mode policy, and backend routing. Ensure they are distinct from ask, story, language, and generic chat so creative workflows get specialized handling.
- Status: Open
- Verification: Not verified. Requires static inspection of UI/backend registration plus runtime manual check that the mode appears and routes to the creative-writing handler.

## CW2

- ID: CW2
- Severity: Blocker
- File/path: Product requirements; src/core/safety/SafetyPipeline.ts; src/core/modes/ModePolicy.ts; creative-writing route/agent files to be created
- Feature/system: Mature creative writing policy and boundaries
- Problem: The requested capability says the app must have no filter and support fully unrestricted XXX/NSFW roleplay in any manner. As stated, that is not release-ready because public release still requires legal, platform, privacy, safety, and age-appropriate boundaries.
- Fix: Replace the unrestricted bypass requirement with an opt-in Mature Creative Writing policy that supports adult fictional writing where permitted while blocking illegal, exploitative, minor-involved, real-person sexual, non-consensual sexual, privacy-invasive, self-harm enabling, or otherwise non-compliant content. Make the policy explicit in product requirements and enforce it consistently in UI and backend.
- Status: Blocked
- Verification: Not verified. Blocked until the product requirement is changed from unrestricted/no-filter to a release-safe mature creative-writing policy and then verified by policy tests.

## CW3

- ID: CW3
- Severity: High
- File/path: src/core/agents; src/core/creative; src/server/routes/creative.ts; client/src/components/AssistantChat.tsx
- Feature/system: Dedicated creative writing agent
- Problem: Creative writing currently has no dedicated agent that can handle fiction drafting, roleplay state, long-form continuity, genre conventions, character voice, scene goals, revisions, and multi-turn narrative control.
- Fix: Implement `CreativeWritingAgent` with methods for `draftScene`, `continueScene`, `revisePassage`, `outlineNovel`, `buildCharacter`, `buildWorld`, `roleplayTurn`, `summarizeContinuity`, and `exportDraft`. Route creative_writing mode through this agent instead of generic chat.
- Status: Open
- Verification: Not verified. Requires unit tests for each agent method and runtime chat test through creative_writing mode.

## CW4

- ID: CW4
- Severity: High
- File/path: src/core/creative; src/core/memory; src/core/knowledge-os; client/src/components
- Feature/system: Story bible and continuity memory
- Problem: Long-form creative writing needs durable continuity for characters, locations, relationships, timelines, lore rules, unresolved plot threads, tone, rating, and prior chapters. No production story-bible data model or UI is present.
- Fix: Add a StoryBible store with entities for characters, locations, factions, lore rules, timeline events, chapters, scenes, style guide, rating rules, and continuity notes. Provide UI to view/edit/pin these items and inject them into creative responses.
- Status: Open
- Verification: Not verified. Requires persistence tests, UI manual inspection, and an integration test proving continuity from a previous chapter affects a later draft.

## CW5

- ID: CW5
- Severity: High
- File/path: client/src/components; src/core/creative; src/server/routes/creative.ts
- Feature/system: Roleplay session engine
- Problem: Roleplay needs session state for player character, assistant character, narrator mode, scene location, active cast, boundaries, goals, inventory/props if relevant, and out-of-character controls. No such engine is visible.
- Fix: Implement roleplay sessions with explicit state, turn history, in-character and out-of-character modes, pause/resume, regenerate, branch, summarize, and reset controls. Add backend persistence and frontend controls.
- Status: Open
- Verification: Not verified. Requires runtime test that a roleplay session preserves character/scene state across multiple turns and can be paused/resumed.

## CW6

- ID: CW6
- Severity: Medium
- File/path: client/src/components; src/core/creative
- Feature/system: Genre and format preset matrix
- Problem: The app does not expose structured controls for genres and formats such as epic fantasy, dark horror, space opera, country western, noir, romance, comedy, mystery, cyberpunk, historical fiction, screenplay, chapter draft, short story, serial episode, lore entry, or dialogue-only scene.
- Fix: Add a genre/format preset matrix with prompt scaffolds, tone defaults, pacing defaults, rating defaults, and output templates. Allow custom presets and saved user presets.
- Status: Open
- Verification: Not verified. Requires UI inspection and tests proving selected presets alter generated output instructions.

## CW7

- ID: CW7
- Severity: High
- File/path: client/src/components/AssistantChat.tsx; creative-writing UI files to be created
- Feature/system: Creative composer controls
- Problem: The chat composer has no controls for POV, tense, tone, rating, genre, narrator style, length, prose density, dialogue density, pacing, violence level, romance level, mature-mode opt-in, continuity source, or revision target.
- Fix: Add a Creative Composer panel with structured controls and persist the selected creative configuration into each request DTO.
- Status: Open
- Verification: Not verified. Requires manual UI inspection and integration test proving composer settings are included in backend requests.

## CW8

- ID: CW8
- Severity: High
- File/path: src/core/creative; src/core/safety; client/src/components
- Feature/system: Mature-fiction handling
- Problem: Creative writing needs a controlled, opt-in mature-fiction path. There is no visible rating system, consent boundary state, or mature-mode UI that distinguishes general fiction from adult-oriented fiction.
- Fix: Add rating presets such as General, Teen, Mature, and Adult Fiction. Require explicit mature-mode enablement for adult-fiction requests, store the rating in the creative session, and enforce boundaries through creative-specific policy checks.
- Status: Open
- Verification: Not verified. Requires policy tests, UI inspection, and runtime tests for rating changes.

## CW9

- ID: CW9
- Severity: High
- File/path: src/core/creative; client/src/components
- Feature/system: Consent and boundary state for roleplay
- Problem: Roleplay sessions need explicit boundaries, content preferences, fade-to-black behavior, hard limits, and session reset behavior. No boundary-state model exists.
- Fix: Add `RoleplayBoundaryState` with hard limits, preferred tone/rating, fade-to-black trigger, disallowed themes, allowed mature themes, and out-of-character override controls. Inject it into the agent and display it in the UI.
- Status: Open
- Verification: Not verified. Requires unit tests and runtime roleplay checks proving boundary state changes behavior.

## CW10

- ID: CW10
- Severity: High
- File/path: src/core/creative; client/src/components; src/server/routes/creative.ts
- Feature/system: Long-form novel workflow
- Problem: Creative writing needs workflows for premise, logline, outline, beat sheet, chapter outline, scene list, draft chapters, continuity review, revision pass, and final export. The current chat interface is not enough for novel-scale work.
- Fix: Add a long-form project workflow with project creation, outline generation, chapter/scene planning, draft generation, revision passes, continuity checks, and export.
- Status: Open
- Verification: Not verified. Requires an end-to-end manual workflow creating a project, drafting at least two scenes, revising one, and exporting.

## CW11

- ID: CW11
- Severity: Medium
- File/path: src/core/creative; client/src/components
- Feature/system: Revision and editing passes
- Problem: Creative writing requires rewrite modes such as expand, condense, make darker, make funnier, increase tension, improve dialogue, show-don't-tell, line edit, copy edit, continuity fix, and rating adjustment. These are not first-class UI/backend operations.
- Fix: Add structured revision commands and UI buttons that operate on selected passage, current scene, chapter, or whole project.
- Status: Open
- Verification: Not verified. Requires tests for revision command routing and manual UI inspection.

## CW12

- ID: CW12
- Severity: Medium
- File/path: src/core/creative; client/src/components
- Feature/system: Branching and alternate takes
- Problem: Roleplay and fiction drafting benefit from branching paths, alternate scene takes, and rewind points. The current chat state is linear and ephemeral.
- Fix: Add branch IDs, parent turn IDs, alternate draft storage, compare/regenerate controls, and restore branch behavior.
- Status: Open
- Verification: Not verified. Requires runtime test creating two alternate continuations and restoring one branch.

## CW13

- ID: CW13
- Severity: High
- File/path: src/core/creative; src/core/storage; client/src/components
- Feature/system: Draft persistence, versioning, and export
- Problem: Creative drafts are not persisted as versioned projects with chapters/scenes and cannot be reliably exported from the active UI.
- Fix: Add persistent `CreativeProject`, `Chapter`, `Scene`, `DraftVersion`, and `Export` services. Support Markdown, plain text, and JSON export with story-bible metadata.
- Status: Open
- Verification: Not verified. Requires persistence tests and export file inspection.

## CW14

- ID: CW14
- Severity: Medium
- File/path: src/core/creative; client/src/components
- Feature/system: Character voice and narrator controls
- Problem: Creative mode needs controllable character voice, narrator voice, dialogue density, prose density, humor level, dialect handling, and point-of-view consistency. No structured controls exist.
- Fix: Add character voice cards, narrator profiles, POV/tense validators, dialogue/prose sliders, and consistency checks.
- Status: Open
- Verification: Not verified. Requires unit tests for request DTO generation and manual output review.

## CW15

- ID: CW15
- Severity: High
- File/path: src/core/creative; src/core/safety; docs/copyright-style-policy.md
- Feature/system: Copyright-safe style handling
- Problem: User examples include Lord of the Rings type material and Stephen King type material. The app needs genre/style inspiration without copying protected worlds, characters, text, or imitating a living author too closely.
- Fix: Add style transformation rules that convert requests into copyright-safe descriptors, such as mythic secondary-world epic fantasy or small-town supernatural psychological horror, and block direct continuation of protected works or exact living-author imitation.
- Status: Open
- Verification: Not verified. Requires tests for safe transformations and refusals/redirects for protected-world or living-author imitation requests.

## CW16

- ID: CW16
- Severity: Medium
- File/path: src/core/creative; src/core/analytics; src/core/logging; client/src/components
- Feature/system: Privacy for intimate or sensitive creative sessions
- Problem: Mature roleplay and personal creative writing can contain sensitive personal data. Existing chat/logging/persistence paths do not define privacy retention, redaction, export, or deletion behavior for creative sessions.
- Fix: Add privacy controls for creative projects: local/private flag, retention period, delete project, redact logs, disable analytics for sensitive sessions, and export/delete-my-data behavior.
- Status: Open
- Verification: Not verified. Requires privacy tests proving deletion and log redaction behavior.

## CW17

- ID: CW17
- Severity: Medium
- File/path: src/core/creative; src/core/providers; src/core/orchestrator
- Feature/system: Model/provider capability for creative quality
- Problem: The local template fallback is not capable of high-quality long-form fiction or nuanced roleplay. Creative mode needs provider capability checks and graceful degradation.
- Fix: Add model capability detection for long context, creative writing quality, instruction following, and safety classification. Show user-visible degraded mode when only template fallback is active.
- Status: Open
- Verification: Not verified. Requires provider matrix tests and runtime check with template fallback active.

## CW18

- ID: CW18
- Severity: Medium
- File/path: src/core/creative; scripts/evals; package.json
- Feature/system: Creative writing evaluations
- Problem: There are eval scripts for many domains, but no visible creative-writing or roleplay evaluation suite that measures continuity, genre adherence, instruction following, safe mature handling, copyright safety, and refusal quality.
- Fix: Add `eval:creative` and `eval:roleplay` scripts with golden tasks for genre fidelity, continuity, character voice, revision quality, mature-content boundaries, and copyright-safe transformation.
- Status: Open
- Verification: Not verified. Requires successful eval run and reviewed score report.

## CW19

- ID: CW19
- Severity: Medium
- File/path: client/src/components; src/server/routes/creative.ts; README.md; docs/creative-writing.md
- Feature/system: Documentation and user-facing guidance
- Problem: Creative writing and roleplay requirements, controls, supported genres, mature-mode behavior, persistence, export, and boundaries are not documented.
- Fix: Add creative-writing docs, roleplay guide, genre preset guide, mature-fiction policy, copyright-safe style guide, and developer handoff notes.
- Status: Open
- Verification: Not verified. Requires documentation review and manual comparison against implemented UI/backend behavior.

## CW20

- ID: CW20
- Severity: High
- File/path: src/server/routes/creative.ts; src/core/creative; src/middleware/validator.ts
- Feature/system: Creative request schema and validation
- Problem: Creative mode needs structured request validation for genre, format, rating, boundaries, story bible IDs, character IDs, project IDs, scene IDs, revision operation, and output length. No schema exists.
- Fix: Add zod schemas or equivalent DTO validation for creative requests and responses. Reject malformed project IDs, invalid rating values, impossible length values, and unsafe boundary overrides.
- Status: Open
- Verification: Not verified. Requires schema unit tests and route integration tests for valid/invalid requests.

## CW21

- ID: CW21
- Severity: Medium
- File/path: client/src/components; src/core/creative
- Feature/system: User experience for roleplay control
- Problem: Roleplay users need clear controls for continue, narrate, act as character, out-of-character note, summarize, rewind, branch, regenerate, set boundaries, and end scene. The current chat UI has only send, stop, copy, and retry.
- Fix: Add roleplay action buttons and slash commands such as `/ooc`, `/summary`, `/scene`, `/cast`, `/boundary`, `/rewind`, `/branch`, `/fade`, and `/end`.
- Status: Open
- Verification: Not verified. Requires UI inspection and command routing tests.

## CW22

- ID: CW22
- Severity: High
- File/path: src/core/creative; src/core/safety; src/server/routes/creative.ts
- Feature/system: Clear refusal and rewrite behavior for disallowed creative requests
- Problem: Creative mode needs graceful handling when a request crosses release boundaries. No creative-specific refusal or rewrite path exists.
- Fix: Add creative-specific boundary responses that briefly explain the limitation and offer safe alternatives: fade-to-black, consensual adult rewrite, fictionalized non-real-person substitute, non-explicit horror version, or genre-safe transformation.
- Status: Open
- Verification: Not verified. Requires policy tests and manual inspection of refusal/redirect quality.

## CW23

- ID: CW23
- Severity: Medium
- File/path: src/core/creative; client/src/components
- Feature/system: Quality controls and output scoring
- Problem: There is no quality loop for creative drafts, such as scoring for continuity, sensory detail, pacing, dialogue naturalness, genre fit, originality, and instruction adherence.
- Fix: Add a `CreativeQualityReviewer` that can score and optionally revise drafts. Expose optional quality-pass controls in the UI.
- Status: Open
- Verification: Not verified. Requires unit tests for reviewer outputs and manual quality review on sample drafts.

## CW24

- ID: CW24
- Severity: Medium
- File/path: src/core/creative; client/src/components; src/core/storage
- Feature/system: Prompt/library packs
- Problem: Users need reusable prompt packs for genres, tropes, character archetypes, scene types, and tone profiles. No prompt-library system exists.
- Fix: Add a prompt pack library with built-in presets and user-created presets. Store prompts separately from project drafts and allow import/export.
- Status: Open
- Verification: Not verified. Requires persistence tests and UI inspection proving packs can be created, applied, exported, and deleted.

## CW25

- ID: CW25
- Severity: High
- File/path: src/core/creative; client/src/components; tests/e2e
- Feature/system: End-to-end creative release scenario
- Problem: There is no end-to-end acceptance scenario proving the creative writing system can create a project, configure genre/rating, draft a scene, roleplay a scene, revise a passage, maintain continuity, and export the result.
- Fix: Add an e2e creative-writing smoke test and a manual QA checklist covering regular fiction, dark horror, epic fantasy, space opera, western, romance/mature opt-in, and roleplay sessions.
- Status: Open
- Verification: Not verified. Requires passing e2e smoke test and completed manual QA checklist.
