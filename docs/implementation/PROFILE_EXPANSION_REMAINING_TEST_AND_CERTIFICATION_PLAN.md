# Profile-Wide Capability Expansion — Remaining Test and Certification Plan

**Prepared:** 2026-08-25  
**Implementation branch:** `codex/cf04-cf10-integration`  
**Implementation commit under review:** `d81d112ba5921f1a9f476ee2b2abba55bc096515`  
**Evidence-metadata commit:** `91155609561bf8e23c7c7f3101c71fd5fa6b4851`  
**Current maturity:** `IMPLEMENTED_NOT_VERIFIED` / `LOCAL_ONLY_EXPERIMENTAL`  
**Source plan:** `docs/AI_CHATBOT_HUB_PROFILE_WIDE_CAPABILITY_EXPANSION_IMPLEMENTATION_PLAN.md`  
**Audit:** `docs/implementation/PROFILE_EXPANSION_IMPLEMENTATION_AUDIT.md`

## 1. Purpose

This document is the authoritative backlog of tests and certification work still required before any affected profile-expansion capability can be described as `PRODUCTION_SUPPORTED` or any PX phase can be marked `VERIFIED`.

It intentionally separates four different kinds of work:

1. **Automated tests that must be added to the repository.** These close untested branches, negative paths, concurrency behavior, and end-to-end user workflows.
2. **Integration and runtime canaries that must execute real dependencies.** A mock passing is not evidence that Faster Whisper, SAPI, FFmpeg, Tesseract, Ollama, Demucs, Godot, Unity, Unreal, or AssetCooker works in the supported environment.
3. **Manual certifications.** Screen-reader behavior, subjective audio quality, physical device permission behavior, and clean-machine setup cannot be certified by unit tests alone.
4. **Release evidence runs.** CI, load/soak, backup/restore, rollout, rollback, provenance, and post-deploy checks must run against an immutable commit and retained artifact set.

This is a test plan, not a claim that every listed feature is broken. Existing automated and local smoke coverage is useful development evidence, but it does not satisfy all production exit gates.

## 2. Verified Development Baseline — Do Not Duplicate Blindly

The following already passed locally and should remain as regression gates:

- Server TypeScript and ESLint checks.
- 222 active Jest suites and 1,173 passing tests.
- One skipped suite and two skipped tests remain; those are explicitly addressed in this backlog.
- Server Stage 2 coverage: 61.8884% lines, 49.9779% branches, 58.3569% functions, and 61.0157% statements.
- 36 client Vitest files and 115 passing client tests.
- Client Stage 2 coverage: 67.5862% lines, 60.2345% branches, 59.0909% functions, and 64.4428% statements.
- Seven browser E2E workflows.
- Sixteen accessibility unit checks and six Chromium/Axe workflows.
- Production build and packaging smoke.
- Phase 2 source, environment, inventory, large-file, and release-document scanners.
- Local smoke evidence for Faster Whisper, Windows SAPI, Windows screen capture, Tesseract/FFmpeg OCR, Ollama, Demucs, Godot, Unreal 5.8, dubbing/narration, and the project-owned AssetCooker.
- Game proposal tests for propose, reject-unapproved apply, approver-bound approval, apply, rollback, and disconnect.

Existing tests remain required. The work below adds missing depth and production evidence rather than replacing current suites.

## 3. Completion Rules for Every New Test

Every test item in this plan is complete only when all applicable conditions below are met.

- The test has a stable identifier from this document in its test name or evidence record.
- The test exercises the production entry point or production class; it must not reproduce the implementation inside the test.
- Fixtures are deterministic, rights-cleared, non-secret, and checked into a documented fixture location when their size permits.
- Large fixtures have a manifest containing source, license, SHA-256, expected duration/dimensions, and retrieval instructions.
- Assertions cover observable behavior, persisted state, artifacts, audit records, cleanup, and failure semantics—not only HTTP status.
- Timeouts are explicit. A timeout must cause cancellation and cleanup, not leave an orphan process.
- Tests that mutate files use an isolated temporary project and prove source restoration or deliberate retained output.
- Tests do not depend on execution order, a developer's home directory, or undeclared environment state.
- External-runtime tests report `BLOCKED` or `SKIPPED_WITH_REASON` when a prerequisite is absent; they never manufacture success.
- Evidence names the exact 40-character Git commit, operating system, dependency versions, relevant hardware, command, start/end timestamps, exit status, and artifact checksums.
- A passing result is reproducible from a clean checkout using a documented command.
- Newly covered code does not use coverage exclusions to reach the target.

## 4. Priority and Status Vocabulary

| Priority | Meaning | Release treatment |
| --- | --- | --- |
| P0 | Security, authority, data integrity, destructive mutation, release, or truthful-capability blocker | Must pass before production promotion |
| P1 | Real-runtime correctness, reliability, accessibility, compatibility, or material UX risk | Must pass for the affected supported capability |
| P2 | Quality, breadth, uncommon formats, and long-term regression hardening | May be scheduled after preview only with an explicit accepted risk |

| Status | Meaning |
| --- | --- |
| `NOT_CREATED` | No adequate automated test or retained execution evidence exists |
| `PARTIAL` | Mock/unit coverage exists, but a material branch, integration, platform, or evidence requirement remains |
| `BLOCKED_ENVIRONMENT` | Test definition is possible, but a license, device, runtime, credential, or clean host is missing |
| `READY_TO_RUN` | Harness exists and prerequisites are available; immutable-head evidence has not been retained |
| `COMPLETE` | Test and required evidence satisfy Section 3 |

Unless explicitly marked otherwise, every item below starts as `NOT_CREATED` or `PARTIAL`.

## 5. Immediate P0 Release Blockers

### RT-CI-001 — Exact-head Required CI

- **Priority/status:** P0 / `READY_TO_RUN`.
- **Goal:** Prove the pushed implementation, not an uncommitted local tree, passes the required workflow.
- **Procedure:** Trigger every branch-protection-required workflow for `d81d112ba5921f1a9f476ee2b2abba55bc096515`, then repeat for the final release candidate if it differs.
- **Assertions:** Checkout SHA equals the declared SHA; lockfiles are honored; no dirty generated files; type-check, lint, server tests, client tests, browser tests, accessibility automation, builds, coverage policies, inventory generation, SBOM/notices, and release scanners pass.
- **Evidence:** Workflow URLs/IDs, job logs, exact SHA, runner image, artifact checksums, and branch-protection result.
- **Failure rule:** A run on a later or earlier SHA cannot certify this commit.

### RT-COV-001 — Server Stage 3 Coverage

- **Priority/status:** P0 / `NOT_CREATED`.
- **Target:** At least 65% global lines and 55% global branches.
- **Current gap:** 61.8884% lines and 49.9779% branches.
- **Method:** Add behavior-focused tests from Sections 7–18; do not add superficial import-only tests.
- **Command:** `npm run test:coverage -- --runInBand` followed by the authoritative policy checker.
- **Evidence:** `coverage/coverage-summary.json`, policy report, lcov artifact, and immutable SHA.

### RT-COV-002 — Server Final and Tier A Coverage

- **Priority/status:** P0 / `NOT_CREATED`.
- **Targets:** 75% global lines, 65% global branches, and 90% lines/85% branches for Tier A controls.
- **Tier A files currently below final target:**
  - `src/middleware/auth.ts`
  - `src/middleware/apiKeyAuth.ts`
  - `src/core/auth/AuthService.ts`
  - `src/middleware/security.ts`
  - `src/middleware/rateLimiter.ts`
  - `src/core/config/APIKeyManager.ts`
  - `src/core/files/FileExplorerService.ts` branch coverage
  - `src/core/upload/FileProcessor.ts`
  - `src/core/local-tools/LocalRunApprovalService.ts`
  - `src/core/local-tools/LocalToolRunner.ts`
  - `src/core/local-tools/LocalToolService.ts`
  - `src/core/database/SafeDatabaseQuestionAgent.ts`
  - `src/core/audit/AuditLogger.ts`
  - `src/server/routes/admin.ts`
  - `src/core/config/EnvironmentDefinitions.ts` line coverage
  - `src/core/config/ProfileManager.ts`
