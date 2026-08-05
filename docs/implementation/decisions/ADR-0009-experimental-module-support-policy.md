# ADR-0009 — Experimental Module Support Policy

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The repository contains a broad feature surface. Compilation, route registration, or an existing component does not prove that a feature has authorization policy, failure handling, persistence, accessibility, security, runtime evidence, or operational support. The production feature manifest already defines four status categories, but a promotion and registration policy is required.

## Decision

Every feature, route group, provider, integration, background service, and UI entry point must use exactly one release category:

1. `PRODUCTION_SUPPORTED`
2. `PRODUCTION_PREVIEW`
3. `LOCAL_ONLY_EXPERIMENTAL`
4. `DISABLED_OR_REMOVED`

### Registration rules

- Hosted production uses an explicit allowlist derived from the feature and route-policy manifests.
- `PRODUCTION_SUPPORTED` features may be enabled by default only in their approved deployment profiles.
- `PRODUCTION_PREVIEW` features are disabled by default in general availability, or visibly labeled and separately enabled in an approved preview environment.
- `LOCAL_ONLY_EXPERIMENTAL` features are never registered in `HOSTED`.
- `DISABLED_OR_REMOVED` features have no reachable route, background initializer, navigation entry, or undocumented activation path.
- A new or uncategorized feature is default-disabled.

### Promotion rules

Promotion to `PRODUCTION_SUPPORTED` requires the complete vertical-slice checklist, applicable security and data evidence, automated tests, manual runtime QA, accessibility, documentation, operational readiness, and exact-commit evidence. A merged implementation or passing unit test is insufficient.

Demotion is mandatory when a critical dependency becomes unsupported, a security control fails, a release canary regresses, or operational ownership is withdrawn.

## Alternatives considered

### Treat all merged code as supported

Rejected because it produces a false-complete and unsafe release surface.

### Delete every experimental module immediately

Rejected because valuable future work can remain isolated without entering the supported product.

### Use feature flags without a manifest

Rejected. Flags alone do not identify ownership, role, profile, evidence, or support promises.

## Consequences

### Positive

- Product claims follow evidence.
- Experimental work can coexist with a smaller safe release.
- CI can block uncategorized routes and features.

### Negative

- Route registration and navigation need restructuring.
- Preview features may disappear from the general-release UI.
- Maintaining manifests becomes required engineering work.

## Security and data impact

- Default-deny registration reduces accidental exposure.
- Local-only and preview features still require controls appropriate to their environment.
- Disabling a UI element without removing its route does not satisfy this policy.
- Feature flags that affect data formats require safe migrations and rollback behavior.

## Verification obligations

- `P02-T01` through `P02-T03`: inventory, reachability, and isolation.
- `P03-T01`: validate manifests in CI.
- `P04-T03`: require route authorization metadata.
- `P07`: execute vertical-slice acceptance for each supported feature.
- `P12-T07`: reject release candidates with uncategorized or unverified production items.
- `P14-T05`: apply this lifecycle to all future features.

## Unresolved assumptions

- The exact production-support set remains empty until later tasks verify individual features.
- Preview enrollment and user-facing labeling need Phase 8 design.
- Owners for each feature will be assigned through Phase 0 issues and milestones.

## Superseded decisions

None. This ADR makes the existing manifest classification enforceable rather than descriptive.

## Repository evidence reviewed

- `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`
- `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`
- server route registration files
- client panel and mode registration files
