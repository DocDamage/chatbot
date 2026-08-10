# AI Chatbot Hub — 100% Production Completion Implementation Plan

**Repository:** `DocDamage/chatbot`
**Repository URL:** https://github.com/DocDamage/chatbot
**Baseline branch:** `main`
**Baseline commit:** `8b963232d72a69c6616667aaf34daadba6056aba`
**Plan generated:** 2026-08-04
**Target:** A verifiably production-ready release, not merely a feature-complete development build
**Primary execution environment:** Codex, using one new thread per task and a mandatory handoff file

---

## 1. Purpose

This plan converts the current repository from a broad, substantially implemented application into a release that can honestly be called production-ready.

The plan does **not** treat passing unit tests, compiling successfully, or having a route present as proof that a feature is complete. A feature is complete only when its full production path has been implemented and verified:

1. User-facing entry point or documented API.
2. Backend route and business logic.
3. Authentication and authorization policy.
4. Validation and safe failure behavior.
5. Persistence and recovery where applicable.
6. UI loading, empty, success, and error states.
7. Accessibility and keyboard behavior.
8. Automated tests at the correct layer.
9. Manual runtime verification in a built application.
10. Evidence recorded against the exact commit tested.
11. Deployment verification in the intended target environment.
12. Operational monitoring, rollback, and recovery procedures.

This document is the authoritative completion sequence. Older completion trackers may remain as historical evidence, but they must be reconciled with this plan before release.

---

## 2. Current Baseline and Known Release Blockers

The following conditions were observed at the baseline commit and must be treated as facts until newer evidence replaces them.

### 2.1 Latest `main` CI is failing

The latest CI run on `main` failed:

- CI run: https://github.com/DocDamage/chatbot/actions/runs/26268394498
- Server type-check passed.
- Test type-check passed.
- Client type-check passed.
- Server lint passed.
- Client lint passed with one warning.
- Security route tests passed.
- Server route and service tests passed.
- E2E smoke tests passed.
- Server coverage completed.
- Client tests failed.
- Client coverage was skipped.
- Client accessibility checks were skipped.
- Packaging smoke was skipped.

The two known client failures are:

- `client/src/components/LocalRunApprovalPanel.test.tsx`
- `client/src/components/SpriteLabPanel.test.tsx`

Both failures concern clipboard-call expectations. They may be test-environment defects rather than product defects, but no release may proceed while the required branch workflow is red.

### 2.2 GitHub Pages deployment is failing

The latest Pages run failed:

- Pages run: https://github.com/DocDamage/chatbot/actions/runs/26268394524
- Static client build succeeded.
- Deployment creation failed with an HTTP 404.
- GitHub Pages configuration may not be enabled or may not be configured for GitHub Actions.

More importantly, Pages can host only the static client. The application’s production backend, authentication, database, Redis, local-tool policy, and provider integrations are not supplied by GitHub Pages. Pages must therefore be explicitly classified as one of the following:

- a static UI demonstration with mocked or disabled backend features;
- a client-only frontend pointing to a separately deployed API; or
- removed from the production release path.

It must not be presented as the complete production deployment unless the backend is separately deployed and correctly configured.

### 2.3 Current global server coverage is too low for the claimed surface

The latest full server test coverage reported approximately:

- Statements: **37.83%**
- Branches: **28.02%**
- Functions: **39.05%**
- Lines: **38.76%**

The Jest global threshold is only 15%, which allows large unverified areas to remain while CI appears healthy. Several security-sensitive, operational, provider, orchestration, and integration modules have little or no coverage.

### 2.4 The current client accessibility script is not an accessibility test

`client/package.json` currently maps the accessibility script to a TypeScript check. TypeScript compilation is useful, but it does not test:

- ARIA correctness;
- keyboard navigation;
- focus order;
- focus trapping and restoration;
- accessible names;
- contrast;
- screen-reader behavior;
- zoom and reflow;
- reduced-motion behavior;
- error-message association.

A real accessibility test program must replace the false-green gate.

### 2.5 Dependency and maintenance debt remains

The latest dependency installation reported:

- two moderate server dependency vulnerabilities;
- deprecated `multer` 1.x, with migration to 2.x recommended;
- deprecated or outdated versions of Supertest, Superagent, ESLint, `fluent-ffmpeg`, and supporting packages.

Every runtime dependency must be upgraded, replaced, removed, or accepted through a documented risk decision.

### 2.6 Repository integrity warning exists

GitHub Actions cleanup reported:

`fatal: No url found for submodule path 'docs/30-seconds-of-code' in .gitmodules`

This indicates a stale gitlink, missing `.gitmodules` entry, or malformed submodule state. It must be repaired or removed.

### 2.7 Production deployment is not certified

The repository contains Docker, Redis, database, provider, authentication, and environment configuration, but there is no current evidence bundle proving all of the following together in a clean target environment:

- production build;
- production start;
- real authentication and role enforcement;
- target database migrations;
- durable persistence across restart;
- Redis-backed shared rate limiting;
- provider connectivity and degraded behavior;
- secure reverse proxy and TLS;
- backup and restore;
- monitoring and alerting;
- rollback from a failed deployment;
- complete manual acceptance testing.

### 2.8 The supported product boundary is not strict enough

The repository contains a very broad surface, including chat, specialist agents, RAG, Knowledge OS, coding workflows, file browsing, document ingestion, audio analysis, image/video processing, local tools, Sprite Lab, SEC ingestion, GIS, creative writing, FL Studio integration, administration, webhooks, providers, observability, automation, and experimental or legacy modules.

A production release cannot claim all code in the repository as supported merely because it compiles. Each visible or reachable feature must be placed in one of four states:

1. **Production Supported**
2. **Production Preview**
3. **Local-Only Experimental**
4. **Disabled/Removed**

No ambiguous fifth state is allowed.

---

## 3. Definition of “100% Complete”

For this project, “100% complete” means all conditions below are satisfied at one tagged release commit.

### 3.1 Code and repository

- [ ] `main` is green with every required check passing.
- [ ] No known broken gitlinks, malformed submodules, or missing tracked files exist.
- [ ] No unreviewed generated files, temporary files, debug fixtures, or local secrets are tracked.
- [ ] Production-supported source files are kept below 300 lines where reasonably possible.
- [ ] Any source file above 300 lines has a written justification and has been reviewed for separation opportunities.
- [ ] Experimental, legacy, duplicate, or unreachable modules are removed or explicitly gated.
- [ ] Every public route appears in a maintained route manifest.
- [ ] Every production feature appears in a maintained feature manifest.

### 3.2 Security

- [ ] Authentication, authorization, CSRF, CORS, rate limiting, request limits, secret storage, upload handling, SSRF defense, path safety, local execution, and audit logging have threat models and tests.
- [ ] No critical or high-severity production dependency vulnerabilities remain.
- [ ] Every moderate production vulnerability is fixed or formally accepted with owner, rationale, compensating control, and review date.
- [ ] Secrets are injected through a production secret manager or protected deployment mechanism.
- [ ] Redis is not publicly exposed by default.
- [ ] Local execution is unavailable in hosted mode.
- [ ] All dangerous actions require explicit authorization and auditable approval.
- [ ] Logs and error responses are verified not to leak secrets, tokens, sensitive paths, prompts, or private content.

### 3.3 Data and reliability

- [ ] The production database is explicitly selected and documented.
- [ ] All migrations are versioned, idempotent where required, forward-tested, and rollback-tested.
- [ ] Backups are automated.
- [ ] A full restore has been performed successfully from a production-like backup.
- [ ] User ownership and tenant boundaries are enforced at storage and route layers.
- [ ] Restart, crash, timeout, provider outage, Redis outage, database outage, and malformed input behavior are verified.
- [ ] Graceful shutdown and in-flight request handling are verified.

### 3.4 Product and UX

- [ ] Every supported feature has a complete UI/API path.
- [ ] No production UI displays raw JSON as the normal user experience unless the feature is explicitly a developer console.
- [ ] Loading, empty, partial, success, degraded, unauthorized, forbidden, validation, and fatal-error states are implemented.
- [ ] Responsive behavior is verified at supported viewport sizes.
- [ ] Accessibility meets WCAG 2.2 AA for the supported workflows.
- [ ] Onboarding and setup paths work from a clean installation.
- [ ] User-facing documentation matches actual behavior.

### 3.5 AI behavior

- [ ] Provider routing, timeout, retry, fallback, cancellation, streaming, and cost/token controls are verified.
- [ ] RAG citations and grounding behavior are evaluated with release thresholds.
- [ ] Prompt-injection handling is tested against retrieved content and tool instructions.
- [ ] Domain and safety evals run in CI or an auditable release pipeline.
- [ ] A failed or unavailable model never silently converts into a fabricated successful result.
- [ ] Model/provider capability differences are surfaced accurately to users.

### 3.6 Operations and deployment

- [ ] A production-like staging environment exists.
- [ ] Deployment is automated and repeatable.
- [ ] Rollback has been demonstrated.
- [ ] Readiness, liveness, dependency health, metrics, logs, traces, and alerts are operational.
- [ ] Runbooks exist for common incidents.
- [ ] Release artifacts are versioned and reproducible.
- [ ] Final clean-machine acceptance testing passes.
- [ ] A release candidate is signed off by evidence, not by assertion.

---

## 4. Mandatory Execution Rules for Codex

These rules apply to every implementation task in this plan.

### 4.1 One task, one new Codex thread

Codex must not execute multiple task IDs in one thread.

For every task:

1. Start a new Codex thread.
2. Paste the current task start prompt.
3. Provide the latest handoff file.
4. Allow Codex to inspect the repository before editing.
5. Require an implementation evidence report.
6. End the thread after the task is verified or formally blocked.
7. Start another new thread for the next task.

A task may not be silently expanded into another task.

### 4.2 Mandatory handoff file

The canonical handoff file must be:

`docs/implementation/handoffs/CURRENT_HANDOFF.md`

Each completed task must also archive a task-specific copy:

`docs/implementation/handoffs/archive/<TASK-ID>_HANDOFF.md`

The handoff must include:

- repository and branch;
- exact commit SHA;
- completed task ID;
- files changed;
- behavior implemented;
- tests added or changed;
- exact commands run;
- pass/fail results;
- evidence paths;
- remaining known defects;
- next authorized task ID;
- a fresh “NEW THREAD START PROMPT.”