- **Required cases:** See Section 7 for exact security and policy cases.

### RT-COV-003 — Client Stage 3 and Final Coverage

- **Priority/status:** P0 / `NOT_CREATED`.
- **Stage 3 target:** 75% lines and 65% branches.
- **Final target:** 80% lines and 70% branches.
- **Current:** 67.5862% lines and 60.2345% branches.
- **Critical files below final target:** `App.tsx`, `AssistantChat.tsx`, `ModeSelector.tsx`, `SettingsMenu.tsx`, `FileExplorerPanel.tsx`, `FilePreviewPane.tsx`, `LoadedFilesBar.tsx`, `AudioPreviewBrowser.tsx`, `LocalRunApprovalPanel.tsx`, `SpriteLabPanel.tsx`, `api/code.ts` branches, `api/conversations.ts` branches, `api/gaming.ts`, `api/knowledge.ts` branches, `api/localRunApprovals.ts` branches, `api/localTools.ts`, `api/spriteLab.ts`, and `features/gis/gisApi.ts` branches.
- **Method:** Implement the browser/component matrix in Section 17 and API error-contract tests in Section 18.

### RT-DB-001 — PostgreSQL Vector Integration Suite

- **Priority/status:** P0 for PostgreSQL support / `BLOCKED_ENVIRONMENT` unless `POSTGRES_VECTOR_TEST_URL` is configured.
- **Existing skip:** `src/core/database/Database.test.ts` conditionally skips two tests.
- **Cases:** Apply migrations to an empty database; apply them twice; insert/query vectors; validate dimensions; transaction rollback; reconnect after database restart; concurrent writers; tenant isolation; deletion; malformed connection; unsupported extension/version.
- **Assertions:** SQLite and PostgreSQL semantics match where promised; schema version is correct; no partial migration; errors are redacted.
- **Evidence:** Disposable database version, extension version, migration log, test report, and teardown confirmation.

### RT-EXT-001 — FL Studio MCP Real Integration

- **Priority/status:** P1 for FL Studio promotion / `BLOCKED_ENVIRONMENT` unless its bridge is configured.
- **Existing skip:** `src/core/integrations/flstudio/FLStudioMcpBridge.integration.test.ts` skips the suite when the runtime is absent.
- **Cases:** Handshake/version discovery; read-only project query; bounded command; timeout; disconnect/reconnect; malformed response; unavailable plugin; cancellation; hosted-profile denial.
- **Assertions:** No fabricated state; operations are auditable; local-only restrictions remain enforced.

### RT-LIC-001 — Immutable Source and License Review

- **Priority/status:** P0 / `NOT_CREATED` as certification evidence.
- **Procedure:** Resolve every adopted source/model/asset/service to an immutable revision or version; separately record code license, model license, asset terms, service terms, file exceptions, attribution, redistribution, and runtime-download obligations.
- **Automated checks:** Source register schema validation, remote revision existence, SHA/checksum match, notice completeness, SBOM-to-lockfile consistency, unknown-license fail-closed behavior, and modified-source attribution.
- **Manual evidence:** Reviewer identity/date/decision for every exception. Generated notices alone are insufficient.

## 6. Test Fixture and Harness Work Required First

### RT-HARNESS-001 — Rights-Cleared Media Corpus

Create `test-fixtures/profile-expansion/media/manifest.json` and documented retrieval for:

- PCM WAV at 8/16/44.1/48/96 kHz; mono, stereo, and multichannel.
- MP3, FLAC, OGG, M4A/AAC, and one explicitly unsupported format.
- Silence, clipped audio, low signal-to-noise speech, overlapping speakers, accents, numbers, punctuation, and code-switching.
- Constant-frame-rate and variable-frame-rate videos, hard subtitles, soft subtitles, no subtitles, HDR/SDR, rotated metadata, and corrupt/truncated media.
- Subtitle samples with outlined text, moving backgrounds, multiple regions, vertical text, low contrast, and non-Latin scripts.
- Long-duration fixtures generated deterministically to avoid storing large binaries.

Each item needs SHA-256, duration, codec, dimensions/sample rate, language, expected transcript/cues, license/source, and expected failure or success.

### RT-HARNESS-002 — Engine Project Corpus

Create minimal versioned projects for:

- Godot supported minimum and current version.
- Unity supported LTS/current version after licensing is available.
- Unreal 5.5 and 5.8.
- AssetCooker project with dependencies, dirty assets, duplicate names, long paths, Unicode paths, and deliberately invalid assets.

Every project requires a pristine-tree checksum, deterministic setup script, expected mutation diff, runtime assertion contract, profiler bridge contract, and cleanup/reset verification.

### RT-HARNESS-003 — Failure Injection

Provide reusable test doubles/process wrappers that can deterministically simulate:

- Startup failure, delayed startup, hang, crash, non-zero exit, malformed stdout/stderr, partial output, and oversized output.
- Disk full, read-only directory, permission denied, missing executable, invalid model cache, network loss, GPU unavailable/OOM, and child-process spawn failure.
- Cancellation before spawn, during processing, after artifact write, and racing with completion.
- Server restart between every durable state transition.

### RT-HARNESS-004 — Evidence Bundle Schema

Add a machine-validated evidence schema containing commit SHA, branch, dirty-tree state, command, environment, runtime versions, dependency/model checksums, hardware, timestamps, result, logs, artifacts, approver/reviewer, and signatures. Reject missing, mutable, contradictory, future-dated, or mismatched evidence.

## 7. Common Platform, Authorization, and Security Tests

### RT-PLAT-001 — Capability Registry and Availability Truthfulness

- **Proposed location:** `src/core/capabilities/__tests__/CapabilityAvailability.integration.test.ts` and route tests.
- Test disabled, installed, misconfigured, unhealthy, healthy, local-only, hosted-denied, role-denied, and dependency-missing combinations.
- Assert UI/API state is derived from server state and never upgrades `unavailable` to success.
- Assert an unknown capability cannot be enabled, disabled, installed, queried, or invoked.
- Assert dependency recovery changes health only after a successful bounded probe.
- Assert stale cached health cannot authorize an operation after dependency loss.

### RT-PLAT-002 — Pack Install, Update, Rollback, and Supply Chain

- Reject invalid schema, unknown fields where prohibited, duplicate IDs, cyclic dependencies, incompatible protocol/API versions, profile mismatch, unsigned/tampered package, checksum mismatch, path traversal, symlink/junction escape, ZIP bomb, and post-extraction mutation.
- Prove install is transactional; crash at each step and verify previous version remains usable.
- Prove rollback restores manifest, files, database state, configuration, registry state, and audit lineage.
- Prove uninstall cannot delete user-owned artifacts or another pack's files.
- Prove concurrent install/update operations serialize or reject deterministically.

### RT-PLAT-003 — Permission and Profile Matrix

- Generate a table-driven test across hosted/local/test profiles, roles, permissions, capability state, ownership, and health.
- Default deny missing role, missing permission, missing requester identity, unknown profile, and ambiguous capability.
- Test admin/operator/user boundaries and deny privilege derived only from request body fields.
- Prove hosted mode denies local process, filesystem mutation, desktop capture, microphone, clipboard, editor control, local model endpoints, and worker execution.
- Verify every denial emits a redacted audit event with correlation ID but no secret or sensitive content.

### RT-PLAT-004 — Authentication, Session, CSRF, API Key, Rate Limit, and CORS

- Cover valid/expired/revoked/malformed sessions; clock skew; logout; concurrent refresh; fixation; missing cookie; invalid issuer/audience where applicable.
- Cover API key absent, malformed, unknown, revoked, rotated, wrong scope, wrong tenant, and constant-time comparison expectations.
- Cover CSRF required/absent/mismatched/replayed token on every state-changing browser route.
- Cover CORS allowed origin, disallowed origin, `null` origin, credentialed requests, preflight, malformed origin, and development-only origin rules.
- Cover security headers on success, error, 404, streaming, and static responses.
- Cover per-user/per-IP/per-route rate limits, IPv4/IPv6 normalization, proxy trust configuration, reset windows, retry headers, and distributed-store failure.

