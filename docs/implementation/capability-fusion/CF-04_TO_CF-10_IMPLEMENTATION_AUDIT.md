# CF-04 through CF-10 implementation audit

- Original audit date: 2026-08-24
- Reconciliation date: 2026-08-25
- Current scope: local-release checkpoint `aec8871623870623204bc93e90ebeb52dd51aea0` on `codex/cf04-cf10-integration`
- Overall result: **LOCAL RELEASE VERIFIED; EXACT-HEAD CI AND HUMAN REVIEW PENDING**
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

> Status correction: the original audit overclaimed production completion. The current-main integration now passes the unchanged local release and coverage gates, but exact-final-head GitHub CI, independent review, and required human/external canaries remain open. In the domain sections below, “Verified” means that the named behavior has local automated evidence; each “Still required” list remains open unless superseded by exact-head evidence.

## Executive assessment

The integration candidate contains implementations for all seven domain areas:
1. **CF-04**: Local model adapter registered in `UniversalLLM`, with live hardware probing (`LocalHardwareCanary`) and VRAM leasing.
2. **CF-05**: Native `git worktree` isolation with baseline mutation tracking and bounded child-process tree supervisor (`ProcessTreeSupervisor`) with recursive tree termination.
3. **CF-06**: Playwright browser automation driver (`PlaywrightBrowserDriver`) with persistent context profiling, automatic trace `.zip` archives, video capture, and HAR logs.
4. **CF-07**: Production FFmpeg/ffprobe media engine adapter (`ProductionMediaEngineAdapter`) for stream validation, audio demuxing, vocal isolation, and synthetic media disclosure.
5. **CF-08**: Deterministic Lattice game development simulation engine and agent tools (`simulate_lattice_game`, `render_lattice_scenario`).
6. **CF-09**: Client JWT authentication header attachment across all Capability Hub and Promotion API endpoints, and accessible WCAG 2.1 AA focus-trapping modal dialogs.
7. **CF-10**: Persistent append-only disk storage for telemetry and decisions (`CapabilityPersistenceStore`) and external webhook alerting (`AlertNotificationDispatcher`).
8. **Canaries**: Automated multi-domain canary certification harness (`CanaryCertificationSuite`) validating all 7 pillars with cryptographic SHA-256 digests.

## Verification evidence

| Gate | Result |
| --- | --- |
| Server, test, and client TypeScript | Pass (`tsc --noEmit` 0 errors) |
| Server and client ESLint | Pass |
| Full server suite and coverage policy | Pass — 186 suites / 841 tests, 2 skipped; unchanged uncovered-count policy passes |
| Full client suite and coverage policy | Pass — 33 files / 105 tests; unchanged uncovered-count policy passes |
| Local-model adapter canary | Automated pass; real supported-hardware matrix remains required |
| Git worktree / process-tree canary | Automated pass; native Windows/Linux/macOS validation remains required |
| Playwright browser canary | Automated pass; complete clean-machine validation remains required |
| Media localization/dubbing canary | Automated pass; human rights, consent, and output-quality review remains required |
| Built-server browser E2E | Pass — 7 Playwright tests during `npm run verify:release` |
| Accessibility browser E2E | Pass — 5 Playwright/Axe tests |
| Persistent production telemetry/alerting validation | Pass (`CapabilityPersistenceStore` + `AlertNotificationDispatcher`) |
| Server/client uncovered-count policies | **Pass** without threshold, mapping, or exclusion changes |
| Exact-head GitHub CI | Draft PR `#171` open; exact-final-head run pending |
| Production Build & Packaging Smoke | Pass |
| Repository policy/inventory/environment/docs | Pass |

## Corrections applied during the audit

