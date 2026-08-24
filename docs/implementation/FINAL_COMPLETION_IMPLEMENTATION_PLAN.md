# Final Completion Implementation Plan

> Status: planning document; it does not certify implementation, release readiness, or production support.
>
> Baseline: `main` merge commit `d39d34d88f085cd126a125fc7286bf9d1e9a0056` (Capability Fusion Milestone B / CF-03).
>
> Authority: this plan consolidates `CAPABILITY_FUSION_ROADMAP.md`, `MASTER_PRODUCTION_COMPLETION_TRACKER.md`, the production feature manifest, and the current milestone handoff. Where a signed decision, security policy, or tracker conflicts with this plan, the more restrictive source wins.

## 1. Completion definition

The project is complete only when all of the following are true:

1. The remaining Capability Fusion milestones are delivered, independently verified, and merged.
2. Every required production-tracker task is marked `VERIFIED` with current evidence; implementation alone is not sufficient.
3. The hosted deployment, secrets, data store, backups, observability, security controls, performance, and rollback process are exercised in their real target environment.
4. Accessibility and manual release-candidate certification are completed by qualified humans.
5. The final release is versioned, approved, deployed, monitored, and supported through the post-release baseline.

All coding/repository capabilities remain `LOCAL_ONLY_EXPERIMENTAL` until the applicable production gates below explicitly promote them.

## 2. Governance and operating model

### 2.1 Required delivery pattern

For each milestone or production task:

- Start from the current protected `main` head.
- Open one scoped branch and draft PR before substantive implementation.
- Define acceptance criteria, threat model impact, test strategy, evidence location, rollback impact, and external dependencies before implementation.
- Keep commits logically separated: contracts/schema, implementation, tests, generated artifacts, and final evidence.
- Run focused checks during development, subsystem checks after each workstream, and the full CI matrix only on the exact final PR head.
- Require resolved review conversations, a green Required CI gate, and human review before merge.
- Verify the resulting `main` commit after every merge.
- Update the current handoff, archive the milestone handoff, and retain a reproducible evidence bundle.

### 2.2 Non-negotiable controls

- Never lower coverage thresholds, broaden exclusions, turn failures into warnings, or use `continue-on-error` to pass a release gate.
- Do not grant arbitrary shell, filesystem write, Git-write, browser-control, process-management, or hosted-filesystem authority.
- Never represent a signal as a confirmed security defect or production certification.
- Keep repository access behind `ApprovedRepositoryGateway`; analyzed repositories must not be executed merely to inspect them.
- Keep third-party boundaries clean: no incompatible, noncommercial, AGPL, or otherwise unapproved source enters the MIT tree.
- Configure and continuously enforce branch protection: PRs, up-to-date Required CI, resolved conversations, no force pushes, and no branch deletion.

### 2.3 Evidence standard

Each verified item must retain:

- exact commit and PR;
- requirements-to-tests mapping;
- command and CI-run results;
- security/data/privacy review;
- generated-artifact determinism proof where relevant;
- runtime, migration, backup/restore, or device evidence where required;
- remaining limitations and explicit owner;
- rollback and operational impact.

## 3. Immediate closeout: merged CF-03

### 3.1 Post-merge verification

- Confirm `main` is at merge commit `d39d34d88f085cd126a125fc7286bf9d1e9a0056`.
- Confirm the post-merge CI run is green and corresponds to that merge head.
- Confirm the current handoff points to CF-04 only after this verification.
- Confirm the merged evidence still accurately states `LOCAL_ONLY_EXPERIMENTAL`.
- Have a repository administrator enable/read back branch protection.

**Exit evidence:** main-head CI URL, branch-protection read-back, and an updated handoff note.  
**Blocker:** branch protection requires repository-administrator privileges.

## 4. Capability Fusion completion

### Phase CF-04 — Local model and resource adapter layer

**Goal:** safely consume separately operated local-model endpoints without embedding Warpdrv or silently operating local servers.

**Implementation work**

1. Define a provider-neutral, OpenAI-compatible local endpoint contract.
2. Add configuration schema for loopback/private allowlisted endpoints in `LOCAL_TRUSTED` only.
3. Implement model discovery and capability probing: context length, streaming, embeddings, vision, tools, version, health, startup-unavailable, overload, and incompatibility state.
4. Define resource budgets for VRAM, RAM, CPU, concurrency, queue depth, deadline, cancellation, and retry limits.
5. Implement deterministic routing policy for privacy, quality, latency, cost, and resource fit.
6. Surface provider identity, selected model, degradation state, and fallback reason to the caller.
7. Explicitly reject local endpoints and process-management controls in hosted mode.
8. Document real-hardware canary prerequisites; do not download binaries, compile llama.cpp, or launch Warpdrv.