### RT-PLAT-005 — Exact-Scope Approval Security

- Approval digest must include authenticated requester, approver, capability, operation, engine, project root, normalized paths, input hashes, parameters, expected outputs, expiry, and version.
- Reject body-spoofed requester/approver, wrong user, wrong tenant, wrong engine, wrong project, changed path casing where material, changed file content, changed parameters, expired approval, revoked approval, already-consumed approval, unknown approval, and approval from another environment.
- Race two applies against one approval and prove at most one succeeds.
- Restart between approval and apply and prove durable, exact behavior.
- Reject symlink, NTFS junction, alternate data stream, UNC, device path, trailing-dot/space, `..`, mixed separator, percent-encoded, Unicode confusable, and case-folding path attacks.
- Prove approval records and audit logs cannot be used as authorization merely by echoing a digest.

### RT-PLAT-006 — Job Lifecycle and Restart Recovery

- Exercise every legal state transition and reject illegal transitions.
- Cancel queued, starting, running, finalizing, completed, failed, and already-canceled jobs.
- Crash/restart at each transition; recover without duplicate destructive work.
- Verify idempotency keys, retry limits, backoff, deadlines, ownership, progress monotonicity, correlation IDs, and terminal-state immutability.
- Kill a process tree and prove no descendant survives and no temporary files remain.
- Race completion/cancellation/restart and prove exactly one terminal state and consistent artifacts.
- Saturate queue/resource budgets and verify bounded rejection rather than unbounded memory/process growth.

### RT-PLAT-007 — Artifact Store, Lineage, Quota, and Cleanup

- Validate artifact hash at write and read; reject corrupt or swapped content.
- Test ownership/tenant isolation, guessable IDs, expired links, range reads, missing files, metadata mismatch, and concurrent read/delete.
- Prove lineage retains inputs, operation, dependency/model versions, approval, parent artifacts, and generated outputs.
- Enforce quotas before and during writes; clean partial files on quota breach.
- Test retention, legal hold/protected source, tombstones, orphan cleanup, and source-never-deleted guarantees.
- Prove backup/export includes required artifacts and excludes temporary/sensitive material.

### RT-PLAT-008 — Secret, Log, Audit, and Support-Bundle Redaction

- Seed API keys, bearer tokens, cookies, passwords, connection strings, user paths, media text, clipboard content, and known canary secrets.
- Exercise success/error/timeout/crash paths through logs, metrics, traces, audit events, diagnostics, and support bundles.
- Assert no raw secret appears in any artifact; assert useful correlation and failure classification remains.
- Test multiline, encoded, JSON-escaped, URL-encoded, base64-like, split-token, and exception-chain leakage.
- Test redaction stability and ensure attacker-controlled keys cannot suppress unrelated evidence.

### RT-PLAT-009 — Upload, Parser, and Decompression Abuse

- Reject oversized body, misleading extension, MIME mismatch, polyglot file, truncated file, decompression bomb, pixel bomb, excessive duration/sample rate/channel count, deeply nested JSON/archive, and parser timeout.
- Fuzz filename, manifest, subtitle, image, audio, document, and archive parsers.
- Verify resource limits are applied before expensive decode and all temporary files are removed.

## 8. Native Runtime Discovery and Process Execution

### RT-NATIVE-001 — Runtime Discovery Matrix

- **Proposed location:** extend `src/core/native-runtime/__tests__/RuntimeDiscovery.test.ts`.
- Test explicit configuration, PATH discovery, conventional install roots, multiple versions, incomplete installations, broken symlinks/junctions, inaccessible paths, executable version mismatch, and stale cache.
- Verify newest **complete and compatible** runtime wins—not simply highest directory name.
- Windows Unreal matrix must include complete `D:\Unreal\UE_5.8`, complete 5.5, and incomplete C: 5.7 missing shaders.
- Test paths containing spaces/Unicode and command-line length boundaries.
- Test non-Windows behavior and hosted mode fail closed.

### RT-NATIVE-002 — Command Runner Isolation

- **Proposed location:** extend `src/core/native-runtime/__tests__/NativeCommandRunner.test.ts`.
- Verify argument-array execution without shell interpretation for quotes, ampersands, pipes, backticks, `$()`, `%VAR%`, `!VAR!`, newlines, and Unicode.
- Enforce executable allowlist, working-directory confinement, environment allowlist, maximum stdout/stderr, timeout, process-tree cancellation, and exit-code mapping.
- Test child-spawns-grandchild cancellation on Windows and the supported non-Windows platform.
- Verify logs redact arguments/environment marked secret.

### RT-NATIVE-003 — Dependency Loss and Recovery

- Start healthy, remove/rename or isolate the dependency, then invoke.
- Assert status becomes unavailable, calls return the documented 503/error schema, and no synthetic artifact is created.
- Restore dependency; require a fresh successful probe before availability returns.
- Repeat during an active job and verify deterministic failure/cancellation cleanup.

## 9. STT, TTS, Screen, Clipboard, and Desktop Voice

### RT-VOICE-001 — Faster Whisper Real STT Matrix

- Run CPU and available GPU modes; record model name/revision/checksum, compute type, device, warm/cold latency, peak memory, and real-time factor.
- Inputs: supported codecs/sample rates/channels, silence, noise, clipped audio, long audio, punctuation/numbers, multiple accents, at least two supported languages, code-switching, and corrupt input.
- Assert transcript segments are ordered, bounded, non-overlapping, time-aligned, language/confidence fields are truthful, and no fake transcript is returned on failure.
- Set quantitative word-error-rate thresholds against the rights-cleared golden corpus and document per-language limits.
- Test missing model, corrupt cache, offline first run, download interruption, insufficient disk, OOM, timeout, concurrent jobs, and cancellation.
- Use an outbound-network monitor to prove local-only operation has no unexpected egress after model provisioning.

### RT-VOICE-002 — Windows SAPI Real TTS Matrix

- Enumerate installed voices and validate configured voice selection, missing voice, unsupported locale, rate/volume boundaries, empty text, Unicode, SSML-like hostile input, long text chunking, and concurrent synthesis.
- Validate output is a decodable WAV with correct header, duration, sample format, non-silence where expected, and content-derived artifact hash.
- Test cancellation, output permission failure, disk full, SAPI failure, device/session change, and cleanup.
- Add a transcript-back-through-STT intelligibility check with a documented tolerance; keep subjective listening certification separate.

### RT-VOICE-003 — Physical Microphone and Recording Permissions

- Test first-use permission allow and deny, revoked permission, device unplug during recording, device change, no default input, exclusive-device conflict, muted input, and sample-rate negotiation.
- Verify recording indicator, accessible status announcement, explicit stop, maximum duration, cancellation, and raw recording retention/deletion policy.
- Confirm recording never starts from page load, background polling, or a stale approval.
- Evidence must identify device, driver, OS build, permission state, and waveform artifact checksum without retaining private speech unnecessarily.

### RT-VOICE-004 — Screen Capture Consent and Geometry

- Test per-use explicit action, preview-before-use, cancel-at-picker, denied permission, revoked permission, monitor disconnected, and capture backend failure.
- Test single/multiple monitors, primary/non-primary monitor, negative coordinates, 100/125/150/200% scaling, portrait orientation, window bounds, off-screen bounds, HDR/SDR, minimized/occluded window, and secure/unsupported surfaces.
- Verify requested crop maps to output pixels correctly and cannot exceed the approved surface.
- Verify raw pixels are not persisted or sent to a model until the separately disclosed action is approved.
- Verify screen context artifacts follow retention/delete policy and no stale frame is represented as current.

### RT-VOICE-005 — Clipboard and AI Transform Boundaries

