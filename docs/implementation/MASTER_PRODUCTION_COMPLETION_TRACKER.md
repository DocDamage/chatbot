# Master Production Completion Tracker

> Authoritative release-status tracker for the AI Chatbot Hub production-completion plan.

## Tracker metadata

- Repository: `DocDamage/chatbot`
- Baseline branch: `main`
- Baseline commit: `8b963232d72a69c6616667aaf34daadba6056aba`
- Working branch: `agent/p00-t01-master-production-tracker`
- Plan date: `2026-08-04`
- Tracker created: `2026-08-04`
- Status vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED_NOT_VERIFIED`, `BLOCKED`, `VERIFIED`, `RELEASED`

## Governance rules

1. Only `VERIFIED` tasks count toward production completion.
2. A task may be marked `VERIFIED` only when implementation, applicable automated checks, required runtime QA, evidence, documentation, and the task exit gate are complete.
3. Old completion claims are historical references until reconciled against current evidence.
4. Every status change must identify a branch, implementation commit, evidence path, blocker state, and verification date.
5. Each task must be performed in a new Codex thread and must end with an archived handoff plus a replacement `CURRENT_HANDOFF.md`.
6. No task may be expanded into a different task ID without closing the current task and starting a new thread.
7. Release applicability is `REQUIRED` unless a later architecture decision explicitly marks the task `NOT_APPLICABLE` with evidence.

## Summary

| Phase | Total | Verified | In progress | Blocked | Not started |
|---|---:|---:|---:|---:|---:|
| PHASE 0 | 5 | 1 | 0 | 0 | 4 |
| PHASE 1 | 7 | 0 | 0 | 0 | 7 |
| PHASE 2 | 7 | 0 | 0 | 0 | 7 |
| PHASE 3 | 8 | 0 | 0 | 0 | 8 |
| PHASE 4 | 12 | 0 | 0 | 0 | 12 |
| PHASE 5 | 8 | 0 | 0 | 0 | 8 |
| PHASE 6 | 9 | 0 | 0 | 0 | 9 |
| PHASE 7 | 20 | 0 | 0 | 0 | 20 |
| PHASE 8 | 8 | 0 | 0 | 0 | 8 |
| PHASE 9 | 7 | 0 | 0 | 0 | 7 |
| PHASE 10 | 7 | 0 | 0 | 0 | 7 |
| PHASE 11 | 8 | 0 | 0 | 0 | 8 |
| PHASE 12 | 8 | 0 | 0 | 0 | 8 |
| PHASE 13 | 5 | 0 | 0 | 0 | 5 |
| PHASE 14 | 5 | 0 | 0 | 0 | 5 |
| **Total** | **124** | **1** | **0** | **0** | **123** |

## Task register

### PHASE 0 — Release Governance, Scope Freeze, and Truthful Status

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P00-T01` | Create the master production completion tracker | Codex/GitHub | `VERIFIED` | `agent/p00-t01-master-production-tracker` | `84ef639bda41d585240041a0657cd21f2e9f8cde` | `docs/implementation/evidence/PHASE-00/P00-T01/2026-08-04_84ef639b` | None | `2026-08-04` | `REQUIRED` |
| `P00-T02` | Create the production feature manifest | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P00-T03` | Reconcile existing release documents | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P00-T04` | Establish release decisions | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P00-T05` | Create GitHub milestones and issues | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 1 — Restore Repository Integrity and a Fully Green `main`

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P01-T01` | Reproduce the latest CI failure locally | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P01-T02` | Correct clipboard behavior and tests | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P01-T03` | Remove the client lint warning | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P01-T04` | Repair stale gitlink/submodule state | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P01-T05` | Decide and repair GitHub Pages | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P01-T06` | Make all current CI stages execute | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P01-T07` | Add branch protection | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 2 — Repository Hygiene, Architecture Boundaries, and Maintainability

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P02-T01` | Create a complete code and route inventory | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P02-T02` | Build a reachability map | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P02-T03` | Remove or isolate legacy and duplicate implementations | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P02-T04` | Enforce the 300-line source guideline | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P02-T05` | Consolidate environment templates | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P02-T06` | Create configuration schemas | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P02-T07` | Normalize documentation and generated artifacts | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 3 — CI/CD and Verification Gates That Cannot Produce False Confidence

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P03-T01` | Split and harden CI jobs | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T02` | Implement meaningful server coverage policy | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T03` | Implement client coverage thresholds | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T04` | Replace fake accessibility testing | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T05` | Add real browser E2E testing | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T06` | Add dependency and supply-chain gates | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T07` | Add migration CI | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P03-T08` | Add container and package smoke tests | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 4 — Security Hardening and Abuse Resistance

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P04-T01` | Produce a complete threat model | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T02` | Harden authentication and session policy | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T03` | Formalize route authorization | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T04` | Upgrade and harden uploads | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T05` | Harden file browsing and workspace access | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T06` | Harden local command execution | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T07` | Harden SSRF and outbound requests | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T08` | Harden Redis and rate limiting | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T09` | Security headers and browser policy | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T10` | Secrets and API-key lifecycle | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T11` | Audit logging | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P04-T12` | Independent security review | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 5 — Database, Persistence, Migration, Backup, and Recovery

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P05-T01` | Select and document the production database | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T02` | Centralize migration management | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T03` | Test PostgreSQL as a first-class target | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T04` | Enforce user ownership and data isolation | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T05` | Transaction and consistency review | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T06` | Backup implementation | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T07` | Restore drill | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P05-T08` | Data retention, deletion, and export | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 6 — AI Provider, Routing, RAG, Safety, and Evaluation Reliability

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P06-T01` | Declare supported providers and models | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T02` | Provider contract tests | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T03` | Real provider canary tests | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T04` | Timeout, retry, circuit breaker, and cancellation | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T05` | Token, context, and cost controls | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T06` | RAG production hardening | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T07` | Grounding and citation release gates | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T08` | Domain and safety evals | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P06-T09` | Eval regression enforcement | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 7 — Feature-by-Feature Production Completion

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P07-T01` | Core chat and streaming | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T02` | Authentication, setup, and settings | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T03` | Conversations and sharing | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T04` | Modes and specialist routing | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T05` | Coding workflow | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T06` | File Explorer | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T07` | Audio browser and analysis | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T08` | Document, image, and video ingestion | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T09` | Knowledge Base and RAG UI | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T10` | Knowledge Online approval workflow | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T11` | Knowledge OS | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T12` | Local tools | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T13` | Sprite Lab | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T14` | SEC ingestion | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T15` | Gaming and game-development features | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T16` | Creative writing and roleplay | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T17` | Music, FL Studio, and desktop bridges | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T18` | GIS | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T19` | Administration and exports | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P07-T20` | Webhooks, automation, notifications, and real-time features | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 8 — UX, Accessibility, Onboarding, and Product Polish

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P08-T01` | Information architecture review | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T02` | Unified state design | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T03` | Dangerous-action UX | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T04` | First-run onboarding | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T05` | WCAG 2.2 AA implementation | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T06` | Manual assistive-technology test | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T07` | Responsive and browser matrix | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P08-T08` | Product copy and diagnostics | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 9 — Performance, Capacity, Resilience, and Failure Testing

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P09-T01` | Define service objectives | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P09-T02` | Build representative load profiles | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P09-T03` | Load and soak tests | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P09-T04` | Resource and abuse caps | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P09-T05` | Dependency failure matrix | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P09-T06` | Startup and shutdown reliability | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P09-T07` | Performance regression gate | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 10 — Observability, Auditability, and Operational Readiness

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P10-T01` | Structured logging standard | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P10-T02` | Metrics | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P10-T03` | Distributed tracing | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P10-T04` | Health endpoints | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P10-T05` | Dashboards and alerts | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P10-T06` | Runbooks | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P10-T07` | Operational support bundle | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 11 — Production Deployment Engineering

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P11-T01` | Select the production hosting architecture | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T02` | Harden the Docker image | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T03` | Correct Docker Compose defaults | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T04` | Reverse proxy and TLS | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T05` | Staging environment | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T06` | Automated deployment pipeline | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T07` | Migration and rollback strategy | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P11-T08` | Production smoke suite | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 12 — Full Manual QA and Release Candidate Certification

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P12-T01` | Clean-machine installation | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T02` | Manual workflow matrix | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T03` | Cross-configuration matrix | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T04` | Long-running and large-data scenarios | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T05` | Security acceptance | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T06` | Documentation acceptance | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T07` | Release evidence reconciliation | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P12-T08` | Final release candidate sign-off | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 13 — Versioning, Release Packaging, and Launch

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P13-T01` | Version and tag | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P13-T02` | Release artifacts | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P13-T03` | Controlled rollout | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P13-T04` | Post-deploy verification | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P13-T05` | Initial operating review | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

### PHASE 14 — Post-Release Maintenance Baseline

| Task ID | Task | Owner | Status | Branch | Implementation commit | Evidence path | Blocker | Date verified | Release applicability |
|---|---|---|---|---|---|---|---|---|---|
| `P14-T01` | Dependency update policy | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P14-T02` | Vulnerability response SLA | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P14-T03` | Regression and eval maintenance | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P14-T04` | Quarterly restore and incident drills | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |
| `P14-T05` | Feature lifecycle policy | Unassigned | `NOT_STARTED` | — | — | — | — | — | `REQUIRED` |

## Status-change checklist

Before changing any task to `VERIFIED`, confirm:

- [ ] Authorized task ID and scope are unchanged.
- [ ] Implementation is committed.
- [ ] Focused and relevant regression checks pass.
- [ ] Required runtime QA passes.
- [ ] Negative and failure paths are covered.
- [ ] Evidence directory follows the required naming convention.
- [ ] Exact implementation commit and command exit codes are recorded.
- [ ] Feature manifest and release documents are updated when applicable.
- [ ] `CURRENT_HANDOFF.md` and the archived task handoff are committed.
- [ ] The next-thread prompt authorizes exactly one task.