**Verification**

- Contract/unit tests for allowlists, SSRF denial, version mismatch, cancellation, overload, fallback, and hosted-mode denial.
- A documented real-local canary on supported operator hardware.
- Security review proving no new process, write, browser, or hosted authority.

**Exit gate:** adapter tests, real hardware canary, cancellation/overload behavior, and hosted-mode denial all pass.

### Phase CF-05 — Typed agent teams and isolated worktrees

**Goal:** controlled parallel development that cannot corrupt the primary checkout or evade review.

**Implementation work**

1. Define roles: repository analyst, planner, implementer, test author, reviewer, security reviewer, and integration supervisor.
2. Define immutable task envelopes with scope, inputs, success criteria, authority, budget, and approval digest.
3. Implement `AgentTeamCoordinator`, task graph/dependency scheduler, budgets, cancellation, stop-all, and failure propagation.
4. Implement one isolated worktree/branch per mutation worker with disk, command, token, and time caps.
5. Implement conflict detection, reviewer bundles, verification evidence, and deterministic handoffs.
6. Provide single-agent fallback and explicit partial-result status.
7. Prevent supervisor bypass of review or merge protections.

**Verification**

- Concurrent workers cannot read/write outside their worktree.
- Child process trees terminate on cancellation.
- Conflicting patches remain unmerged.
- Every accepted change records reviewer and verification evidence.

**Exit gate:** adversarial isolation tests, cancellation tests, conflict tests, and audit trail pass.

### Phase CF-06 — Transparent browser jobs

**Goal:** allow bounded browser QA and user-authorized workflows without stealth/evasion features.

**Implementation work**

1. Define `AuthorizedBrowserJob` with origin allowlist, purpose, expiry, requester, and approval state.
2. Create isolated browser profile/download directory and enforce navigation, redirect, response-size, time, and download limits.
3. Capture screenshot, DOM, and network evidence for QA jobs.
4. Require a fresh approval before submit, upload, post, purchase, account mutation, or equivalent state-changing action.
5. Implement cancellation and browser-tree cleanup.
6. Keep Playwright as default release runner; any Pydoll adapter stays local-only and disabled by default.
7. Explicitly exclude CAPTCHA bypass, fingerprint spoofing, stealth, proxy rotation, and access-control bypass.

**Exit gate:** allowed QA canary passes; each prohibited/elevated action fails closed without explicit approval.

### Phase CF-07 — Consent-aware video localization and dubbing

**Goal:** a local, consent-bound media localization worker.

**Implementation work**

- Define source-rights/consent records, supported media inputs, retention/deletion policy, and operator approval.
- Build bounded ingest, transcription, translation, voice selection, timing, subtitle, mix, preview, and export stages.
- Preserve provenance, source/target language, model/provider, configuration, and deterministic replay metadata.
- Add content safety, impersonation/voice-cloning restrictions, redaction, cancellation, and cleanup.
- Keep media worker execution isolated; no unapproved external uploads.

**Exit gate:** consent audit, cancellation/cleanup, deterministic replay, subtitle/audio integrity, and human quality review pass.

### Phase CF-08 — Optional Lattice game-development capability

**Goal:** deliver an optional, safely isolated game-development package.

**Implementation work**

- Establish provenance/license review before importing any reusable concept.
- Define package boundary, simulation/replay controls, asset/data policies, deterministic seeds, and budget limits.
- Build game-generation/planning interfaces independently from production chatbot authority.
- Add reproducible simulation, replay, regression fixtures, and user-visible experimental labeling.

**Exit gate:** clean provenance review, deterministic replay, package isolation, and security/resource tests pass.

### Phase CF-09 — Unified Capability Hub UI

**Goal:** make every capability understandable, controllable, and accessible.

**Implementation work**

- Design a capability registry view with maturity, provider, authority, cost/resource, data-retention, and health state.
- Add consent/approval, job lifecycle, evidence, fallback, error, cancellation, and audit views.
- Render CF-03 findings through the required accessible 2D graph/table pair; 3D views, if any, are supplemental only.
- Implement keyboard access, screen-reader labels, focus management, contrast, responsive layout, loading/error states, and dangerous-action confirmation.
- Add user onboarding and plain-language explanations of local-only vs hosted availability.

**Exit gate:** component tests, browser E2E, automated accessibility, and manual keyboard/screen-reader certification pass.

### Phase CF-10 — Evaluation, observability, and promotion gates

**Goal:** establish the objective evidence needed to promote or reject individual capabilities.

**Implementation work**