- Test empty, text, large text, binary/image, malformed Unicode, and rapidly changing clipboard contents.
- Verify read/write are separate explicit permissions; background reads are absent; writes preserve original until user applies the proposal.
- Test Ollama unavailable, timeout, malformed response, prompt injection in clipboard text, cancellation, and transformation diff review.
- Confirm secrets are not logged and hosted mode denies local clipboard access.

### RT-VOICE-006 — Desktop Packaging, Update, and Rollback

- Test clean install, repair, upgrade, downgrade denial where required, failed update, signature failure, interrupted update, rollback, uninstall, and retained/deleted user data choices.
- Validate publisher/signature, file hashes, startup permissions, firewall behavior, uninstall cleanup, and no unexpected auto-start.
- Repeat under standard user, administrator, offline, non-ASCII user profile, and path-with-spaces conditions.

## 10. Media Accessibility: OCR, Translation, Dubbing, Narration, and Read-Along

### RT-MEDIA-001 — Authorized Ingest and Source Preservation

- Test allowed owned/public/authorized media and deny missing rights declaration, DRM/access-control content, unsupported remote URL, traversal, symlink/junction escape, and source outside approved root.
- Verify source bytes remain unchanged before/after every workflow.
- Verify each derived artifact links to source hash, authorization statement, tool/model versions, and operation parameters.

### RT-MEDIA-002 — FFmpeg/Tesseract Subtitle OCR

- Run the corpus from RT-HARNESS-001 across supported language packs.
- Validate crop/time bounds, frame sampling, variable frame rate, scene changes, duplicate-cue consolidation, confidence, cue ordering, non-overlap policy, and SRT/VTT serialization.
- Quantify character/word error rate and timing error against goldens; define a low-confidence threshold that requires review rather than silently publishing.
- Test missing language data, missing FFmpeg/Tesseract, corrupt frames, no text, multiple subtitle regions, long video, cancellation, worker crash, and disk pressure.
- Prove raw extracted frames are cleaned according to retention policy.

### RT-MEDIA-003 — Subtitle Editor and Export

- Test insert/delete/split/merge/reorder cues, overlapping cues, zero/negative duration rejection, hour rollover, Unicode/RTL text, multiline cues, styling loss disclosure, and deterministic SRT/VTT round trip.
- Test concurrent edits/version conflict and recovery from autosave.
- Validate accessibility of time controls and transcript editing by keyboard and screen reader.

### RT-MEDIA-004 — Ollama Translation Variants

- Test configured model present/missing, server unavailable/recovery, timeout, malformed JSON/text, empty output, excessive output, cancellation, and concurrent jobs.
- Preserve cue IDs/timing/source text and attach target language, model/version, prompt/config hash, and review status.
- Test prompt injection inside source subtitles and ensure it cannot change permissions, call tools, or alter other cues.
- Define human-reviewed adequacy samples for supported language pairs; automated shape validation alone is insufficient.
- Verify no cloud egress in local-only mode.

### RT-MEDIA-005 — Dubbing Timing Reconstruction

- Test shorter/equal/longer synthesized speech, speed-factor minimum/maximum, overlapping cues, gaps, very short cues, long monologues, punctuation, multiple speakers, and mixed languages.
- Assert final audio duration/alignment tolerance, no clipping, bounded loudness, deterministic channel/sample format, and preserved source audio.
- Test ducking on/off and validate gain envelope does not corrupt or unexpectedly mute source audio.
- Test failure/cancel after partial synthesis or mux and verify no published partial artifact.
- Verify voice consent, synthetic-media disclosure, provenance, and separate approval for export/publish.

### RT-MEDIA-006 — Document Narration and Read-Along

- Test headings, paragraphs, lists, tables, links, footnotes, code blocks, Unicode/RTL, empty documents, very long documents, and unsupported structures.
- Assert narration segment-to-source anchors, timing monotonicity, playable audio, transcript equivalence, keyboard navigation, and synchronized highlighting tolerance.
- Test resume/restart, voice missing, TTS failure, cancellation, and output recovery.

## 11. Local AI and Model Adapter Tests

### RT-AI-001 — Ollama Endpoint and Model Discovery

- Test loopback IPv4/IPv6, explicitly allowed LAN endpoint if supported, disallowed public/private targets, redirects, DNS rebinding, URL credentials, encoded host, unusual ports, and proxy environment interference.
- Probe model list/capabilities with strict timeout and response-size limit.
- Distinguish server missing, model missing, model unloaded, model incompatible, malformed server, timeout, overload, and cancellation.
- Verify fallback reasons are user-visible and no request silently crosses from local to cloud.

### RT-AI-002 — Transform Correctness and Instruction Isolation

- Cover writing, dictation, clipboard, translation, and other AI transforms with deterministic stub contract tests plus real-model canaries.
- Inject instructions in user content requesting secret disclosure, permission escalation, filesystem access, or altered output schema.
- Assert the model response is untrusted data, cannot grant authority, and is validated/bounded before use.
- Test invalid UTF-8-equivalent input, huge input, huge response, context overflow, stop/timeout, and partial streaming if streaming is supported.

### RT-AI-003 — Resource Arbitration

- Run concurrent STT, TTS, Ollama, Demucs, OCR, and editor jobs under configured CPU/RAM/GPU budgets.
- Assert admission control, queue behavior, cancellation, priority, and recovery; do not allow host exhaustion.
- Capture peak resident memory, GPU memory when available, CPU, disk, and latency under warm/cold conditions.

## 12. Demucs, Audio Analysis, Mixer, and Export

### RT-AUDIO-001 — Real Demucs CPU/GPU Matrix

- Test every claimed model/stem layout on CPU and supported GPU.
- Inputs: mono/stereo, supported sample rates/codecs, silence, short/long files, clipped input, and corrupt/truncated input.
- Assert expected stem count/names, sample rate/channels, near-equal durations, decodability, non-empty output, and alignment tolerance.
- Add mixture-consistency evaluation: recombined stems must remain within documented error relative to normalized source.
- Record separation quality on a rights-cleared multitrack golden set; define SDR or another accepted objective threshold per model.
- Test model download/cache corruption, offline operation, OOM, disk full, worker crash, timeout, concurrent jobs, and cancellation of the actual process tree.

### RT-AUDIO-002 — Rights and Egress Gate

- Reject missing/invalid rights declaration before worker spawn.
- Test user changes source after approval, approval expiry/replay, and artifact handoff to a cloud provider.
- Monitor network during local jobs and prove no audio egress.
- Verify logs/support bundles contain metadata only and not source audio or transcript unless explicitly included.

### RT-AUDIO-003 — Mixer and WAV Export Correctness

- Test gain, pan, mute, solo, clipping prevention/disclosure, different stem lengths, mono/stereo conversion, sample-rate mismatch, and missing/corrupt stems.
- Numerically validate PCM samples for small golden inputs, WAV header sizes, duration, channels, bit depth, and deterministic output.
- Test large output streaming, cancellation, disk full, permission denied, and atomic publication.
- Verify source/stems are not overwritten and export lineage contains every contributing stem and parameter.

### RT-AUDIO-004 — Analysis Confidence and UI

- Test tempo/key/loudness or other claimed analysis against goldens with tolerances and confidence labels.
- Validate low-confidence/unsupported cases do not become categorical claims.
- Browser-test waveform loading, playback, scrubbing, keyboard controls, progress, cancel, error recovery, and artifact download.

## 13. Game Editors and AssetCooker

### RT-GAME-001 — Cross-Engine Proposal/Approval/Apply/Rollback Matrix

- Run the same table-driven cases for Godot, Unity, and Unreal.
- Propose a bounded mutation; inspect exact diff/operation list; approve as an authorized distinct approver where policy requires; apply once; validate project; rollback; verify pristine hash.
- Reject unapproved, expired, revoked, wrong-user, wrong-project, wrong-engine, tampered, replayed, stale-source, out-of-root, and concurrently applied proposals.
- Fail each apply step deliberately and prove atomic rollback or an explicit recoverable state with no false success.
- Verify disconnect/reconnect and server restart do not lose approval state or apply twice.

### RT-GAME-002 — Godot Real-Engine Certification