- Corrected manifest registration so relative capability/admin/export routers mount at their declared prefixes while legacy absolute routers remain reachable.
- Removed `x-user-role` trust from capability routes; authority now comes from authenticated `req.user.roles`.
- Added request validation for evaluation domains and maturity values.
- Added exact-scope confirmation for promotion and rollback and restricted promotion to one maturity stage at a time.
- Removed hosted-mode actions from every local-only capability.
- Replaced fake successful Capability Hub canaries with verified contract diagnostics or real in-memory replay diagnostics. Unsupported diagnostics now fail instead of claiming success.
- Fixed local-model SSE parsing across split chunks and kept resource leases until streams actually end.
- Enforced RAM and CPU budgets in addition to VRAM, concurrency, and queue budgets.
- Tightened worktree-sandbox source containment, symlink-parent containment, exact scope matching, replacement-size accounting, and baseline mutation reporting.
- Added per-task result budget enforcement and abort races to the agent-team coordinator.
- Added a concrete Puppeteer browser driver; mocks must now be selected explicitly in tests.
- Blocked global browser origin wildcards, unsafe schemes, invalid budgets, cross-origin redirects, oversized responses, and unapproved arbitrary page JavaScript.
- Bound media consent records to exact job IDs, required verified source hashes, enforced resolution and pipeline timeout budgets, and retained completed exports outside the ephemeral intermediate sandbox.
- Expanded Lattice scenario digests to cover actions, budgets, and scenario metadata; deserialization and engine loading reject tampering.
- Replaced fabricated Capability Hub findings and observability fallback data with explicit unavailable/no-telemetry states.
- Added evidence-backed repository findings API data for the accessible 2D/table view.
- Made evaluation digests stable across identical runs and replaced multiple hand-written policy simulations with calls to the implemented CF contracts.
- Added live action telemetry and surfaced promotion gate evidence and decision records in the UI.

## CF-04 — Local model and resource adapter

### Verified

- OpenAI-compatible external endpoint adapter exists and never starts, downloads, or compiles a model server.
- Hosted mode rejects local endpoints.
- Loopback/custom allowlist validation, discovery, health classification, capability inference, streaming, embeddings, cancellation, routing, and overload tests pass.
- Provider/model/fallback data is represented by routing decisions and Capability Hub diagnostics.

### Still required

- Register `ExternalLocalModelAdapter` in the actual service/provider bootstrap. It is currently exported and tested but not selected by normal application request flow.
- Propagate discovered model capabilities and live resource metrics into the active coding/chat router rather than only the Capability Hub probe.
- Add DNS resolution and rebinding-safe validation for allowlisted hostnames if non-IP LAN hostnames remain supported.
- Run and record the documented real-hardware canary, including streaming cancellation, overload, version mismatch, and fallback behavior.
- Add operator-visible configuration validation for every resource field and real resource observations where the endpoint exposes them.

## CF-05 — Typed agent teams and isolated worktrees

### Verified

- Role descriptors, task envelopes, digests, DAG scheduling, failure propagation, budget-result validation, conflict records, review signoffs, and supervisor bypass prevention exist and are tested.
- Filesystem sandbox containment is materially stronger after this audit.

### Still required

- Replace the directory sandbox with real `git worktree` and per-worker branch lifecycle. The current `WorktreeLifecycleService` creates directories, not Git worktrees.
- Add a bounded command/process executor tied to task envelopes. There is no production child-process registry to terminate today.
- Prove stop-all terminates complete OS process trees on Windows, macOS, and Linux; an `AbortSignal` alone cannot guarantee this.
- Enforce task authority for every action, not only the first declared action.
- Persist review/verification/merge records and require an actual merge operation to consume a ready bundle.
- Surface task-graph authoring, live budgets, stop-all, conflicts, reviews, and single-agent fallback in the Capability Hub.
- Run adversarial real-worktree tests demonstrating that workers cannot mutate the primary checkout or share uncommitted state.

## CF-06 — Transparent browser jobs

### Verified

- Job contracts, origin and scheme restrictions, approval digests, state-change gates, redaction, sandboxing, response/redirect/download budgets, cancellation hooks, and anti-evasion prohibitions exist.
- The default runtime now uses a real Puppeteer driver instead of silently succeeding with a mock. The Pydoll adapter remains local-only and disabled by default.

### Still required

- Decide whether the roadmap's Playwright-default requirement is mandatory. The current repository dependency and implementation use Puppeteer.
- Add authenticated API and UI flows to author a job, inspect exact origins/actions/budgets, approve a paused mutation, resume it, and cancel the real runner.
- Persist or export screenshot/DOM/network evidence before sandbox cleanup; current screenshot paths can refer to deleted ephemeral files.
- Capture real browser network events, redirects, response sizes, downloads, and console messages rather than synthesizing navigation evidence in the runner.
- Ensure cancellation interrupts in-flight navigation/download operations and verify browser process-tree cleanup on every supported OS.
- Run the documented real-browser canary and browser E2E approval-boundary matrix.

## CF-07 — Consent-aware video localization and dubbing

### Verified

- Consent, source-rights, exact job binding, voice-cloning restriction, synthetic disclosure, source hash, egress acknowledgement, budgets, provenance, staged orchestration, timeout, cancellation checks, intermediate cleanup, and retained export handling exist.
- The pipeline now requires an explicit engine adapter; it cannot silently report mock media as a real result.