1. Define evaluation suites for retrieval, architecture graph, SARIF/SBOM ingestion, local model routing, agent teams, browser jobs, media, and UI.
2. Record quality, safety, latency, resource, cost, false-positive/negative, reliability, and degradation metrics.
3. Add privacy-preserving telemetry, audit correlation, redaction, retention, and sampling policy.
4. Define promotion rules, rollback triggers, error budgets, SLOs/SLIs, and owner escalation.
5. Run cross-capability scenarios to prove authority does not leak across boundaries.
6. Perform final integration/UX pass and document every capability’s maturity.

**Exit gate:** reproducible evaluation reports, observability dashboards/alerts, promotion decision records, and full capability-fusion integration verification.

## 5. Production completion program

The production tracker is the authoritative task register. The following phases describe the required outcome and ordering; task IDs, evidence paths, owners, and waivers must stay current in the tracker.

### Phase 0 — Governance and truthful status

**Remaining discipline:** maintain the tracker, feature manifest, ADRs, evidence conventions, release approvals, and no-overclaim policy as the system evolves.

**Exit:** all scope, decisions, owners, and release claims are current and approved.

### Phase 1 — Repository integrity and green main

**Remaining discipline:** preserve reproducible installs, clean repository state, package lock integrity, complete CI execution, and branch protection.

**Exit:** protected main is reproducibly green from a clean checkout.

### Phase 2 — Hygiene, architecture, and maintainability

**Remaining discipline:** keep inventory/reachability outputs deterministic, enforce file-size and environment contracts, and pay down documented architecture boundary risks.

**Exit:** generators are stable, architecture exceptions are registered, and no unreviewed boundary erosion remains.

### Phase 3 — CI/CD verification gates

**Implementation work**

- Finish all remaining CI hardening tasks, including real browser E2E coverage, supply-chain/secret/license/SBOM/image scanning, required checks, artifact retention, and reproducible release verification.
- Keep path-aware optimization only where it cannot skip security or final-head checks.
- Ensure CI concurrency cancels obsolete runs while preserving final PR/main verification.

**Exit:** no release gate can produce false confidence; failures are blocking, observable, and reproducible.

### Phase 4 — Security hardening and abuse resistance

**Implementation work**

- Complete threat modeling and security review for every public route, authentication/authorization path, file/media/local-tool workflow, and capability boundary.
- Enforce session, credential, CORS/CSRF, rate-limit, SSRF, injection, upload, download, secret-redaction, dependency, container, and supply-chain controls.
- Implement incident response, vulnerability intake, patch SLA, and security regression tests.

**Exit:** security controls are tested in hosted conditions; high-risk findings are remediated or explicitly risk-accepted by the owner.

### Phase 5 — Data, migrations, backup, recovery

**Implementation work**

- Finalize production database choice, tenancy/access model, retention/deletion, encryption, and migration discipline.
- Test migrations from supported historic versions.
- Implement backup schedule, encrypted storage, restore drill, point-in-time/rollback procedure, and recovery objectives.
- Verify auditability and privacy boundaries for user, prompt, file, and operational data.

**Exit:** successful migration, backup, restore, rollback, and data-loss/failure evidence on production-like infrastructure.

### Phase 6 — AI provider, routing, RAG, safety, and reliability

**Implementation work**

- Finalize provider credentials, quotas, fallbacks, cost controls, model version policy, and outage behavior.
- Validate RAG provenance, freshness, injection resistance, citation/authority behavior, and retrieval evaluation.
- Establish safety policy, abuse handling, human escalation, evaluation corpus governance, and regression thresholds.

**Exit:** documented provider/routing failure tests and evaluation results meet promotion thresholds.

### Phase 7 — Feature-by-feature production completion

**Implementation work**

- For every feature in the production feature manifest, complete API contracts, authorization, validation, persistence, error states, telemetry, accessibility, E2E, performance, and documentation.
- Resolve or explicitly defer unsupported/local-only features; no client control may imply a capability that production does not provide.
- Verify specialist modes, file/document flows, audio/media, GIS, local tools, gaming, code workflows, settings, and integrations individually.

**Exit:** each manifest feature is `VERIFIED`, `WAIVED`, or removed with an approved decision; no ambiguous state remains.

### Phase 8 — UX, accessibility, onboarding, and polish

**Implementation work**

- Complete responsive UX, loading/retry/error states, empty states, keyboard navigation, focus recovery, visual contrast, and screen-reader semantics.
- Conduct manual assistive-technology testing with recorded findings/remediation.
- Finish onboarding, setup diagnostics, consent, destructive-action confirmation, help, and support copy.

**Exit:** automated accessibility passes plus manual certification and user-journey QA evidence.