- Test supported minimum/current Godot versions and reject incompatible versions.
- Exercise project inspection, scene/script mutation, headless parse/import validation, runtime launch, project-owned assertion bridge, frame/screenshot/log artifact capture, profiler capture, export, cancellation, and rollback.
- Test missing export templates, script syntax error, import failure, runtime crash/hang, stale bridge state, and editor disconnect.
- Assert runtime assertions are sourced from the project bridge and are not inferred from process exit alone.

### RT-GAME-003 — Unity License and Real-Engine Certification

- **Status:** `BLOCKED_ENVIRONMENT`; the installed editor currently exits 198 because a legitimate license is unavailable.
- Activate a legitimate license using the documented non-secret CI/developer process; never store license material in the repository or logs.
- Test supported Unity versions, clean project batch-mode validation, mutation/import, edit-mode tests, play-mode/project bridge assertions, profiler instrumentation, build target, cancellation, crash, and rollback.
- Test license missing, expired, returned/revoked, activation-server unavailable, and seat contention; every case must report unavailable/failure, not success.
- Verify project-side assertion and profiler data is signed/trusted or otherwise authenticated and tied to the exact run.

### RT-GAME-004 — Unreal 5.5/5.8 Real-Engine Certification

- Test discovery and execution against complete `D:\Unreal\UE_5.8` and supported 5.5.
- Prove incomplete C: 5.7 missing required components/shaders is rejected even if its version is newer than another complete installation.
- Exercise commandlet project validation, bounded asset/Blueprint mutation, `ResavePackages` or the approved validation path, project-owned automation assertions, profiler/stat capture, RunUAT packaging, cancellation, crash/hang, and rollback.
- Test shader compile failure, plugin mismatch, missing SDK/toolchain, corrupt asset, redirector, read-only project, and stale DerivedDataCache.
- Do not treat editor/commandlet exit zero as proof of gameplay correctness without project assertions.

### RT-GAME-005 — Project-Side Assertion and Profiler Bridge Contract

- Define versioned schemas for assertion events, runtime identity, timestamps, frame/build identity, metric units, and completion marker.
- Authenticate or checksum the bridge output; reject stale, partial, cross-project, wrong-run, malformed, duplicate, and out-of-order output.
- Set timeouts and maximum artifact sizes.
- Add contract tests independent of each engine, then real project tests for Godot, Unity, and Unreal.
- Missing instrumentation must remain `unavailable`; it must never be represented by synthetic metrics.

### RT-GAME-006 — AssetCooker Real Project Tests

- Test clean build, dirty-only incremental build, dependency invalidation, deterministic manifest/hashes, duplicate asset names, case collisions, Unicode/long paths, missing dependency, corrupt asset, unsupported type, and parallel invocations.
- Validate output confinement, no source overwrite, atomic manifest publication, cleanup after failure/cancel, and rebuild equality.
- Test editor handoff consumes only approved artifacts and preserves lineage.

## 14. Sprite and Image Studio

### RT-SPRITE-001 — Image Ingest Security and Limits

- Add cases for MIME/extension mismatch, truncated image, decompression/pixel bomb, enormous dimensions, malicious metadata, animated image frame explosion, palette abuse, ICC/profile edge cases, and unsupported formats.
- Enforce byte and decoded-pixel limits before expensive transforms.
- Test path traversal, symlink/junction, output collision, and source overwrite denial.

### RT-SPRITE-002 — Deterministic Processing Goldens

- Golden-test grid detection, slicing, palette conversion, background removal, outline finishing, scaling, and metadata export.
- Include transparent edges, one-pixel sprites, irregular sheets, spacing/margins, low-confidence grids, indexed color, alpha fringes, and non-divisible dimensions.
- Compare exact pixels when deterministic; use documented perceptual thresholds only where exact equality is inappropriate.
- Verify low confidence blocks or requires review instead of guessing.

### RT-SPRITE-003 — Batch, Cancellation, and Engine Handoff

- Test large batches, mixed valid/invalid inputs, name collisions, partial worker failure, cancellation at each stage, restart recovery, and quota exhaustion.
- Verify deterministic resume or explicit restart semantics and no orphaned partial artifacts.
- Require a separate exact approval for Godot/Unity/Unreal handoff; test wrong engine/project/digest and stale artifacts.

### RT-SPRITE-004 — Sprite Studio Browser Coverage

- Cover empty/setup/loading/progress/success/partial/error/degraded/cancel states.
- Cover keyboard-only ingest, preset selection, preview comparison, approval, export, and artifact access.
- Validate focus restoration, live progress announcements, alt text/accessible names, high contrast, zoom, and narrow viewport behavior.

## 15. Context, Repository Intelligence, Memory, and Agent Operations

### RT-CTX-001 — Deterministic Compressor Coverage

- Raise coverage for `LogEventCompressor`, `TableSampleCompressor`, `RepoTreeCompressor`, `ConversationTurnSelector`, and `ExactEvidenceSelector`.
- Test empty/minimal/huge inputs, stable ordering, token budget boundaries, Unicode, malformed records, duplicate evidence, secrets, source anchors, and deterministic repeated output.
- Property-test that retained anchors resolve to the exact original and compression never invents content.

### RT-CTX-002 — Reversible Store, Checkpoints, and Failure Learning

- Test permission-preserving retrieval, cross-user/project denial, key collision, corruption, expired content, deletion, restart, concurrent checkpoint writers, delta chain failure, and cache mismatch.
- Prove governing/system instructions cannot be rewritten by learned failure content.
- Inject hostile instructions in stored content and assert they remain data.
- Benchmark token savings and task correctness against a no-compression baseline with predefined non-inferiority thresholds.

### RT-REPO-001 — Symbol Index and Staleness

- Test byte offsets across LF/CRLF, UTF-8 multibyte text, BOM, generated files, duplicate symbols, partial parse, renamed/deleted files, and unsupported language fallback.
- Modify file after indexing and prove exact reads reject stale offsets.
- Test symlink/junction loops, ignored files, binary files, huge files, permission errors, and deterministic traversal.

### RT-REPO-002 — Git, Architecture, Health, and Impact Goldens

- Add real temporary-repository histories for rename, copy, merge, revert, shallow clone, detached HEAD, uncommitted changes, submodule, and large history.
- Golden-test hotspots, ownership evidence, architecture cards, dependency edges, changed symbols, and blast radius.
- Require evidence links to current commit/bytes and visibly label partial parser health or confidence.
- Establish precision/recall thresholds on a curated multi-language impact corpus.

### RT-REPO-003 — Safe Remote Ingest and Stress

- Test allowed protocols/hosts, redirects, DNS rebinding, credentials in URL, private/link-local/metadata IPs, huge repo, huge history, LFS pointer, submodules, malicious filenames, and decompression/object bombs.
- Enforce time/byte/file-count/depth budgets and clean incomplete clones.
- Stress a documented large repository and record indexing time, peak memory, cache size, and query latency.

### RT-MEM-001 — Branch/Commit/Symbol Memory Lifecycle

- Test proposal-based capture; approval/rejection; anchor validation; branch divergence; merge; rebase; rename; cherry-pick; abandoned branch; deleted symbol; supersession; contradiction; stale retrieval; and protected memory.
- Assert stale/superseded content is visible and cannot silently override current evidence.
- Test hybrid ranking determinism and golden relevance thresholds.

### RT-MEM-002 — Memory Isolation, Export, Import, and Deletion

- Test cross-user/project/tenant denial across primary store, indexes, caches, artifacts, exports, and logs.
- Test deterministic export/import, schema version migration, duplicate/conflicting records, redaction, corrupt archive, traversal, and unsupported future schema.
- Deletion must remove all applicable records/index entries/artifacts and leave an auditable non-sensitive tombstone where policy requires.

### RT-AGENT-001 — Session Discovery and Communication Isolation

- Test opt-in/opt-out, stale sessions, forged metadata, unavailable adapter, redaction, cross-user/project denial, and reconnect.
- Test inbox ordering, duplicate delivery, retry, expiration, cancellation, oversized message, malformed event, and unauthorized recipient.
- Prove an agent message cannot grant permissions or approvals.