Codex must refuse to begin an unrelated task in the closed thread.

### 4.3 No completion by assertion

The following statements are not evidence:

- “Implemented.”
- “Tests pass.”
- “Production-ready.”
- “The route exists.”
- “The component renders.”
- “This should work.”

Every completion claim must cite:

- exact command;
- exit code;
- relevant output summary;
- test name or evidence file;
- tested commit SHA;
- runtime steps where applicable.

### 4.4 Source-file size rule

- Keep implementation source files below 300 lines where reasonably possible.
- Tests, generated schemas, migrations, and documentation may exceed 300 lines when splitting would reduce clarity or correctness.
- Do not split code into meaningless fragments merely to satisfy line count.
- Any production source file above 300 lines must be listed in `docs/architecture/large-file-register.md` with:
  - current line count;
  - why it cannot safely be split now;
  - reviewed decomposition options;
  - owner/task for future reduction if applicable.

### 4.5 No weakening gates to make CI green

Codex may not:

- delete a failing test without replacement and justification;
- lower coverage thresholds to pass;
- add broad exclusions to coverage;
- replace a runtime test with a mock-only test;
- turn an error into a warning solely to pass CI;
- skip a failing job;
- add `continue-on-error` to a release gate;
- disable security controls for development convenience;
- mark manual QA complete without runtime evidence.

### 4.6 Preserve scope and user data

- Do not remove production behavior merely because it is difficult to test.
- Do not alter database formats without a migration.
- Do not delete user data during tests or upgrades without an explicit test-only database.
- Do not expose local files, local tools, or desktop integrations in hosted mode.
- Do not commit secrets or machine-specific paths.

---

## 5. Task Status Model

Every task uses exactly one of these statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `IMPLEMENTED_NOT_VERIFIED`
- `BLOCKED`
- `VERIFIED`
- `RELEASED`

Only `VERIFIED` tasks count toward completion.

A task becomes `VERIFIED` only when:

1. implementation is present;
2. relevant automated checks pass;
3. runtime verification passes when required;
4. evidence is committed or attached;
5. documentation is updated;
6. the task’s exit gate is satisfied.

---

## 6. Evidence Architecture

Create this structure before implementation work continues:

```text
docs/
  implementation/
    MASTER_PRODUCTION_COMPLETION_TRACKER.md
    RELEASE_EVIDENCE_INDEX.md
    decisions/
    handoffs/
      CURRENT_HANDOFF.md
      archive/
    evidence/
      PHASE-00/
      PHASE-01/
      PHASE-02/
      ...
    runbooks/
    threat-models/
    qa/
```

Each task evidence directory must follow:

```text
docs/implementation/evidence/<PHASE>/<TASK-ID>/<YYYY-MM-DD>_<SHORT-SHA>/
  summary.md
  commands.md
  results.json
  changed-files.txt
  test-output.txt
  runtime-checklist.md
  screenshots/
  artifacts/
```

Sensitive logs must be sanitized before committing. Large raw logs may be stored as GitHub Actions artifacts, with stable references recorded in `summary.md`.

### Required `results.json` fields

```json
{
  "taskId": "P01-T01",
  "commit": "full-sha",
  "branch": "task-branch",
  "status": "VERIFIED",
  "commands": [
    {
      "command": "npm run type-check:server",
      "exitCode": 0
    }
  ],
  "automatedTestsPassed": true,
  "runtimeQaRequired": true,
  "runtimeQaPassed": true,
  "knownLimitations": [],
  "evidenceGeneratedAt": "ISO-8601 timestamp"
}
```

---

# PHASE 0 — Release Governance, Scope Freeze, and Truthful Status

## Objective

Create a single, enforceable definition of the supported release and eliminate contradictory completion claims.

## P00-T01 — Create the master production completion tracker

### Implementation

Create `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md` containing:

- every task ID in this plan;
- owner;
- status;
- branch;
- commit;
- evidence path;
- blocker;
- date verified;
- release applicability.

### Acceptance criteria

- [ ] Every task in this document appears exactly once.
- [ ] No task is pre-marked `VERIFIED` without current evidence.
- [ ] Historical completion claims are linked, not automatically accepted.
- [ ] The tracker is reviewed in every pull request affecting release status.

## P00-T02 — Create the production feature manifest

Create `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`.

For every route, UI panel, specialist mode, provider, integration, and background service, record:

- feature ID;
- user-visible name;
- route(s);
- component(s);
- service(s);
- persistence;
- required role;
- hosted/local availability;
- status category;
- automated test coverage;
- runtime QA evidence;
- release version.

### Required categories

- `PRODUCTION_SUPPORTED`
- `PRODUCTION_PREVIEW`
- `LOCAL_ONLY_EXPERIMENTAL`
- `DISABLED_OR_REMOVED`

### Exit gate

No route or UI feature is left uncategorized.

## P00-T03 — Reconcile existing release documents

Reconcile:

- `README.md`
- `docs/100_PERCENT_FINISH_STATUS.md`
- `docs/RELEASE_COMPLETION_AUDIT.md`
- `docs/FEATURE_COMPLETION_TRACKER.md`
- `docs/DEPLOYMENT_MODES.md`

### Required changes

- Mark older documents as historical snapshots where appropriate.
- Remove or qualify stale “green CI” claims.
- Add exact commit and date to every verification statement.
- Link the new master tracker.
- Separate implemented, automated-verified, manual-verified, and deployment-verified states.
- Remove language that calls the repository production-ready before final sign-off.

## P00-T04 — Establish release decisions

Create architecture decision records for:

1. production database;
2. hosted versus local-desktop product boundaries;
3. GitHub Pages purpose;
4. supported LLM providers;
5. supported file formats;
6. supported operating systems for local integrations;
7. Redis deployment model;
8. production hosting target;
9. support policy for experimental modules;
10. telemetry and privacy policy.

Use `docs/implementation/decisions/ADR-####-<name>.md`.

## P00-T05 — Create GitHub milestones and issues

Create one milestone per phase and one issue per task.

Issue title format:

`[P01-T03] Repair repository gitlink/submodule integrity`

Issue body must contain:

- task objective;
- permitted scope;
- dependencies;
- acceptance criteria;
- evidence requirements;
- handoff requirement;
- file-size rule;
- explicit prohibition against weakening gates.

## Phase 0 exit gate

- [ ] One authoritative tracker exists.
- [ ] Every feature has a release category.
- [ ] Existing documentation no longer contradicts current evidence.
- [ ] Deployment and architecture decisions are recorded.
- [ ] All future work is represented by issues and milestones.

---

# PHASE 1 — Restore Repository Integrity and a Fully Green `main`

## Objective

Repair all current branch failures and make every required release gate execute.

## P01-T01 — Reproduce the latest CI failure locally

### Commands

```bash
npm ci
npm --prefix client ci
npm run type-check:server
npm run type-check:tests
npm run type-check:client
npm run lint:server
npm run lint:client
npm run test:security -- --runInBand
npm run test:routes -- --runInBand
npm run test:services -- --runInBand
npm run test:e2e -- --runInBand
npm run test:coverage -- --runInBand
npm --prefix client test
```

### Acceptance criteria

- [ ] The two failing client tests are reproduced or the environmental difference is documented.
- [ ] The failure is explained at the browser API/mock boundary.
- [ ] No code is changed before the failure mechanism is understood.

## P01-T02 — Correct clipboard behavior and tests

Inspect:

- `LocalRunApprovalPanel`
- `SpriteLabPanel`
- relevant test setup
- `navigator.clipboard` availability and permissions
- fallback behavior for unavailable clipboard APIs

### Required behavior

- Copy succeeds in supported secure browser contexts.
- A clear success status is announced accessibly.
- Permission or API failure produces a non-fatal error state.
- Tests validate both success and failure paths.
- Tests do not rely on replacing a non-configurable global incorrectly.

### Exit gate

Both affected test files pass locally and in GitHub Actions.

## P01-T03 — Remove the client lint warning

Fix the unused `err` variable without hiding useful error reporting.

### Acceptance criteria

- [ ] Client lint reports zero warnings.
- [ ] No lint rule is disabled merely to hide the warning.

## P01-T04 — Repair stale gitlink/submodule state

Investigate `docs/30-seconds-of-code`.

Choose one valid outcome:

1. restore a valid `.gitmodules` entry and pinned submodule; or
2. remove the gitlink and replace it with normal tracked content or documentation; or
3. remove the unused dependency entirely.

### Verification

```bash
git ls-files --stage
git submodule status
git fsck --full
```

### Acceptance criteria

- [ ] No submodule cleanup warning appears in CI.
- [ ] A clean clone and checkout succeed.
- [ ] No undocumented external source dependency remains.

## P01-T05 — Decide and repair GitHub Pages

### Required decision

Document whether Pages is:

- disabled;
- a static demo;
- or a frontend for a separately hosted API.

### If Pages remains

- Enable Pages for GitHub Actions.
- Add a visible demo limitation notice when backend capabilities are unavailable.
- Ensure runtime API configuration is injected safely.
- Do not expose production secrets to the client build.
- Add a post-deployment smoke check.

### If Pages is removed

- Delete the workflow.
- Remove README claims and links.
- Preserve the production deployment workflow elsewhere.

## P01-T06 — Make all current CI stages execute

Fix the pipeline so a client test failure does not permanently conceal the health of later independent diagnostics while still failing the overall workflow.

Preferred structure:

- type-check job;
- lint job;
- server-tests job;
- client-tests job;
- accessibility job;
- security job;
- packaging job;
- Docker build job;
- final required-gate job.

Parallel jobs may all execute, but the final gate must fail if any required job fails.

## P01-T07 — Add branch protection

Require:

- pull requests for `main`;
- required CI checks;
- conversation resolution;
- up-to-date branch before merge;
- no force pushes;
- no branch deletion;
- signed commits if practical;
- at least one review for release-critical changes.

Document any owner-only exceptions.

## Phase 1 exit gate

- [ ] Latest `main` CI is fully green.
- [ ] Every required job executed rather than being skipped due to an unrelated job.
- [ ] Pages is either healthy and correctly classified or removed.
- [ ] Clean clone succeeds without gitlink warnings.
- [ ] Branch protection prevents red merges.