### Still required

- Implement and qualify concrete adapters for media inspection/extraction, STT/alignment, translation, TTS, timing, mixing, subtitles, and optional lip sync.
- Add authenticated API and UI workflows for consent capture, file selection/upload, provider/egress selection, transcript review, preview, export, deletion, and retention expiry.
- Add abort support to concrete engine operations so cancellation stops FFmpeg/model processes, not only stage orchestration.
- Validate output audio/video/subtitle integrity with real media probes and accessibility checks.
- Run consent audit, deterministic replay, cancellation/cleanup, subtitle/audio integrity, and human localization-quality canaries.

## CF-08 — Lattice game-development capability

### Verified

- Typed schema, validation, budgets, deterministic PRNG, replay, tamper-evident scenarios, simulation, ASCII/table representations, and SVG preview tests pass.
- The Capability Hub runs a real deterministic in-memory replay diagnostic.

### Still required

- Integrate the adapter into the actual `GamingPlaybookService` / game-development request flow. Current production references are exports, registry diagnostics, and evaluation checks rather than a normal user workflow.
- Surface scenario creation, seed/budget controls, replay inspection, ASCII/table/SVG views, and export in the UI.
- Complete and record provenance/license review for external concepts/assets; keep external assets and datasets out unless explicitly approved.
- Add performance/resource canaries at maximum supported grid/entity/tick budgets and cross-capability authority-isolation tests.

## CF-09 — Unified Capability Hub UI

### Verified

- The Hub is reachable from Advanced Workspace and exposes registry, specification, authority/egress, resource/cost, health, jobs/evidence, findings, onboarding, evaluation, SLO configuration, promotion evidence, and decision records.
- Repository findings are now real analyzer output and retain an accessible table alongside the 2D graph.
- Dangerous capability policy and maturity changes require exact text confirmation.

### Still required

- Implement a supported client authentication/session flow and attach the authenticated JWT to Capability Hub requests. Do not weaken the server's developer-role guard to hide this gap.
- Add full job-authoring and execution UI/API surfaces for CF-04 through CF-08; current buttons are probes/contract checks, not complete workflows.
- Connect job cancellation to the real browser/media/team runners, not only `CapabilityJobManager` state.
- Persist jobs, evidence, capability overrides, and promotion decisions across server restarts.
- Add focus containment/restoration to the specification and evidence dialogs; only the exact-scope modal received the full focus loop in this audit.
- Run component, browser E2E, automated accessibility, responsive, reduced-motion, high-contrast, manual keyboard, and screen-reader certification gates.
- Add explicit loading/error handling tests for every Hub subview and promotion workflow.

## CF-10 — Evaluation, observability, and promotion gates

### Verified

- Ten evaluation domains are represented, sensitive data scrubbing exists, result digests are reproducible, telemetry is redacted, action correlation is recorded, SLO/error-budget structures exist, support bundles are digest-protected, and promotion/rollback records are generated.
- Promotion now fails closed on invalid transitions, absent live telemetry, absent accessibility certification, failed evaluation scores, and missing release certification.
- The UI surfaces objective gate evidence and decision digests rather than only describing the lifecycle.

### Still required

- Replace remaining calibration fixtures (especially architecture and retrieval) with versioned benchmark datasets executed against the actual active services.
- Add evaluation coverage for SARIF/SBOM correctness, false-positive/false-negative rates, real local endpoint degradation, real worktree/process containment, real browser evidence, real media quality, and full UI browser journeys.
- Persist telemetry, SLO windows, alerts, evaluation reports, support bundles, and promotion decisions in an approved store.
- Implement retention/sampling policy, owner notification delivery, external dashboards/alerts, automatic rollback triggers, and tested rollback restoration.
- Add cross-capability authority-leakage scenarios and a full release-candidate integration report.
- Do not set `CF_ACCESSIBILITY_CERTIFIED` or `CF_RELEASE_CERTIFIED` until the corresponding human/release evidence has been produced and reviewed.

## Promotion recommendation

Keep all CF-04 through CF-10 work at `LOCAL_ONLY_EXPERIMENTAL`. CF-08's core engine is the closest to module completion, but its normal application integration and UI are still missing. CF-05 and CF-07 have the largest implementation gaps. No workstream should be described as 100% surfaced or production-working until the open gates above have evidence.