### RT-AGENT-002 — Workspace Claims, Processes, and Patch Conflict

- Test overlapping claims, canonical path aliases, symlink/junction paths, expired claims, crash/restart, abandoned worktree, and actual filesystem mismatch.
- Verify cancellation terminates complete process trees.
- Test cleanly mergeable patches and conflicting patches; conflicts must remain unmerged with inspectable evidence.
- Run a controlled multi-agent canary and retain complete event/claim/process/patch evidence with redaction.

## 16. Writing, Study, Website, and Developer Utilities

PX-14 and PX-15 have checked exit gates in the source plan, but they remain subject to exact-head CI, final coverage, security, accessibility, and release evidence. The tests below close important uncovered implementation branches and cross-capability risks.

### RT-WRITE-001 — Lossless Document Matrix

- Expand byte-for-byte Markdown round trips across line endings, BOM, trailing spaces, nested lists, tables, fenced code, HTML, Unicode/RTL, links, footnotes, front matter, and large documents.
- Test import/export claims for every advertised format; unsupported fidelity must be disclosed.
- Crash during autosave/recovery at multiple write offsets and prove source is recoverable and never silently corrupted.

### RT-WRITE-002 — Proposals, Tracked Changes, and AI Routing

- Test exact range/diff behavior with concurrent edits, overlapping suggestions, stale proposal, accept/reject order, undo/redo, comments, and portable export.
- Test local/cloud routing disclosure, provider unavailable/timeout/malformed output, prompt injection in document text, and cancellation.
- Never apply AI output without user review; assert original remains retrievable.

### RT-STUDY-001 — Grounding, Scoring, and Staleness

- Add goldens for notes, flashcards, quizzes, exams, Socratic debate, mastery, and audio lessons across supported source types.
- Assert every generated claim/question/answer has a valid source anchor; unsupported content is rejected or labeled.
- Test deterministic scoring, versioned mastery/spaced-repetition rules, source changes, stale dependents, conflicting sources, and educator review overrides.
- Test cross-user/project isolation and deletion.

### RT-WEB-001 — Sandboxed Preview and Import/Export Security

- Test script injection, event handlers, dangerous URLs, CSS exfiltration, iframe escape, navigation, downloads, popups, clipboard, storage, service workers, and network access from preview.
- Test import archive traversal/bombs/symlinks and export determinism.
- Verify responsive preview at supported viewports, undo/safe-mode guarantees, recovery, source-link confidence, and exact approval of agent edits.

### RT-DEV-001 — Mock API Safety

- Test local/development-only exposure, generated CRUD isolation, schema limits, deterministic seed/reset, latency/error/chaos modes, pagination, concurrency, and teardown.
- Reject hosted/production activation, unsafe routes, traversal, huge schemas, prototype pollution, and OpenAPI external-reference SSRF.
- Add client tests for `MockApiWorkspacePanel.tsx`, which currently has 0% measured coverage.

### RT-DEV-002 — Skill Export, Scaffolding, and Project Doctor

- Verify source/provenance retention, deterministic export, redaction, archive safety, filename collisions, and unsupported manifest versions.
- Verify scaffolds include governance, tests, permissions, and disabled-by-default state.
- Project Doctor must derive every claim from executable evidence; inject stale/missing/contradictory evidence and assert fail-closed output.

## 17. Browser E2E and Manual Accessibility Matrix

### RT-UI-001 — Capability Hub End-to-End

- Browser-test server/UI parity for disabled, unavailable, setup-required, unhealthy, local-only, role-denied, ready, running, degraded, and failed states.
- Test guided setup without source inspection, dependency diagnosis, retry after repair, install/update/rollback, job progress/cancel, approvals, artifacts/lineage, diagnostics, and support-bundle download.
- Assert deep-link, refresh, back/forward, lost network, server restart, stale data, and concurrent-tab behavior.

### RT-UI-002 — Expansion Studio Vertical Slices

Create at least one real browser workflow for each reachable surface:

- Context Economy: submit content, inspect compression, retrieve original, view explanation/error.
- Agent Operations: discover session, claim workspace, send message, cancel, inspect evidence.
- Game Studio: inspect project, propose, approve, apply, validate, rollback.
- Sprite Studio: ingest, transform, review, export/handoff.
- Music Studio: rights preflight, separate, mix, export, cancel.
- Media Accessibility: ingest, OCR/transcribe, edit, translate, dub/narrate, export.
- Writing Studio: edit, proofread proposal, accept/reject, recover, export.
- Study Studio: ingest source, generate item, inspect anchor, answer/score, stale-source behavior.
- Website Studio and Developer Utilities: sandbox/import/export and mock/scaffold/doctor flows.

Each workflow must test success plus unavailable, validation error, server error, timeout/cancel, and permission-denied behavior.

### RT-UI-003 — Critical Client Coverage

Add focused component/API tests for every file listed in RT-COV-003. Minimum assertions:

- Loading, empty, success, validation failure, unauthorized, forbidden, unavailable/503, rate-limited, conflict, timeout, aborted request, malformed response, and generic server failure.
- Error text is actionable but does not expose server internals.
- Abort signals cancel requests and stale responses do not overwrite current state.
- Buttons disable only when appropriate; retry does not duplicate mutations.
- API clients encode paths/query/body correctly and reject nonconforming responses where runtime validation exists.

### RT-A11Y-001 — Automated Cross-Browser Accessibility

- Run Axe/browser flows in Chromium, Firefox, and WebKit for desktop and supported narrow viewports.
- Cover every dialog, approval flow, progress state, error state, tab/panel, data table, artifact tree, waveform/timeline, editor, and toast/live region.
- Validate no serious/critical violations, valid accessible names/descriptions, focus trap/return, heading/landmark order, keyboard operation, visible focus, no keyboard trap, zoom/reflow, high contrast, reduced motion, and error association.

### RT-A11Y-002 — Signed Manual Certification

- Test Windows with NVDA and JAWS for the primary supported browser; add VoiceOver/Safari if macOS is claimed.
- Complete every critical workflow keyboard-only and screen-reader-only.
- Verify dynamic progress, cancellation, errors, approval scope, diffs, artifact lineage, waveform/timeline alternatives, and capture/recording state announcements.
- Record screen reader/browser/OS versions, tester, date, exact SHA/build, scenario result, issues, retest, and signed approval.
- Automated Axe results cannot substitute for this item.

## 18. API and Route Contract Tests

### RT-API-001 — Uniform Error and Ownership Contract

For every profile-expansion route, test:

- Unauthenticated, unauthorized role, wrong owner/tenant/project, missing CSRF where relevant, disabled capability, unavailable dependency, invalid request, oversized request, not found, conflict, rate limit, timeout, cancellation, and internal dependency failure.
- Stable documented status and error code; correlation ID; no stack, filesystem path, command line, secret, or sensitive payload leakage.
- Requester identity comes only from authenticated context.
- Unknown fields and ambiguous identifiers follow the documented schema policy.

### RT-API-002 — Route Inventory Completeness

- Compare capability manifests, registry records, mounted routers, OpenAPI/contract records if present, client API calls, and authorization policy.
- Fail CI for an exposed route without capability state, ownership policy, input limit, audit classification, and test mapping.
- Fail CI for a client capability card that points to an absent/unmounted route.

### RT-API-003 — Idempotency and Concurrency

- Apply concurrent duplicate POSTs for job creation, approval, apply, rollback, install/update, export, and deletion.
- Assert documented idempotency semantics, at-most-once destructive execution, stable conflict response, and consistent persisted state.

## 19. Performance, Load, Soak, Reliability, and Recovery

### RT-PERF-001 — Baseline SLO Definition

Before pass/fail load tests, define per-capability SLOs for API latency, queue delay, job completion where predictable, cancellation latency, error rate, resource ceilings, artifact throughput, and recovery time. Record input tiers and hardware; avoid one threshold across incomparable workloads.

### RT-PERF-002 — API Load