---

# PHASE 2 — Repository Hygiene, Architecture Boundaries, and Maintainability

## Objective

Reduce hidden risk caused by duplicate configuration, oversized modules, unreachable code, placeholder wrappers, and mixed production/experimental surfaces.

## P02-T01 — Create a complete code and route inventory

Generate inventories for:

- server routes;
- client routes/panels;
- services;
- providers;
- tools;
- database tables and migrations;
- background processes;
- environment variables;
- external binaries;
- feature flags;
- files above 300 lines.

Commit reproducible inventory scripts under `scripts/release/`.

## P02-T02 — Build a reachability map

For every production candidate module, prove at least one path from:

- server startup;
- route registration;
- UI entry point;
- scheduled/background initialization;
- explicit local integration registration.

Classify unreachable modules as:

- dead code to remove;
- future code to isolate;
- test utility;
- intentionally dormant feature.

## P02-T03 — Remove or isolate legacy and duplicate implementations

Review especially:

- legacy chat routes;
- v1/v2 chat route duplicates;
- old provider adapters;
- alternate orchestrators;
- inactive memory systems;
- inactive automation and RL modules;
- unused UI/core abstractions;
- placeholder advisor files containing only thin exports or stubs.

### Rule

A dormant module may remain only when it is:

- explicitly excluded from production builds or registration;
- documented as experimental;
- not falsely counted as a completed feature;
- maintained by a named future task.

## P02-T04 — Enforce the 300-line source guideline

Create `scripts/release/check-file-size.mjs`.

The script must:

- scan production source files;
- report files above 300 lines;
- compare them to `large-file-register.md`;
- fail CI for new unregistered oversized files;
- allow generated code and migrations through explicit patterns.

Prioritize decomposition of large, high-risk files such as:

- server startup;
- service initialization;
- orchestrators;
- large route modules;
- local-tool services;
- settings/setup modules;
- large React panels;
- provider routing.

Do not split cohesive logic into arbitrary one-function files.

## P02-T05 — Consolidate environment templates

The repository currently has both `.env.example` and `env.example` with inconsistent scope.

### Required outcome

- Keep one canonical `.env.example`.
- Organize variables by deployment mode.
- Mark required, optional, deprecated, and local-only variables.
- Include secure generation instructions, never sample real secrets.
- Add startup validation matching the documentation.
- Remove the duplicate file or convert it to a pointer with no conflicting values.
- Add an automated check ensuring documented variables and schema remain synchronized.

## P02-T06 — Create configuration schemas

Use a typed, centrally validated configuration model.

Requirements:

- fail fast in production;
- redact secret values in errors;
- distinguish hosted, local, test, and development profiles;
- reject wildcard production CORS when credentials are enabled;
- reject weak secrets;
- reject hosted-mode local execution;
- validate URL schemes and ports;
- warn on deprecated variables;
- expose a sanitized diagnostic summary.

## P02-T07 — Normalize documentation and generated artifacts

- Remove stale screenshots and obsolete setup paths.
- Ensure commands work from a clean clone.
- Mark OS-specific steps.
- Document optional native dependencies such as FFmpeg, Sharp, OCR, or desktop tools.
- Add a docs link checker.
- Add a stale-document review date and owner to release-critical docs.

## Phase 2 exit gate

- [ ] Every production module is reachable and classified.
- [ ] No duplicate environment source of truth remains.
- [ ] New oversized source files fail CI unless registered.
- [ ] Legacy/experimental code cannot silently enter production routes.
- [ ] Clean setup documentation is accurate.

---

# PHASE 3 — CI/CD and Verification Gates That Cannot Produce False Confidence

## Objective

Turn CI into an enforcement system that verifies the actual release rather than only selected code paths.

## P03-T01 — Split and harden CI jobs

Create separate jobs for:

1. repository integrity;
2. dependency installation and lockfile verification;
3. server type-check;
4. client type-check;
5. test type-check;
6. server lint;
7. client lint;
8. server unit/integration tests;
9. client unit/component tests;
10. E2E browser tests;
11. accessibility tests;
12. security tests;
13. coverage enforcement;
14. database migration tests;
15. Docker build and container smoke;
16. package smoke;
17. documentation validation;
18. release-evidence validation.

Pin actions by trusted major version or immutable SHA according to repository policy. Test compatibility with currently supported Node LTS versions.

## P03-T02 — Implement meaningful server coverage policy

Do not jump from 38% to an arbitrary global number by writing low-value tests. Use risk-based thresholds.

### Tier A — Critical controls

Target at least:

- 90% line coverage;
- 85% branch coverage.

Applies to:

- authentication and RBAC;
- CSRF;
- CORS/security headers;
- rate limiting;
- API-key encryption and secret handling;
- path validation;
- upload validation;
- local command policy and execution;
- webhook URL validation;
- database read-only guardrails;
- audit redaction;
- deployment/config validation.

### Tier B — Production-supported routes and services

Target at least:

- 80% line coverage;
- 70% branch coverage.

### Tier C — Global production source

Raise thresholds in controlled steps without regression:

1. baseline plus no-regression enforcement;
2. 55% lines / 45% branches;
3. 65% lines / 55% branches;
4. final target 75% lines / 65% branches.

Experimental code excluded from production coverage must also be excluded from the production build/manifest, not simply hidden from reports.

## P03-T03 — Implement client coverage thresholds

Require coverage for:

- production components;
- API clients;
- mode routing;
- authentication states;
- dangerous-action confirmation;
- file/audio/Sprite Lab/local-tool workflows;
- accessibility and error paths.

Set final minimums appropriate to the client, with no critical workflow below 80% line coverage.

## P03-T04 — Replace fake accessibility testing

Add:

- automated Axe checks for major rendered panels;
- Playwright accessibility scans for complete workflows;
- keyboard-only E2E tests;
- focus restoration tests;
- accessible live-region tests for async results;
- color contrast scanning where tooling supports it;
- manual screen-reader checklist.

Recommended scripts:

```json
{
  "test:a11y:unit": "vitest run --config ...",
  "test:a11y:e2e": "playwright test --project=accessibility",
  "test:a11y": "npm run test:a11y:unit && npm run test:a11y:e2e"
}
```

TypeScript checks must retain their own script and must not be labeled accessibility testing.

## P03-T05 — Add real browser E2E testing

Use Playwright or an equivalent browser runner against a built server.

Minimum workflows:

- clean setup/login;
- chat and streaming response;
- conversation reload;
- mode switching;
- unauthorized/forbidden behavior;
- settings update;
- file load into chat;
- audio preview;
- Knowledge Online approval;
- local-tool plan/approve/run in a safe test harness;
- Sprite Lab internal workflow;
- provider outage/degraded state;
- logout/session expiration;
- mobile viewport smoke.

Mock external providers only at a controlled boundary. At least one staging canary must use real configured providers.

## P03-T06 — Add dependency and supply-chain gates

Add:

- production dependency audit;
- lockfile integrity check;
- secret scanning;
- software bill of materials generation;
- license inventory;
- static security scanning;
- dependency review on pull requests;
- container image scanning;
- provenance/attestation for release artifacts where practical.

Policy:

- zero critical/high production vulnerabilities;
- no unreviewed moderate production vulnerabilities;
- no disallowed licenses;
- no unpinned remote install scripts in release workflows.

## P03-T07 — Add migration CI

CI must test:

- empty-database migration;
- upgrade from the previous released schema;
- repeated migration safety;
- rollback or documented forward-fix strategy;
- SQLite local mode;
- PostgreSQL production mode;
- pgvector when configured;
- data-preservation fixtures.

## P03-T08 — Add container and package smoke tests

The smoke test must:

1. build the server and client;
2. build the production image;
3. start dependencies in an isolated network;
4. run migrations;
5. wait for readiness;
6. call health and representative authenticated endpoints;
7. verify static client serving;
8. restart the container;
9. verify persistence;
10. stop cleanly.

## Phase 3 exit gate

- [ ] Every critical workflow has an appropriate test layer.
- [ ] Accessibility tests test accessibility.
- [ ] Coverage cannot fall below risk-based thresholds.
- [ ] Docker and package smoke run on every release candidate.
- [ ] Dependency, secret, license, and image scans pass.
- [ ] PostgreSQL migration tests are no longer skipped in release CI.

---

# PHASE 4 — Security Hardening and Abuse Resistance

## Objective

Harden the application’s unusually broad attack surface before any untrusted user can access it.

## P04-T01 — Produce a complete threat model

Create threat models for:

- public chat;
- authentication/session handling;
- settings and provider credentials;
- file browsing;
- uploads and document ingestion;
- audio/image/video processing;
- RAG and online ingestion;
- webhooks;
- local tools and Sprite Lab;
- code patch/verify workflows;
- database question agent;
- admin and logs;
- FL Studio/MCP bridges;
- SEC and GIS external requests.

Use STRIDE or an equivalent structured method.

For every threat, record:

- asset;
- trust boundary;
- attacker capability;
- abuse case;
- current control;
- missing control;
- test;
- residual risk;
- owner.

## P04-T02 — Harden authentication and session policy

Verify and implement:

- strong JWT secret or asymmetric signing decision;
- token issuer, audience, expiration, and clock-skew checks;
- refresh/session revocation strategy if persistent login exists;
- role matrix for user, developer, admin, and service identities;
- authorization on every privileged route;
- CSRF for browser-originated state changes where applicable;
- secure cookie attributes if cookies are used;
- brute-force and credential-stuffing limits;
- safe logout and token invalidation;
- no privilege derived from client-supplied role fields.

## P04-T03 — Formalize route authorization

Generate a machine-readable authorization manifest.

For every route, specify:

- public/authenticated/admin/developer;
- hosted/local availability;
- CSRF requirement;
- rate-limit class;
- body-size limit;
- audit requirement;
- data ownership rule.

CI must fail when a new route is registered without policy metadata.

## P04-T04 — Upgrade and harden uploads

