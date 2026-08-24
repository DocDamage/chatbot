# Capability Fusion — CF-10 Rolling Record

- Status: `LOCAL_ONLY_EXPERIMENTAL`
- Scope: Workstream CF-10 — Evaluation, Observability, and Promotion Gates

> Audit correction (2026-08-24): Evaluation/promotion structures exist, but persistent telemetry, real integration benchmarks, alert delivery, rollback restoration, and release/accessibility evidence remain open. Promotion now fails closed when that evidence is absent. See [CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md](./CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md).

## Workstreams & Deliverables

- [x] Implemented `CapabilityEvaluationSuite` across all 10 domain vectors: path containment/secrets, architecture graph determinism, lexical/hybrid retrieval, provider routing budgets, agent team isolation, browser origin boundaries, media consent/cleanup, deterministic game replay, hosted-mode denial, and log/bundle scrubbing (`CapabilityEvaluationSuite.ts`).
- [x] Implemented `CapabilityObservabilityService` aggregating p50/p95/p99 latency, availability, cost estimation, SLO/SLI error budgets, alert escalations, and scrubbed support bundle generation (`CapabilityObservabilityService.ts`).
- [x] Implemented `CapabilityPromotionEngine` enforcing the 3-stage promotion lifecycle (`DISABLED` -> `LOCAL_ONLY_EXPERIMENTAL` -> `PRODUCTION_PREVIEW` -> `PRODUCTION_SUPPORTED`) with automated gate criteria validation, cryptographically signed `PromotionDecisionRecord` generation, and automated rollback execution (`CapabilityPromotionEngine.ts`).
- [x] Built server-side REST API endpoints mounted at `/api/capabilities/evaluations/run`, `/api/capabilities/metrics/dashboard`, `/api/capabilities/support-bundle`, `/api/capabilities/promotions/evaluate`, `/api/capabilities/promotions/promote`, and `/api/capabilities/promotions/rollback` (`src/server/routes/capabilities.ts`).
- [x] Implemented `CapabilityPromotionView` accessible React component with SLO gauges, evaluation runner, digest display, and support bundle exporter (`CapabilityPromotionView.tsx`).
- [x] Integrated Evaluation & Promotion tab into `CapabilityHubPanel` and updated styling (`CapabilityHubPanel.tsx`, `CapabilityHubPanel.css`).
- [x] Architectural Decision Record ADR-0020 (`docs/implementation/decisions/ADR-0020-evaluation-observability-and-promotion-gates.md`).
- [x] Comprehensive test suites for evaluation suite, observability service, promotion engine, API routes, and client components.