- Exercise read-only registry/health/jobs/artifacts and bounded write/job routes at expected, 2× expected, and overload levels.
- Measure p50/p95/p99 latency, throughput, error classification, connection/socket growth, event-loop delay, heap/RSS, database pool, file handles, and queue depth.
- Assert overload is shed predictably with rate-limit/busy responses and does not corrupt state.
- Include authenticated multi-user isolation and a mix of success/error/cancel traffic.

### RT-PERF-003 — Native Worker Concurrency

- Run representative concurrent STT, OCR, TTS, Ollama, Demucs, and engine jobs under the supported resource budget.
- Prove admission control and fairness; measure cancellation latency and recovery after OOM/crash.
- Verify no unbounded process, temp-file, file-handle, GPU-memory, or model-cache growth.

### RT-PERF-004 — Soak

- Run at least one documented long-duration mixed workload long enough to expose leaks; the duration must be justified from observed steady-state behavior.
- Include periodic cancel, dependency restart, server restart, artifact cleanup, login/session refresh, and health probing.
- Pass only if memory/handles/temp storage/queue depth stabilize within documented bounds, error rate stays within SLO, and no data/tenant leak occurs.

### RT-REL-001 — Adapter Failure Matrix

For every external adapter, execute missing, unhealthy, slow, hung, crashing, malformed, partial-output, permission-denied, disk-full, network-loss where relevant, and version-incompatible conditions. Verify truthful availability, bounded retry, cancellation, cleanup, recovery, and user-visible diagnosis.

### RT-REL-002 — Backup and Restore Drill

- Seed users/projects, capability configuration without raw secrets, jobs, approvals, artifacts/lineage, memory/context data, writing/study projects, and release metadata.
- Take backup while quiesced and under the documented live-backup condition.
- Destroy/replace the disposable environment, restore, migrate if required, and validate referential integrity, hashes, ownership, permissions, and application behavior.
- Prove excluded ephemeral data remains excluded and missing secrets require secure reconfiguration.
- Measure and compare RPO/RTO with declared objectives; retain signed drill evidence.

### RT-REL-003 — Corruption and Disaster Recovery

- Corrupt database row/page in a disposable copy, artifact bytes, lineage metadata, model cache, temp job state, and configuration independently.
- Verify detection, quarantine, fail-closed behavior, repair/restore guidance, and absence of destructive automatic guessing.
- Test loss of worker host, abrupt OS reboot, and interrupted migration/update.

### RT-OBS-001 — Metrics, Traces, Alerts, and Runbooks

- Generate each major failure and verify metric name/labels, trace correlation, redacted logs, alert threshold/deduplication, and runbook link.
- Ensure labels do not contain user content, paths, transcript text, secrets, or unbounded identifiers.
- Test telemetry backend unavailable and slow; product operations must remain bounded.

## 20. Clean-Machine and Compatibility Certification

### RT-CLEAN-001 — Clean Windows Machine

- Start from a supported clean Windows image with no developer PATH/cache assumptions.
- Install application and declared prerequisites using public/internal release instructions only.
- Test first run, dependency doctor, capability-disabled defaults, setup, local model/media worker acquisition with checksum/license display, desktop permissions, upgrade, rollback, uninstall, and reinstall.
- Run every claimed Windows capability and retain hardware/runtime/build evidence.
- Repeat as standard user and with a path/user name containing spaces and Unicode.

### RT-CLEAN-002 — Clean Hosted Deployment

- Deploy the exact artifact to the supported hosted environment from documented infrastructure/configuration.
- Verify local-only capabilities are absent or denied server-side even if routes are called directly.
- Verify migrations, secrets, health/readiness, scaling, restart, rollback, logging/redaction, backup integration, and browser flows.

### RT-COMPAT-001 — Runtime/Browser Matrix

- Node versions claimed by package/CI policy.
- Supported Windows builds; Linux hosted runtime; macOS only if explicitly claimed.
- Chromium, Firefox, and WebKit/Safari equivalents for browser claims.
- Godot, Unity, Unreal, Python, FFmpeg, Tesseract, Ollama, Demucs/PyTorch, and model versions exactly listed in the support policy.
- For each version, classify `SUPPORTED`, `DEGRADED`, `BLOCKED`, or `UNSUPPORTED` from executed evidence.

## 21. Cross-Capability Certification Scenarios

### RT-XCAP-001 — Repository → Memory → Agent

Index a repository, create evidence-anchored memory, switch/diverge branch, retrieve context, hand it to a controlled agent, and produce a patch proposal. Assert current anchors, stale-memory warning, scope preservation, claim isolation, no automatic merge on conflict, and complete lineage.

### RT-XCAP-002 — Screen → OCR/AI → Writing

Capture an explicitly approved region, extract text, propose a local-model rewrite, and insert only after exact user review. Assert separate permissions, raw-pixel retention, prompt-injection resistance, proposal diff, source provenance, and deletion.

### RT-XCAP-003 — Media → STT/Translation/TTS → Accessible Export

Ingest authorized media, transcribe/OCR, edit, translate, dub/narrate, and export subtitles/read-along. Assert timing/quality thresholds, consent, disclosure, source preservation, artifact lineage, cancellation/restart, and no undeclared egress.

### RT-XCAP-004 — Sprite → Engine

Ingest and transform a sprite, approve engine handoff, import into each promoted engine, run project assertions, then rollback. Assert cross-engine isolation, exact project/path approval, deterministic artifacts, source preservation, and engine evidence.

### RT-XCAP-005 — Audio → Demucs → Mixer → DAW Handoff

Pass rights gate, separate stems, analyze, mix, export, and hand off to a promoted DAW adapter. Assert no egress, alignment/quality, approval at boundary, lineage, cancellation, and cleanup.

### RT-XCAP-006 — Study/Writing/Web Publication Boundary

Generate source-grounded study/writing content and preview it in Web Studio. Assert citations survive, AI output remains a proposal, sandbox holds, publication/export requires its own authorization, and deletion propagates where promised.

### RT-XCAP-007 — Authority Non-Transitivity

For every scenario above, prove permission for capability A does not authorize B, an artifact from A is revalidated by B, model/agent instructions cannot grant permissions, and an approval cannot be reused across capability boundaries.

## 22. Release Artifact, Rollout, Rollback, and Maintenance Evidence

### RT-RELZ-001 — Reproducible Release Artifact

- Build twice from the same clean source/toolchain or document every nondeterministic field.
- Verify artifact contents, version, commit SHA, pack/API/schema/protocol versions, checksums, signatures, SBOM, notices, source offers/attribution where required, and evidence manifest.
- Reject dirty tree, non-exact SHA, missing license, unknown dependency, mismatched manifest state, or unsigned/tampered artifact.

### RT-RELZ-002 — Controlled Rollout

- Execute sequential stages: internal, clean-machine local, limited preview/canary, broader stage, and production only as authorized.
- Define entry/exit metrics and abort thresholds before rollout.
- At every stage, verify health, errors, SLOs, security signals, capability state, migrations, and user-visible availability.
- Prevent skipping stages or advancing without immutable evidence and approver identity.

### RT-RELZ-003 — Release Rollback Demonstration

- Trigger rollback from each rollout stage.
- Verify application, database compatibility, pack versions, configuration, artifacts, jobs, and user data after rollback.
- Prove no destructive job is replayed and no capability remains accidentally enabled.
- Record achieved rollback time and compare to objective.

### RT-RELZ-004 — Post-Deploy Validation

- Run smoke plus selected real canaries against the deployed artifact, not a developer process.
- Validate auth, capability state, hosted/local boundaries, jobs, artifacts, redaction, metrics/traces, browser critical path, and rollback readiness.
- Retain exact deployment/build IDs and endpoints without exposing secrets.

### RT-MAINT-001 — Quarterly Operational Drills

Schedule and execute dependency outage, worker crash, database restore, artifact corruption, secret rotation, certificate/signing problem, model withdrawal/license change, rollback, and incident communication drills. Assign owner, cadence, evidence location, finding severity, due date, and closure verification.

### RT-MAINT-002 — Dependency/Model/License Drift