- Upgrade Multer to a maintained version or replace it.
- Verify MIME using content signatures, not only filename or browser type.
- Enforce file count, per-file size, total request size, decoded image pixel count, audio/video duration, archive expansion, and document page limits.
- Use randomized server-side names.
- Store outside executable/static directories.
- Block path traversal and special device paths.
- Quarantine until validation completes.
- Strip dangerous metadata where appropriate.
- Clean temporary files after success, failure, timeout, and process interruption.
- Add malware scanning if public uploads are supported.
- Prevent parser requests from reaching internal network resources.

## P04-T05 — Harden file browsing and workspace access

- Canonicalize paths before authorization.
- Enforce approved roots.
- Resolve symlinks and junctions safely.
- Block parent traversal, UNC abuse, alternate data streams where relevant, and device paths.
- Enforce per-user workspace ownership.
- Add pagination and resource caps.
- Redact sensitive filenames and paths from non-developer users.
- Test Windows and Linux path semantics.

## P04-T06 — Harden local command execution

Local execution must be treated as remote-code-execution risk.

Required controls:

- unavailable in hosted mode;
- developer role required;
- explicit plan, review, approval, and execution stages;
- executable allowlist;
- argument allowlist per executable;
- no shell interpolation;
- no chained commands;
- fixed working roots;
- environment allowlist;
- timeout;
- output-size limit;
- child-process tree termination;
- concurrency cap;
- cancellation;
- resource limits where the OS supports them;
- complete audit record;
- approval bound to exact command hash;
- approval invalidated when command or input changes;
- output downloads confined to the run directory.

Test hostile quoting, environment expansion, path tricks, symlinks, long arguments, output floods, process spawning, cancellation races, and restart recovery.

## P04-T07 — Harden SSRF and outbound requests

Apply one outbound-request policy to:

- webhooks;
- online knowledge ingestion;
- URL imports;
- SEC access;
- GIS providers;
- external model endpoints;
- MCP endpoints where applicable.

Controls:

- HTTPS-only in production except explicitly approved local endpoints;
- DNS resolution and re-resolution protection;
- block loopback, link-local, metadata, private-network, and special-use ranges unless explicitly allowlisted;
- redirect limits and revalidation;
- response-size and timeout limits;
- content-type validation;
- user-agent identification where required;
- no credential forwarding to arbitrary hosts.

## P04-T08 — Harden Redis and rate limiting

Current Compose behavior must not publish Redis publicly by default.

Required production configuration:

- private container/network access;
- authentication or managed-service identity;
- TLS when crossing hosts;
- connection timeout and retry policy;
- fail-closed policy for high-risk routes;
- documented fail-open policy only for low-risk routes;
- separate rate classes;
- user, token, IP, and route dimensions;
- protection against spoofed proxy headers;
- test of shared limits across multiple app instances.

## P04-T09 — Security headers and browser policy

Implement and verify:

- Content Security Policy;
- HSTS when HTTPS is active;
- `X-Content-Type-Options`;
- frame-ancestor policy;
- referrer policy;
- permissions policy;
- safe cache control for private responses;
- cross-origin resource policy as appropriate;
- CORS allowlist with credentials behavior tested;
- trusted proxy configuration matched to deployment.

## P04-T10 — Secrets and API-key lifecycle

- Encrypt provider secrets at rest with a dedicated key-encryption secret.
- Support rotation.
- Never export plaintext keys.
- Never return full keys after storage.
- Redact from logs, errors, telemetry, and support bundles.
- Separate application JWT secrets from API-key encryption secrets.
- Define local development secret handling.
- Add a secret-store migration path.
- Add compromised-secret response procedure.

## P04-T11 — Audit logging

Audit at minimum:

- login and auth failures;
- role changes;
- settings and provider changes;
- API-key create/update/delete;
- file read/download;
- plan/patch/verify actions;
- local-tool planning, approval, execution, cancellation, and output download;
- online ingest approval;
- admin operations;
- export/import;
- webhook changes;
- destructive data actions.

Audit records must be append-oriented, timestamped, correlated, redacted, and protected from ordinary user modification.

## P04-T12 — Independent security review

Before final release:

- run automated scanning;
- perform a manual secure-code review of Tier A controls;
- perform authenticated and unauthenticated API abuse testing;
- test path traversal, SSRF, command injection, upload bombs, auth bypass, IDOR, CSRF, rate-limit bypass, secret leakage, and log injection;
- record findings and remediation evidence.

## Phase 4 exit gate

- [ ] Threat model covers every production trust boundary.
- [ ] All Tier A controls meet test thresholds.
- [ ] No critical/high vulnerability remains.
- [ ] Local execution cannot be reached in hosted mode.
- [ ] Redis is private by default.
- [ ] Upload, SSRF, path, auth, and command-abuse tests pass.
- [ ] Independent security findings are closed or formally accepted.

---

# PHASE 5 — Database, Persistence, Migration, Backup, and Recovery

## Objective

Prove that application data survives upgrades, failures, restarts, and operator mistakes.

## P05-T01 — Select and document the production database

Recommended boundary:

- SQLite for local single-user mode.
- PostgreSQL for hosted production mode.
- pgvector only when vector search requires it and migrations are verified.

Document unsupported combinations.

## P05-T02 — Centralize migration management

Requirements:

- monotonic migration IDs;
- migration history table;
- transaction use where supported;
- precondition checks;
- idempotent startup behavior;
- explicit failure state;
- no silent schema mutation outside migrations;
- previous-release upgrade fixtures;
- migration documentation.

## P05-T03 — Test PostgreSQL as a first-class target

Add CI services or an isolated test container.

Test:

- full schema creation;
- pgvector extension behavior;
- placeholder translation;
- foreign keys and indexes;
- transactions;
- JSON types;
- timestamp handling;
- concurrent writes;
- pagination consistency;
- connection pool exhaustion;
- interrupted migration recovery.

## P05-T04 — Enforce user ownership and data isolation

For every durable entity, define ownership:

- conversations;
- memories;
- uploaded files;
- plans;
- projects;
- prompt packs;
- provider settings;
- local-tool runs;
- exports;
- map sessions;
- SEC jobs;
- knowledge documents.

Add IDOR tests proving one user cannot read, update, delete, export, or infer another user’s data.

## P05-T05 — Transaction and consistency review

Review multi-step operations such as:

- session creation plus message insertion;
- document ingest plus chunks plus embeddings plus entities;
- SEC queue and filing persistence;
- API-key update;
- local-tool run state transitions;
- project branching and export;
- deletion and redaction workflows.

Use transactions or compensating actions so partial failure is recoverable.

## P05-T06 — Backup implementation

Define:

- database backup frequency;
- retention;
- encryption;
- storage location;
- access controls;
- Redis persistence requirements if any state is non-reconstructable;
- uploaded artifact backup policy;
- local-mode backup/export path.

Automate backup verification.

## P05-T07 — Restore drill

Perform and record:

1. deploy a production-like environment;
2. create representative data;
3. take backup;
4. destroy the active database and artifact store;
5. restore into a clean environment;
6. run migrations;
7. verify counts, ownership, files, embeddings, and application workflows;
8. record recovery time and data loss window.

A backup that has not been restored successfully is not considered a valid backup.

## P05-T08 — Data retention, deletion, and export

Implement and verify:

- account data export;
- conversation deletion;
- memory deletion/redaction;
- uploaded-file deletion;
- log/audit retention boundaries;
- provider-key deletion;
- temporary-file expiration;
- orphan cleanup;
- deletion across indexes and embeddings;
- legal hold or retention exceptions if applicable.

## Phase 5 exit gate

- [ ] PostgreSQL release migrations pass.
- [ ] Upgrade from previous release preserves data.
- [ ] Ownership isolation tests pass.
- [ ] Backup is automated.
- [ ] Restore drill succeeds.
- [ ] Retention/export/deletion behavior is documented and tested.

---

# PHASE 6 — AI Provider, Routing, RAG, Safety, and Evaluation Reliability

## Objective

Make AI behavior measurable, bounded, explainable, and resilient across provider failures.

## P06-T01 — Declare supported providers and models

For each production provider, document:

- authentication method;
- endpoint configuration;
- chat support;
- streaming support;
- tool support;
- vision support;
- embedding support;
- context limit;
- timeout;
- retry policy;
- cost accounting;
- privacy implications;
- local/hosted availability.

Remove unsupported provider claims from the UI.

## P06-T02 — Provider contract tests

Build a shared adapter contract suite covering:

- normal response;
- streaming response;
- malformed response;
- authentication failure;
- rate limit;
- timeout;
- cancellation;
- connection failure;
- empty response;
- unsupported capability;
- token/cost metadata;
- retryable versus terminal errors.

Run the same suite against every adapter.

## P06-T03 — Real provider canary tests

Use protected staging secrets to run a small, non-destructive canary against each production provider.

Canaries must be:

- cost bounded;
- opt-in for pull requests if expensive;
- mandatory before release;
- sanitized;
- recorded as release evidence.

Ollama must also be tested against the documented local installation and model.

## P06-T04 — Timeout, retry, circuit breaker, and cancellation

- Apply explicit connect and total timeouts.
- Retry only safe, retryable failures.
- Add jitter and maximum attempts.
- Use circuit breaking for failing dependencies.
- Propagate client cancellation.
- Stop downstream work when the request is abandoned.
- Surface degraded/fallback behavior to the user.
- Never report a fallback/template result as if it came from the requested model.

## P06-T05 — Token, context, and cost controls

- Enforce context budgets.
- Bound retrieved chunks.
- Bound output tokens.
- Record estimated and actual provider usage when available.
- Enforce per-request and per-user cost ceilings.
- Prevent recursive agent/tool loops.
- Add maximum tool calls and orchestration depth.
- Expose useful quota errors.

## P06-T06 — RAG production hardening

Verify:

- deterministic source IDs;
- chunk persistence;
- embedding versioning;
- re-embedding migration;
- hybrid retrieval;
- source quality filters;
- prompt-injection scanning;
- provenance;
- citation anchors;
- deleted-source removal;
- stale-source handling;
- user/project access filters;
- no cross-user retrieval;
- no embeddings returned unless explicitly authorized.

## P06-T07 — Grounding and citation release gates

Create a golden evaluation set with:

- answerable questions;
- unanswerable questions;
- conflicting sources;
- stale sources;
- malicious retrieved instructions;
- exact-date questions;
- multi-document synthesis;
- project-isolation cases.