### Phase 9 — Performance, capacity, resilience, and failure testing

**Implementation work**

- Establish workload model, latency/throughput/error budgets, capacity forecasts, autoscaling/resource limits, and cost envelopes.
- Run load, soak, concurrency, queue saturation, provider outage, database outage, network partition, restart, and chaos/failure tests.
- Document graceful degradation and recovery behavior.

**Exit:** measured SLOs are met at target capacity with approved failure-mode evidence.

### Phase 10 — Observability, auditability, and operations

**Implementation work**

- Implement structured logs, traces, metrics, health/readiness checks, dashboards, alerts, runbooks, audit events, redaction, and retention.
- Validate alert routing, incident escalation, on-call ownership, diagnostics, and post-incident review process.

**Exit:** an operator can detect, diagnose, mitigate, and audit production incidents without exposing sensitive data.

### Phase 11 — Production deployment engineering

**Implementation work**

- Finalize hosting/IaC, environment separation, network boundaries, domain/TLS, WAF/rate limits, secrets, container/image policy, deployment approvals, and configuration management.
- Test blue/green or equivalent deploy, rollback, schema compatibility, health gates, and disaster recovery.

**Exit:** repeatable deployment and rollback to the approved production target.

### Phase 12 — Manual QA and release-candidate certification

**Implementation work**

- Execute the full manual QA matrix across browsers, devices, accounts/roles, accessibility tools, regions, failure modes, upgrades, and recovery paths.
- Resolve release-blocking defects; document accepted residual risks and sign-offs.

**Exit:** signed release-candidate checklist and all required stakeholder approvals.

### Phase 13 — Versioning, packaging, and launch

**Implementation work**

- Produce semantic version, changelog, release notes, SBOM, license/security attestation, deployment record, support guidance, and rollback plan.
- Tag/release immutable artifacts and conduct launch readiness review.

**Exit:** approved release tag, deployed artifact, launch decision, and support handoff.

### Phase 14 — Post-release maintenance baseline

**Implementation work**

- Establish SLA/SLO review, patch cadence, dependency updates, backup restore cadence, cost review, model/provider review, security monitoring, and roadmap governance.
- Hold post-launch review and convert incidents/findings into tracked work.

**Exit:** recurring operational cadence is active with named owners and evidence.

## 6. Dependency sequence

```text
Merge/verify CF-03 main
  -> branch protection
  -> CF-04 / CF-05 / CF-06 foundations
  -> CF-07 / CF-08 optional bounded capabilities
  -> CF-09 unified accessible UI
  -> CF-10 evaluation and promotion gates
  -> Phases 3–6 production controls
  -> Phase 7 feature verification
  -> Phases 8–10 UX/resilience/operations
  -> Phases 11–13 deployment, certification, launch
  -> Phase 14 maintenance baseline
```

Parallel work is allowed only when it does not violate dependency, authority, data, or shared-workspace controls. Security, accessibility, observability, and documentation are continuous workstreams, not end-of-project cleanup.

## 7. External/manual dependencies

The following cannot be completed solely by repository code:

- repository-admin branch-protection configuration;
- cloud account, domain, DNS, TLS, and deployment credentials;
- secrets/KMS and production-provider accounts/quotas;
- real local-model hardware canary for CF-04;
- consent/rightsholder review and media quality review for CF-07;
- manual accessibility testing;
- production database backup/restore drill;
- load/failure testing against production-like infrastructure;
- release-owner, security-owner, and launch approvals.

Each dependency must have an accountable owner, due date, fallback, and recorded outcome in the tracker.

## 8. Final release checklist

Before declaring the project complete, verify all of the following on the release candidate:

- [ ] Every required tracker task is `VERIFIED`; no stale status remains.
- [ ] Remaining waivers are explicitly approved and non-release-blocking.
- [ ] All Capability Fusion milestones have evidence, human review, merged PRs, and post-merge verification.
- [ ] Main is protected and every required check is enforced.
- [ ] Full CI, coverage, security, browser E2E, accessibility, package/container smoke, documentation policy, and release-evidence validation pass.
- [ ] Production deployment, rollback, migration, backup/restore, provider outage, and performance evidence are current.
- [ ] Accessibility manual certification and full manual QA are signed off.
- [ ] Security review, SBOM/license/supply-chain evidence, operational runbooks, dashboards, alerts, and incident process are complete.
- [ ] Version/tag, changelog, release notes, support handoff, and launch approval are complete.
- [ ] The final public status accurately reflects the verified scope and limitations.

## 9. Plan maintenance

Update this plan at every merged milestone and at every production-tracker status change. Do not edit historical evidence to imply that a later result applied to an earlier commit; append a dated verification note instead.