- Test update scanner behavior for changed source revision, checksum, license, model card/terms, runtime version, or security advisory.
- Fail promotion when review is stale or a dependency becomes unknown/incompatible.
- Re-run affected quality/runtime goldens before accepting updates.

## 23. Phase Exit-Gate Traceability

| Phase | Remaining test/certification focus | Primary IDs |
| --- | --- | --- |
| PX-00 | Exact repository/plan/manifest/issue authority on final SHA | RT-CI-001, RT-API-002 |
| PX-01 | Immutable sources, file-level provenance, model/asset/service terms, notices | RT-LIC-001, RT-RELZ-001, RT-MAINT-002 |
| PX-02 | Pack, permissions, durable jobs, approvals, artifacts, resources, DBs, operator API | RT-PLAT-001–009, RT-DB-001, RT-API-001–003 |
| PX-03 | Reversible compression, isolation, budgets, quality, failure learning | RT-CTX-001–002, RT-XCAP-001 |
| PX-04 | Stale index, architecture/Git/impact goldens, safe ingest, large-repo stress, UI | RT-REPO-001–003, RT-A11Y-001–002 |
| PX-05 | Branch-aware memory, staleness, isolation, export/import, deletion, quality | RT-MEM-001–002, RT-XCAP-001 |
| PX-06 | Discovery, messaging, claims, cancellation, conflicts, console, canary | RT-AGENT-001–002, RT-UI-002 |
| PX-07 | Endpoint policy, model probing, fallback, overload/cancel, hardware, hosted denial | RT-AI-001–003, RT-CLEAN-002 |
| PX-08 | Godot mutation/runtime/assertion/profiler/export/recovery canary | RT-GAME-001–002, RT-GAME-005 |
| PX-09 | Unity/Unreal/AssetCooker licensing, isolation, real engine evidence | RT-GAME-001, RT-GAME-003–006 |
| PX-10 | Image safety, deterministic goldens, batch recovery, handoff, UI | RT-SPRITE-001–004 |
| PX-11 | Rights, Demucs isolation/quality, mixer integrity, egress, UI, CPU/GPU | RT-AUDIO-001–004 |
| PX-12 | Local STT/TTS, devices, capture/clipboard consent, packaging/rollback | RT-VOICE-001–006 |
| PX-13 | Authorized ingest, OCR/editor, translation, dubbing, narration/read-along | RT-MEDIA-001–006, RT-XCAP-003 |
| PX-14 | Exact-head regression, uncovered branches, AI proposal isolation | RT-WRITE-001–002, RT-COV-001–003 |
| PX-15 | Exact-head regression, source grounding/scoring/staleness/isolation | RT-STUDY-001, RT-COV-001–003 |
| PX-16 | Sandbox, responsive preview, source links, proposals, undo, import/export, a11y | RT-WEB-001, RT-UI-002, RT-A11Y-001–002 |
| PX-17 | Local-only mock API, bounded routes, provenance exports, scaffolds, doctor | RT-DEV-001–002, RT-UI-002 |
| PX-18 | Unified availability/setup/jobs/approvals/artifacts/packs/diagnostics UX | RT-UI-001–003, RT-A11Y-001–002 |
| PX-19 | Threat model, composition abuse, supply chain, process/media/web/memory security | RT-PLAT-002–009, RT-NATIVE-002, RT-XCAP-007 |
| PX-20 | SLOs, telemetry, restart, failure matrix, load/soak, backup, quotas, runbooks | RT-PERF-001–004, RT-REL-001–003, RT-OBS-001 |
| PX-21 | Domain bundles, cross-capability, clean machines/devices, a11y, license/SBOM | RT-XCAP-001–007, RT-CLEAN-001–002, RT-A11Y-002, RT-LIC-001 |
| PX-22 | Exact manifest/artifacts, controlled rollout, post-deploy, rollback, drills | RT-RELZ-001–004, RT-MAINT-001–002 |

## 24. Recommended Implementation Order

### Wave 1 — Prevent unsafe promotion

1. RT-PLAT-003 through RT-PLAT-009.
2. RT-NATIVE-002 and RT-API-001 through RT-API-003.
3. Tier A coverage under RT-COV-002.
4. RT-LIC-001 and RT-HARNESS-004.

### Wave 2 — Close known runtime gaps

1. RT-HARNESS-001 through RT-HARNESS-003.
2. RT-GAME-003 and RT-GAME-005: Unity license plus Unity/Unreal assertion/profiler bridges.
3. RT-VOICE-001 through RT-VOICE-005.
4. RT-MEDIA-001 through RT-MEDIA-006.
5. RT-AUDIO-001 through RT-AUDIO-004.
6. RT-GAME-001, RT-GAME-002, RT-GAME-004, and RT-GAME-006.

### Wave 3 — Coverage and product workflows

1. RT-CTX, RT-REPO, RT-MEM, and RT-AGENT suites.
2. RT-SPRITE, RT-WRITE, RT-STUDY, RT-WEB, and RT-DEV suites.
3. RT-UI-001 through RT-UI-003.
4. Reach server/client Stage 3, then final global and critical targets.

### Wave 4 — Production certification

1. RT-PERF-001 through RT-OBS-001.
2. RT-CLEAN-001 through RT-COMPAT-001.
3. RT-XCAP-001 through RT-XCAP-007.
4. RT-A11Y-002 and final legal/SBOM review.
5. RT-RELZ-001 through RT-MAINT-002.
6. RT-CI-001 on the final candidate and capture Required CI.

## 25. Evidence Directory Convention

Store retained evidence under:

```text
docs/implementation/evidence/profile-expansion/<TEST-ID>/<YYYY-MM-DD>_<SHORT-SHA>/
  evidence.json
  summary.md
  commands.json
  environment.json
  checksums.sha256
  junit-or-playwright-report.*
  logs/
  artifacts/
  screenshots-or-recordings/   # only when privacy-safe and necessary
  reviewer-signoff.json        # manual/legal/release items
```

Large or sensitive evidence that cannot be committed must be stored in the approved immutable evidence system. Commit only its content hash, retention reference, access classification, and reviewer result. Never commit credentials, license files, private speech, raw screen captures, copyrighted test media, or personal data.

## 26. Final Release Test Checklist

- [ ] All P0 items are `COMPLETE` on the final exact commit.
- [ ] All capability-specific P1 items are `COMPLETE` for every capability selected for promotion.
- [ ] No unexplained skipped test remains in a production-supported area.
- [ ] Server Stage 3 and final global coverage pass.
- [ ] Server Tier A 90% line/85% branch coverage passes.
- [ ] Every production-supported domain service/route meets at least 80% line/70% branch coverage.
- [ ] Dangerous mutation, consent, path, and process controls meet at least 90% line/85% branch coverage.
- [ ] Client Stage 3 and final coverage pass; critical workflows meet 80% line/70% branch coverage.
- [ ] Every promoted external adapter has a real-runtime canary on a supported version/hardware profile.
- [ ] Unity licensing and Unity/Unreal project-side assertion/profiler gaps are closed or those capabilities remain blocked and unpromoted.
- [ ] Cross-capability authority, isolation, and lineage tests pass.
- [ ] Load, soak, restart, failure, backup, restore, corruption, and rollback drills pass.
- [ ] Clean-machine local and hosted certification passes.
- [ ] Automated cross-browser and signed manual accessibility certification passes.
- [ ] Immutable source/license, SBOM, notice, artifact, signature, and provenance review passes.
- [ ] Release manifest matches actual server-authoritative capability states.
- [ ] Controlled rollout and post-deploy validation pass.
- [ ] Rollback is demonstrated within the stated objective.
- [ ] Operational drill, dependency/license review, evaluation maintenance, and deprecation owners/cadences are assigned.
- [ ] Required CI is green on the exact pushed release commit.

Only after every applicable item above is complete should tracker/evidence rows move from `IMPLEMENTED_NOT_VERIFIED` to `VERIFIED` or capabilities move from `LOCAL_ONLY_EXPERIMENTAL` to a production maturity state.