Define measurable thresholds for:

- retrieval recall;
- citation correctness;
- unsupported-claim rate;
- refusal/uncertainty correctness;
- source leakage;
- prompt-injection resistance.

## P06-T08 — Domain and safety evals

Run release evals for production-supported modes, especially:

- coding;
- health;
- legal;
- market/financial;
- security;
- creative copyright boundaries;
- knowledge and historical accuracy;
- local-tool approval behavior.

High-stakes modes must surface limitations and require source-backed behavior where designed.

## P06-T09 — Eval regression enforcement

- Store versioned datasets.
- Store baseline metrics.
- Fail release when a critical metric regresses beyond tolerance.
- Require review for changed prompts, model routing, safety policy, or retrieval scoring.
- Preserve examples of failures, not only aggregate scores.

## Phase 6 exit gate

- [ ] Every production provider passes the adapter contract.
- [ ] Release canaries pass.
- [ ] Timeout, fallback, cancellation, and cost controls are verified.
- [ ] RAG isolation and injection tests pass.
- [ ] Critical eval metrics meet documented thresholds.
- [ ] AI failures are never presented as successful provider output.

---

# PHASE 7 — Feature-by-Feature Production Completion

## Objective

Verify every production-supported feature through its complete vertical slice.

## Standard feature completion checklist

Every task in this phase must verify:

- [ ] UI or documented API entry point.
- [ ] Backend route.
- [ ] Service logic.
- [ ] Authentication and role.
- [ ] Hosted/local availability.
- [ ] Input validation.
- [ ] Rate limit and body limit.
- [ ] Persistence and ownership.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Success state.
- [ ] Validation error state.
- [ ] Unauthorized state.
- [ ] Forbidden state.
- [ ] Dependency-degraded state.
- [ ] Fatal error recovery.
- [ ] Keyboard accessibility.
- [ ] Screen-reader labels/status.
- [ ] Unit tests.
- [ ] Route/service integration tests.
- [ ] Browser E2E test.
- [ ] Manual runtime evidence.
- [ ] Documentation.

## P07-T01 — Core chat and streaming

Verify:

- send and receive;
- streaming and non-streaming;
- stop/cancel;
- retry;
- model/provider display;
- error recovery;
- session persistence;
- context continuation;
- token/cost warnings;
- rate limits;
- degraded provider behavior;
- output safety/provenance indicators.

## P07-T02 — Authentication, setup, and settings

Verify:

- first-run setup;
- admin bootstrap policy;
- login/session expiration;
- role differences;
- provider configuration;
- API-key masked storage;
- CSRF;
- invalid configuration;
- secret rotation;
- import behavior;
- no plaintext export.

## P07-T03 — Conversations and sharing

Verify:

- list;
- open;
- rename if supported;
- delete;
- export;
- share only if production-supported;
- ownership;
- revocation;
- pagination;
- empty state;
- large conversation behavior.

Disable sharing if it lacks a complete authorization and revocation model.

## P07-T04 — Modes and specialist routing

Verify:

- mode selector;
- correct panel scoping;
- backend enforcement, not client-only enforcement;
- explicit Plan/Implement/Debug boundaries;
- low-confidence routing behavior;
- unsupported mode behavior;
- route and UI consistency;
- mode persisted only when intended.

## P07-T05 — Coding workflow

Verify:

- repository inspection before advice;
- plan creation;
- plan persistence;
- patch generation;
- path confinement;
- review;
- verification command allowlist;
- diff preview;
- explicit approval where writes occur;
- failure output;
- no mutation in Plan mode;
- no verification outside Implement/Debug policy.

## P07-T06 — File Explorer

Verify:

- tree/list;
- search;
- pagination;
- metadata;
- safe text preview;
- image preview;
- load into chat;
- unsupported type;
- oversized file;
- symlink/junction behavior;
- ownership and roots;
- Windows paths;
- Linux paths.

## P07-T07 — Audio browser and analysis

Verify:

- discovery;
- metadata;
- waveform;
- preview;
- unsupported codec;
- missing FFmpeg/ffprobe;
- large file;
- corrupt file;
- temporary cleanup;
- load into chat;
- accessible controls.

## P07-T08 — Document, image, and video ingestion

Verify each declared format using real fixture files.

Cover:

- PDF text;
- scanned PDF/OCR if supported;
- DOCX;
- XLSX;
- PPTX;
- text/Markdown/code;
- common images;
- video metadata/frames if supported;
- unsupported format;
- encrypted/corrupt document;
- huge page count;
- decompression/zip bomb defense;
- extracted-content provenance;
- parser dependency outage.

Any format not fully verified must be removed from supported claims.

## P07-T09 — Knowledge Base and RAG UI

Verify:

- ingest;
- source listing;
- progress;
- failure and retry;
- query;
- citations;
- source deletion;
- re-indexing;
- statistics;
- permissions;
- project filtering;
- stale source handling.

## P07-T10 — Knowledge Online approval workflow

Verify:

- local confidence decision;
- online handoff;
- search preview;
- source filtering;
- explicit ingest approval;
- no ingest without approval;
- provenance;
- rollback;
- SSRF policy;
- failure and timeout.

## P07-T11 — Knowledge OS

Verify all production-supported Knowledge OS operations, including:

- summary;
- entities;
- links;
- safe database questions;
- wiki pages;
- private memory;
- governance reports;
- export/import;
- approval flows;
- role protection;
- ownership.

Raw developer functions that lack safe UI or documentation must be developer-only or disabled.

## P07-T12 — Local tools

Verify on a trusted local host:

- available tool list;
- planning;
- exact command display;
- approval;
- approval hash binding;
- start;
- stdout/stderr;
- cancellation;
- timeout;
- process tree cleanup;
- output listing;
- output download;
- run history;
- restart recovery;
- hostile arguments;
- hosted-mode denial.

## P07-T13 — Sprite Lab

Verify:

- internal slicing;
- palette extraction;
- manifest creation;
- sprite sheet export;
- Aseprite adapter;
- Pixelorama behavior;
- expected outputs;
- output browser;
- command copy;
- missing external tool;
- invalid input;
- workspace confinement;
- local-run approval integration.

## P07-T14 — SEC ingestion

Verify with an approved, configured SEC user agent:

- status;
- ticker/CIK resolution;
- queue creation;
- queue processing;
- pacing;
- stale recovery;
- filing download;
- parsing;
- facts;
- storage;
- retries;
- malformed response;
- live service rate policy;
- historical data retrieval.

Do not call mocked SEC tests proof of live SEC readiness.

## P07-T15 — Gaming and game-development features

Verify:

- panel appears only in intended mode;
- playbook listing;
- creation;
- engine/asset/prompt shortcuts;
- validation;
- persistence/export if claimed;
- clear distinction between guidance and executable implementation.

## P07-T16 — Creative writing and roleplay

Verify:

- project creation;
- story bible;
- scene drafting;
- revision;
- alternate branches;
- roleplay pause/resume/reset;
- prompt packs;
- export/import;
- privacy controls;
- deletion/redaction;
- provider degradation;
- long-form continuity;
- living-author and protected-world policy.

## P07-T17 — Music, FL Studio, and desktop bridges

Separate clearly:

- advisory music tools;
- dry-run FL Studio planning;
- live MCP control;
- local-only capabilities.

Verify:

- disconnected behavior;
- dry-run default;
- confirmation modes;
- command safety;
- connected canary;
- disconnect;
- transport/mixer/chord actions supported by policy;
- cancellation and audit;
- hosted-mode denial.

## P07-T18 — GIS

Verify:

- geocoding;
- routes;
- layer import;
- layer queries;
- analysis;
- session persistence;
- provider timeout;
- rate policy;
- coordinate validation;
- privacy redaction;
- external-request policy;
- map artifact display.

## P07-T19 — Administration and exports

Verify:

- health summary;
- logs with redaction;
- cache clearing;
- export boundaries;
- audit access;
- role enforcement;
- path safety;
- pagination;
- no secret or private-content leakage.

## P07-T20 — Webhooks, automation, notifications, and real-time features

For each module, choose:

- fully complete and production-supported;
- preview with explicit limitations;
- local-only experimental;
- disabled/removed.

Do not leave registered but unverified high-risk routes.

If supported, verify:

- authentication;
- SSRF defense;
- signing;
- retries;
- replay prevention;
- idempotency;
- delivery logs;
- opt-out;
- rate limits;
- connection cleanup;
- restart behavior.

## Phase 7 exit gate

- [ ] Every manifest feature has passed its vertical-slice checklist.
- [ ] Every unsupported feature is disabled or removed from production registration and UI.
- [ ] Manual runtime evidence exists for every supported user workflow.
- [ ] No visible production feature is only a backend route or raw JSON panel.

---

# PHASE 8 — UX, Accessibility, Onboarding, and Product Polish

## Objective

Turn the implemented system into a coherent product that users can understand and operate safely.

## P08-T01 — Information architecture review

- Group features by user goal.
- Hide developer/admin tools from ordinary users.
- Scope specialist panels to relevant modes.
- Remove always-on panels that create noise.
- Provide consistent navigation and breadcrumbs where needed.
- Avoid presenting experimental modules as core product functions.

## P08-T02 — Unified state design

Every async feature must use a consistent pattern for:

- idle;
- loading;
- progress;
- partial result;
- success;
- empty;
- warning;
- degraded dependency;
- validation error;
- authorization error;
- retryable error;
- terminal error.

Errors must include a useful next action without exposing internals.

## P08-T03 — Dangerous-action UX

Require explicit, comprehensible confirmation for:

- local command execution;
- patch application;
- knowledge ingestion;
- destructive deletion;
- data import overwrite;
- cache clearing if impactful;
- provider-key replacement;
- external desktop control;
- webhook activation.

Confirmation must describe exact scope and cannot be hidden in generic consent.

## P08-T04 — First-run onboarding

A clean installation must guide the user through:

- deployment mode;
- account/admin setup;
- provider choice;
- Ollama setup when selected;
- database state;
- optional Redis;
- optional FFmpeg/OCR/local tools;
- security requirements;
- health verification;
- first chat.

No user should need to inspect source code to finish supported setup.

## P08-T05 — WCAG 2.2 AA implementation

Verify:

- semantic landmarks;
- headings;
- form labels and descriptions;
- error associations;
- keyboard-only operation;
- visible focus;
- focus order;
- modal focus trap and restoration;
- accessible names for icon buttons;
- live announcements for streaming/progress/status;
- contrast;
- 200% zoom;
- 320 CSS-pixel reflow where applicable;
- reduced motion;
- no keyboard traps;
- timeout warnings where relevant;
- audio alternatives/controls.

## P08-T06 — Manual assistive-technology test

Run at minimum:

- NVDA with Chrome or Firefox on Windows;
- keyboard-only full workflow;
- browser zoom/reflow;
- high-contrast or forced-colors mode;
- reduced motion.

Record issues and evidence.

## P08-T07 — Responsive and browser matrix

Define and test supported browsers and viewports.

Minimum recommended desktop browsers:

- current Chrome;
- current Edge;
- current Firefox.

If mobile browser support is claimed, test it explicitly. Otherwise document desktop-first support honestly.

## P08-T08 — Product copy and diagnostics

- Replace implementation terminology with user terminology where appropriate.
- Explain hosted versus local-only capabilities.
- Explain why a feature is unavailable.
- Provide copyable diagnostic IDs, not raw stack traces.
- Add a sanitized support bundle export.
- Keep version and commit visible in diagnostics.

## Phase 8 exit gate

- [ ] WCAG automated and manual checks pass.
- [ ] All critical workflows are keyboard operable.
- [ ] First-run setup succeeds without source inspection.
- [ ] Dangerous actions communicate exact consequences.
- [ ] Supported browser/viewport matrix passes.

---

# PHASE 9 — Performance, Capacity, Resilience, and Failure Testing

## Objective

Prove the system remains usable and safe under realistic load and dependency failure.

## P09-T01 — Define service objectives

Define measurable targets for:

- availability;
- readiness time;
- chat first-token latency;
- non-streaming response latency;
- API error rate;
- upload/ingest completion;
- queue delay;
- database query latency;
- memory usage;
- local-tool concurrency;
- recovery time objective;
- recovery point objective.

Separate application latency from external provider latency.

## P09-T02 — Build representative load profiles

Include:

- anonymous/public health traffic;
- authenticated chat;
- streaming chat;
- conversation reads;
- RAG queries;
- document uploads;
- knowledge ingestion;
- SEC queue processing;
- admin/log access;
- multiple app instances sharing Redis and PostgreSQL.

## P09-T03 — Load and soak tests

Test:

- expected steady load;
- burst load;
- sustained soak;
- large conversation histories;
- large knowledge bases;
- concurrent uploads;
- slow clients;
- abandoned streams;
- queue backlog;
- connection pool pressure.

Monitor memory, CPU, file descriptors, event-loop delay, database connections, and Redis behavior.

## P09-T04 — Resource and abuse caps

Implement and test:

- request body limits;
- upload limits;
- decoded media limits;
- result pagination;
- search limits;
- maximum conversation context;
- maximum retrieved chunks;
- maximum tool calls;
- maximum local processes;
- maximum logs returned;
- maximum export size;
- background queue concurrency.

## P09-T05 — Dependency failure matrix

Test failure of:

- LLM provider;
- Ollama;
- PostgreSQL;
- SQLite lock/disk error;
- Redis;
- FFmpeg/ffprobe;
- OCR/conversion binary;
- SEC;
- GIS provider;
- webhook target;
- MCP/FL Studio;
- file system full or read-only;
- network timeout;
- malformed dependency response.

For each, verify:

- bounded timeout;
- correct HTTP/UI error;
- no corrupt state;
- no secret leak;
- recovery after dependency returns;
- appropriate health status.

## P09-T06 — Startup and shutdown reliability

- Verify startup dependency ordering.
- Keep liveness separate from readiness.
- Do not accept traffic before required migrations and services are ready.
- Handle SIGTERM/SIGINT.
- Stop accepting new work.
- complete or safely cancel in-flight work;
- close database/Redis/provider connections;
- terminate child processes;
- clean temporary files;
- preserve queue state.

## P09-T07 — Performance regression gate

Record baseline metrics and fail release when critical performance regresses beyond agreed tolerance without approval.

## Phase 9 exit gate

- [ ] SLOs are defined and measured.
- [ ] Expected and burst load pass.
- [ ] Soak test reveals no unacceptable leak.
- [ ] Dependency failures degrade safely.
- [ ] Startup/shutdown behavior is clean.
- [ ] Capacity limits are documented.

---

# PHASE 10 — Observability, Auditability, and Operational Readiness

## Objective

Ensure operators can detect, diagnose, and recover from failures without exposing user data.

## P10-T01 — Structured logging standard

Every request log should include where appropriate:

- timestamp;
- environment;
- service/version;
- request/correlation ID;
- user ID or stable pseudonymous ID;
- route;
- method;
- status;
- latency;
- dependency status;
- error code;
- audit event ID.

Never log full tokens, provider keys, authorization headers, private file content, or unredacted prompts by default.

## P10-T02 — Metrics

Implement metrics for:

- request count/latency/errors;
- auth failures;
- rate-limit events;
- provider calls/latency/errors/tokens/cost;
- database pool and query health;
- Redis health;
- queue depth/age/failures;
- uploads and ingest;
- RAG retrieval/grounding;
- local-tool runs/cancellations/timeouts;
- process resource usage;
- readiness dependencies.

Avoid unbounded-cardinality labels.

## P10-T03 — Distributed tracing

Trace at least:

- incoming request;
- authentication;
- routing/orchestration;
- retrieval;
- provider call;
- tool call;
- persistence;
- response streaming.

Redact sensitive prompt/content attributes.

## P10-T04 — Health endpoints

Provide distinct endpoints or semantics for:

- liveness;
- readiness;
- detailed authenticated diagnostics.

Readiness must reflect required dependencies and migration state. Optional dependencies should produce a degraded state without necessarily failing liveness.

## P10-T05 — Dashboards and alerts

Create dashboards for:

- service overview;
- provider reliability;
- database/Redis;
- queue/ingestion;
- security/auth;
- local tools;
- resource usage.

Create actionable alerts with:

- severity;
- condition;
- duration;
- owner;
- runbook link;
- suppression guidance.

## P10-T06 — Runbooks

Create runbooks for:

- application not ready;
- database migration failure;
- database saturation;
- Redis outage;
- provider outage/rate limiting;
- high error rate;
- latency spike;
- disk full;
- stuck SEC/local-tool queue;
- leaked or compromised secret;
- suspicious local-tool activity;
- failed deployment;
- restore from backup;
- rollback release.

## P10-T07 — Operational support bundle

Implement a sanitized export containing:

- version/commit;
- environment mode;
- sanitized config summary;
- dependency health;
- recent error codes;
- migration version;
- non-sensitive logs;
- feature manifest state.

It must not include keys, tokens, private documents, raw prompts, or unrestricted paths.

## Phase 10 exit gate

- [ ] Operators can identify the failing subsystem quickly.
- [ ] Alerts link to tested runbooks.
- [ ] Health endpoints reflect actual readiness.
- [ ] Logs and traces are redaction-tested.
- [ ] Support bundle is safe and useful.

---

# PHASE 11 — Production Deployment Engineering

## Objective

Create a secure, repeatable staging and production deployment with demonstrated rollback.

## P11-T01 — Select the production hosting architecture

Document:

- application host;
- PostgreSQL host;
- Redis host;
- artifact/upload storage;
- TLS termination;
- DNS;
- secret manager;
- observability backend;
- backup destinations;
- network boundaries;
- scaling model.

Do not leave the production target as “run Docker somehow.”

## P11-T02 — Harden the Docker image

Use a multi-stage build.

Requirements:

- pinned supported Node base;
- minimal runtime image;
- non-root user;
- production dependencies only;
- no source maps or build secrets unless intentionally retained;
- health check;
- writable directories explicitly defined;
- read-only root filesystem where practical;
- dropped Linux capabilities;
- no Docker socket;
- clean shutdown;
- image labels for version and commit;
- vulnerability scan.

## P11-T03 — Correct Docker Compose defaults

For production-like Compose:

- remove public Redis port exposure;
- use private networks;
- add Redis authentication/TLS or clearly mark local-only configuration;
- add PostgreSQL if Compose is the selected local production simulation;
- define persistent volumes;
- add health checks;
- use dependency health conditions carefully;
- document secrets injection;
- prevent development defaults in production.

Create separate files when necessary:

- `compose.local.yml`
- `compose.staging.yml`
- production deployment manifests appropriate to the selected host.

## P11-T04 — Reverse proxy and TLS

Configure:

- HTTPS;
- certificate renewal;
- websocket/streaming support;
- request and upload limits;
- proxy timeouts compatible with streaming;
- trusted proxy settings;
- security headers;
- redirect HTTP to HTTPS;
- correct client IP handling;
- no direct exposure of internal services.

## P11-T05 — Staging environment

Staging must match production architecture closely enough to verify:

- migrations;
- authentication;
- secrets;
- providers;
- Redis;
- database;
- TLS/proxy;
- metrics/logs/traces;
- backups;
- deployment and rollback.

Do not use mock-only staging for final release sign-off.

## P11-T06 — Automated deployment pipeline

Pipeline stages:

1. verify source and lockfiles;
2. run all CI gates;
3. build versioned artifact/image;
4. generate SBOM and attestations;
5. scan image;
6. deploy to staging;
7. run migrations;
8. run staging smoke/E2E/canaries;
9. require release approval;
10. deploy production;
11. run production smoke;
12. monitor canary window;
13. complete or automatically roll back.

## P11-T07 — Migration and rollback strategy

Define how code and schema changes remain compatible during deployment.

Prefer expand/migrate/contract patterns for breaking schema changes.

Rollback evidence must prove:

- previous image can be restored;
- schema remains compatible or has a safe forward-fix procedure;
- data is preserved;
- queues and local runs recover predictably.

## P11-T08 — Production smoke suite

Against the deployed production candidate, verify safely:

- public health;
- readiness;
- login;
- authenticated chat with a bounded canary;
- conversation persistence;
- provider health;
- RAG canary;
- privileged route denial for ordinary user;
- metrics/log receipt;
- static client load;
- no mixed-content/CORS/CSP failures.

Do not perform destructive local-tool or admin actions in production smoke unless using a dedicated isolated test environment.

## Phase 11 exit gate

- [ ] Staging and production architecture are documented.
- [ ] Container is hardened and scanned.
- [ ] Internal dependencies are not publicly exposed.
- [ ] Deployment is automated.
- [ ] Staging release tests pass.
- [ ] Rollback has been demonstrated.
- [ ] Production smoke passes.

---

# PHASE 12 — Full Manual QA and Release Candidate Certification

## Objective

Prove the assembled application works as a product, not merely as isolated tests.

## P12-T01 — Clean-machine installation

Use a machine or VM with no repository state.

Verify:

1. clone;
2. checkout release candidate;
3. install documented prerequisites;
4. create configuration from canonical example;
5. install dependencies;
6. build;
7. migrate;
8. start;
9. complete first-run onboarding;
10. run core workflows;
11. restart;
12. verify persistence.

Record every undocumented step as a defect.

## P12-T02 — Manual workflow matrix

Execute every production-supported manifest feature using the standard feature checklist.

Record:

- tester;
- environment;
- browser/OS;
- role;
- provider;
- database;
- steps;
- expected result;
- actual result;
- screenshot/video;
- defect link.

## P12-T03 — Cross-configuration matrix

Test supported combinations, not every theoretical combination.

At minimum:

- hosted + PostgreSQL + Redis + one remote provider;
- local + SQLite + Ollama;
- local mode with optional FFmpeg/local tool dependencies;
- degraded mode with unavailable optional dependency;
- supported browsers.

## P12-T04 — Long-running and large-data scenarios

Manual or automated acceptance must include:

- long conversation;
- large knowledge base;
- large but permitted document;
- multiple project contexts;
- queue backlog and recovery;
- provider timeout;
- restart during non-destructive background work;
- restored backup.

## P12-T05 — Security acceptance

Verify final deployed configuration:

- no default/weak secrets;
- no wildcard CORS;
- no public Redis/database;
- secure cookies/headers as applicable;
- role enforcement;
- no debug stack traces;
- no source maps or sensitive files exposed unintentionally;
- upload/local-tool policies active;
- audit logs generated;
- secret redaction.

## P12-T06 — Documentation acceptance

A fresh tester must successfully use:

- README;
- setup guide;
- deployment guide;
- backup/restore guide;
- admin guide;
- local-tools guide;
- troubleshooting guide.

Fix documentation based on observed failures.

## P12-T07 — Release evidence reconciliation

Update:

- master tracker;
- feature manifest;
- release evidence index;
- completion audit;
- changelog;
- known limitations;
- version documentation.

No unresolved `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED`, or uncategorized production item may remain.

## P12-T08 — Final release candidate sign-off

Required sign-off domains:

- engineering;
- security;
- data/migrations;
- QA/accessibility;
- operations;
- product scope;
- documentation.

Each sign-off must cite evidence and commit SHA.

## Phase 12 exit gate

- [ ] Clean-machine installation passes.
- [ ] Full manual workflow matrix passes.
- [ ] Supported configuration matrix passes.
- [ ] Security acceptance passes.
- [ ] Documentation is validated by execution.
- [ ] Final evidence index is complete.
- [ ] All sign-offs target the same release candidate commit.

---

# PHASE 13 — Versioning, Release Packaging, and Launch

## Objective

Publish a controlled release with explicit rollback criteria and post-launch verification.

## P13-T01 — Version and tag

- Select semantic version.
- Update package versions consistently.
- Generate changelog from verified tasks.
- Create signed or protected annotated tag.
- Record source commit, image digest, SBOM, migration version, and evidence index.

## P13-T02 — Release artifacts

Publish as applicable:

- container image;
- checksums;
- SBOM;
- provenance/attestation;
- release notes;
- configuration migration notes;
- database migration notes;
- known limitations;
- backup requirement;
- rollback instructions.

## P13-T03 — Controlled rollout

Use a staged rollout:

1. internal/local acceptance;
2. staging;
3. limited beta/canary;
4. general availability.

Define rollback triggers before rollout, such as:

- elevated 5xx rate;
- authentication failure spike;
- data corruption;
- migration failure;
- provider runaway cost;
- unsafe local-tool behavior;
- severe security finding;
- sustained latency breach.

## P13-T04 — Post-deploy verification

After production deployment:

- run smoke suite;
- confirm dashboards;
- confirm alerts;
- confirm backups;
- inspect errors and auth failures;
- verify provider cost and token metrics;
- verify no unexpected outbound connections;
- verify no secret leakage;
- confirm release version in UI/API.

## P13-T05 — Initial operating review

Review after the first operational window:

- incidents;
- errors;
- latency;
- provider reliability;
- cost;
- user feedback;
- security events;
- queue health;
- backup success;
- capacity.

Convert findings into the next milestone without retroactively changing the released evidence.

## Phase 13 exit gate

- [ ] Release is tagged and reproducible.
- [ ] Artifacts and SBOM are published.
- [ ] Controlled rollout succeeds.
- [ ] Post-deploy checks pass.
- [ ] Initial operating review is recorded.

---

# PHASE 14 — Post-Release Maintenance Baseline

## Objective

Prevent the project from returning to a false-complete or unmaintained state immediately after release.

## P14-T01 — Dependency update policy

Define:

- automated update cadence;
- security patch response;
- Node LTS upgrade policy;
- provider SDK review;
- native dependency review;
- lockfile update and test requirements.

## P14-T02 — Vulnerability response SLA

Define response targets by severity and exposure. Include emergency secret rotation and release revocation procedures.

## P14-T03 — Regression and eval maintenance

- Add every escaped defect to an automated regression test where feasible.
- Review AI eval datasets for drift.
- Re-run provider canaries before releases.
- Track model changes and behavior changes.

## P14-T04 — Quarterly restore and incident drills

Schedule and document:

- backup restore;
- failed deployment rollback;
- provider outage;
- compromised key;
- Redis/database failure;
- suspicious local-tool execution.

## P14-T05 — Feature lifecycle policy

Every new feature must enter as:

- preview;
- local-only experimental;
- or production supported after completing the vertical-slice checklist.

No feature may become production-supported only because code was merged.

---

## 7. Cross-Phase Priority Order

Work must follow this dependency order unless a task explicitly has no dependency.

### Blocking sequence

1. Phase 0 — scope and truth.
2. Phase 1 — green and integral repository.
3. Phase 2 — architecture and configuration cleanup.
4. Phase 3 — trustworthy gates.
5. Phase 4 — security hardening.
6. Phase 5 — persistence and recovery.
7. Phase 6 — AI/provider reliability.
8. Phase 7 — vertical feature completion.
9. Phase 8 — UX/accessibility.
10. Phase 9 — resilience/performance.
11. Phase 10 — observability/operations.
12. Phase 11 — deployment.
13. Phase 12 — release candidate certification.
14. Phase 13 — launch.
15. Phase 14 — maintenance baseline.

### Work that can run in parallel after Phase 3

- security test expansion;
- PostgreSQL integration tests;
- provider contract tests;
- accessibility implementation;
- observability instrumentation;
- feature vertical-slice verification.

Parallel work must still use separate branches, task IDs, threads, and handoffs.

---

## 8. Critical Risk Register

| ID | Risk | Severity | Required control |
|---|---|---:|---|
| R-001 | Local command execution escape | Critical | Hosted-mode disablement, exact approval binding, allowlists, no shell, audit, hostile tests |
| R-002 | File/path traversal or cross-user access | Critical | Canonical roots, symlink checks, ownership, Windows/Linux tests |
| R-003 | Secret leakage | Critical | Encryption, redaction tests, secret manager, no plaintext export |
| R-004 | Authentication/RBAC bypass | Critical | Route manifest, default deny, negative tests, IDOR suite |
| R-005 | SSRF through webhooks/ingestion/providers | Critical | Central outbound policy, DNS/IP checks, redirect revalidation |
| R-006 | Upload/parser exploitation | High | Maintained upload library, content sniffing, resource caps, quarantine, cleanup |
| R-007 | Data loss during migration | High | Versioned migrations, upgrade fixtures, backup/restore drill |
| R-008 | Publicly exposed Redis | High | Private network, authentication/TLS, no host publish |
| R-009 | False-green CI | High | Independent jobs, coverage tiers, real a11y and browser E2E |
| R-010 | Provider outage or runaway cost | High | Timeouts, circuit breakers, cancellation, budgets, metrics |
| R-011 | RAG prompt injection/cross-user retrieval | High | Injection scan, project/user filters, golden evals |
| R-012 | Experimental modules treated as supported | High | Production feature manifest and registration gates |
| R-013 | Low observability during incident | High | Correlation IDs, metrics, traces, alerts, runbooks |
| R-014 | Static Pages demo mistaken for full product | Medium | Explicit classification, disabled unsupported controls, separate API |
| R-015 | Unsupported native dependency failure | Medium | Health diagnostics, graceful degradation, documented prerequisites |

---

## 9. Required Verification Commands

The final release pipeline must include equivalent commands, adjusted only when scripts are deliberately renamed.

### Repository and installation

```bash
git status --short
git fsck --full
git submodule status
npm ci
npm --prefix client ci
```

### Type checking and lint

```bash
npm run type-check:server
npm run type-check:tests
npm run type-check:client
npm run lint:server
npm run lint:client
```

### Tests

```bash
npm run test:security -- --runInBand
npm run test:routes -- --runInBand
npm run test:services -- --runInBand
npm run test:e2e -- --runInBand
npm run test:coverage -- --runInBand
npm --prefix client test
npm --prefix client run test:coverage
npm --prefix client run test:a11y
```

### Build and package

```bash
npm run build
npm run smoke:package
```

### Additional required scripts to implement

```bash
npm run test:postgres
npm run test:migrations
npm run test:browser
npm run test:a11y
npm run test:load:smoke
npm run test:security:integration
npm run check:feature-manifest
npm run check:route-policy
npm run check:file-size
npm run check:docs
npm run check:secrets
npm run check:licenses
npm run build:container
npm run smoke:container
npm run release:evidence
```

### Production-like runtime

```bash
docker compose -f compose.staging.yml build
docker compose -f compose.staging.yml up -d
# wait for readiness
# run migrations and smoke/E2E
# restart application
# verify persistence
docker compose -f compose.staging.yml down
```

Exact environment-specific commands must be recorded in the deployment ADR and evidence bundle.

---

## 10. Required Manual QA Matrix

The release evidence must include at least these combinations.

| Dimension | Required coverage |
|---|---|
| Mode | Hosted production-like, local desktop |
| Database | PostgreSQL hosted, SQLite local |
| Provider | At least one remote supported provider, Ollama local |
| Browser | Chrome, Edge, Firefox |
| Role | anonymous where allowed, user, developer, admin |
| Accessibility | keyboard, NVDA, zoom/reflow, reduced motion |
| Dependency state | healthy, provider unavailable, Redis unavailable, optional binary unavailable |
| Data state | new install, populated, upgraded, restored backup |
| Viewport | standard desktop, narrow desktop/tablet if supported |

Every unsupported combination must be documented rather than silently ignored.

---

## 11. Final Release Sign-Off Matrix

| Domain | Required evidence | Status |
|---|---|---|
| Repository integrity | clean clone, `git fsck`, no broken gitlinks | NOT_STARTED |
| CI | all required checks green on release commit | NOT_STARTED |
| Security | threat model, scans, abuse tests, closed findings | NOT_STARTED |
| Dependencies | audit, SBOM, license review, image scan | NOT_STARTED |
| Data | migrations, upgrade, backup, restore, ownership tests | NOT_STARTED |
| AI/providers | contract tests, canaries, eval thresholds | NOT_STARTED |
| Features | manifest with vertical-slice evidence | NOT_STARTED |
| Accessibility | automated + manual WCAG 2.2 AA evidence | NOT_STARTED |
| Performance | load, soak, limits, SLO report | NOT_STARTED |
| Resilience | dependency-failure and restart matrix | NOT_STARTED |
| Observability | logs, metrics, traces, alerts, runbooks | NOT_STARTED |
| Deployment | staging, production smoke, rollback proof | NOT_STARTED |
| Documentation | clean tester follows all release docs | NOT_STARTED |
| Product scope | no uncategorized or falsely supported feature | NOT_STARTED |

No release tag may be created while any row remains `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, or `IMPLEMENTED_NOT_VERIFIED`.

---

## 12. Definition of Done for an Individual Task

A task is done only when all applicable items are checked.

### Implementation

- [ ] The requested behavior is implemented completely.
- [ ] No placeholder, TODO, mock production path, or dead branch substitutes for behavior.
- [ ] Files remain under 300 lines where reasonably possible.
- [ ] Configuration and migrations are backward-safe.
- [ ] Production/preview/local-only status is updated.

### Verification

- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Type checking passes.
- [ ] Lint passes with no new warnings.
- [ ] Security tests pass.
- [ ] Runtime verification passes where required.
- [ ] Negative and failure cases are tested.
- [ ] No unrelated check was weakened.

### Evidence and handoff

- [ ] Evidence directory exists.
- [ ] Commands and exit codes are recorded.
- [ ] Screenshots/artifacts are included where relevant.
- [ ] Exact commit SHA is recorded.
- [ ] Master tracker is updated.
- [ ] Feature manifest is updated.
- [ ] Current and archived handoffs are written.
- [ ] Next-thread prompt names exactly one task.

---

## 13. Codex New-Thread Start Prompt Template

Use this template for each task.

```text
You are working on repository DocDamage/chatbot.

AUTHORIZED TASK ONLY:
<TASK-ID> — <TASK TITLE>

Read these files before making changes:
1. docs/implementation/handoffs/CURRENT_HANDOFF.md
2. docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
3. docs/implementation/PRODUCTION_FEATURE_MANIFEST.md
4. the task issue and all files directly relevant to this task

Rules:
- Work only on the authorized task ID.
- Inspect the current repository and reproduce the issue before editing.
- Do not trust old completion claims without current evidence.
- Do not weaken, skip, delete, or bypass tests or release gates.
- Keep source files below 300 lines where reasonably possible. Register and justify exceptions.
- Do not add placeholders, TODO implementations, mock production behavior, or silent fallbacks.
- Preserve user data and compatibility; use migrations for schema changes.
- Never commit secrets or machine-specific paths.
- Run every verification command required by the task.
- Record exact commands, exit codes, results, and commit SHA.
- Update the master tracker and feature manifest when applicable.
- Create the task evidence bundle.
- Replace docs/implementation/handoffs/CURRENT_HANDOFF.md and archive a task-specific handoff.
- End the thread after this task is verified or formally blocked.
- Do not begin the next task in this thread.

Before editing, report:
1. the current branch and commit;
2. the files you inspected;
3. the reproduced baseline behavior;
4. the precise implementation plan for this task;
5. the verification commands you will run.

Completion is not accepted from a narrative claim. It requires committed evidence.
```

---

## 14. Codex Handoff Template

```markdown
# <TASK-ID> Handoff

## Repository state

- Repository: DocDamage/chatbot
- Branch:
- Commit:
- Parent commit:
- Date:

## Authorized task

- Task ID:
- Title:
- Status: VERIFIED | BLOCKED | IMPLEMENTED_NOT_VERIFIED

## Scope completed

- ...

## Files changed

- `path`: purpose

## Behavior implemented

- ...

## Tests added or changed

- ...

## Verification commands and results

| Command | Exit code | Result |
|---|---:|---|
| `...` | 0 | Passed |

## Runtime QA

- Environment:
- Steps:
- Result:
- Evidence:

## Security and data review

- ...

## Known limitations or blockers

- None, or list exact items.

## Evidence bundle

- `docs/implementation/evidence/...`

## Next authorized task

- `<NEXT-TASK-ID> — <TITLE>`

## NEW THREAD START PROMPT

<Insert the complete one-task prompt here.>

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
```

---

## 15. Prohibited Release Shortcuts

The project is not 100% complete if any of these are used:

- calling a successful build a production deployment;
- calling mocked E2E tests full runtime QA;
- calling TypeScript compilation an accessibility test;
- hiding failed tests behind skipped jobs;
- lowering coverage thresholds;
- excluding risky source from coverage while leaving it enabled;
- marking an external integration verified without a live canary;
- treating GitHub Pages as the full app without a backend;
- exposing Redis to the public network;
- enabling local command execution in hosted mode;
- storing or exporting plaintext provider keys;
- leaving duplicate environment templates with conflicting values;
- saying backup exists without a successful restore drill;
- saying rollback works without demonstrating it;
- marking a feature complete because a route exists;
- leaving raw JSON as the only production user interface;
- leaving uncategorized experimental modules registered;
- accepting manual QA without steps and evidence;
- merging directly to `main` while required checks fail;
- claiming “100%” while known release blockers remain open.

---

## 16. Final 100% Release Checklist

### Repository

- [ ] Clean clone and checkout.
- [ ] No broken submodule/gitlink state.
- [ ] No secrets or local artifacts.
- [ ] All required checks green.
- [ ] Branch protection active.
- [ ] File-size policy enforced.

### Scope

- [ ] Every feature categorized.
- [ ] Every route has policy metadata.
- [ ] Unsupported features disabled or removed.
- [ ] Docs match actual supported behavior.

### Security

- [ ] Threat models complete.
- [ ] Auth/RBAC/CSRF/CORS tested.
- [ ] Upload/path/SSRF/local execution hardened.
- [ ] Redis private.
- [ ] Secrets encrypted and redacted.
- [ ] No critical/high vulnerabilities.
- [ ] Security review findings closed.

### Data

- [ ] Production database selected.
- [ ] PostgreSQL migrations pass.
- [ ] Upgrade path passes.
- [ ] Ownership/IDOR tests pass.
- [ ] Backups automated.
- [ ] Restore drill passes.
- [ ] Retention/export/deletion pass.

### AI

- [ ] Provider contracts pass.
- [ ] Provider canaries pass.
- [ ] Timeouts/retries/cancellation verified.
- [ ] Cost/token controls verified.
- [ ] RAG isolation/injection tests pass.
- [ ] Grounding/citation evals meet thresholds.
- [ ] Domain/safety evals meet thresholds.

### Features

- [ ] Every production-supported vertical slice passes.
- [ ] Core chat and conversations pass.
- [ ] Setup/settings/auth pass.
- [ ] Modes and coding workflow pass.
- [ ] Files/audio/documents pass.
- [ ] Knowledge/RAG/Knowledge OS pass.
- [ ] Local tools and Sprite Lab pass locally.
- [ ] SEC live verification passes.
- [ ] Creative, Gaming, GIS, and supported specialist paths pass.
- [ ] FL Studio/live desktop bridges pass if supported.

### UX and accessibility

- [ ] Onboarding passes from clean install.
- [ ] Loading/error/degraded states complete.
- [ ] Keyboard workflows pass.
- [ ] Automated Axe/Playwright checks pass.
- [ ] NVDA manual review passes.
- [ ] Browser/viewport matrix passes.

### Reliability and operations

- [ ] SLOs defined.
- [ ] Load and soak tests pass.
- [ ] Dependency failure matrix passes.
- [ ] Graceful startup/shutdown passes.
- [ ] Logs/metrics/traces operational.
- [ ] Alerts and runbooks tested.
- [ ] Support bundle is sanitized.

### Deployment and release

- [ ] Staging matches production architecture.
- [ ] Container hardened and scanned.
- [ ] Deployment pipeline passes.
- [ ] Rollback demonstrated.
- [ ] Production smoke passes.
- [ ] Clean-machine QA passes.
- [ ] Release evidence reconciled.
- [ ] All sign-offs target one commit.
- [ ] Version, tag, SBOM, checksums, and release notes published.
- [ ] Controlled rollout and post-deploy review succeed.

---

## 17. Completion Statement

The project may be called **100% production-ready** only after every applicable item in this plan is `VERIFIED`, the final release sign-off matrix is complete, and the exact tagged commit has passed clean-machine, staging, production smoke, security, recovery, accessibility, performance, and operational verification.

Anything less should be described accurately as one of the following:

- development build;
- internal alpha;
- local beta;
- public beta;
- release candidate;
- production preview.

The label must follow the evidence. The evidence must not be rewritten to fit the label.
