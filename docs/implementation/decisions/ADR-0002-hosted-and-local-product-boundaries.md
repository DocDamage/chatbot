# ADR-0002 — Hosted and Trusted-Local Product Boundaries

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The repository combines network-hostable chatbot features with capabilities that inspect local files, run local executables, modify workspaces, call desktop applications, and discover Windows installation paths. Keeping all routes in one server without an enforced product mode would turn a normal hosted deployment into a remote code execution and private-file exposure risk.

The production feature manifest already classifies many filesystem, coding, audio, local-tool, Sprite Lab, and FL Studio capabilities as local-only experimental. This decision makes that boundary normative.

## Decision

The product has exactly two executable deployment profiles:

### `HOSTED`

A multi-user network service intended to accept untrusted remote requests.

- May expose only features classified for hosted availability in the production feature manifest.
- Must not register or execute local filesystem browsing, arbitrary workspace mutation, local command execution, external desktop-tool control, Sprite Lab external adapters, FL Studio/MCP control, or similar host-integrated capabilities.
- Must use PostgreSQL as defined in ADR-0001.
- Must enforce server-side route policy; hiding a client panel is not a security boundary.
- Must run with least-privilege filesystem and process permissions.

### `LOCAL_TRUSTED`

A single-user or explicitly trusted-user application running on the user's machine.

- May enable local filesystem, coding, media, desktop, and tool integrations only when each feature remains explicitly enabled, role-gated, path-confined, approval-bound, and audited.
- Uses SQLite by default, with PostgreSQL optional for local testing.
- Must not imply that local-only integrations are safe for exposure to the public internet.
- The browser may connect only to the local application origin unless the user deliberately configures another trusted topology.

Every route, background initializer, UI panel, and feature flag must map to one of these profiles. A feature with no profile mapping is disabled by default.

## Alternatives considered

### One universal server with UI-only hiding

Rejected. A hidden panel does not prevent direct API access or compromised-client requests.

### Ship only a hosted product

Rejected. Local tool and desktop workflows are significant intended capabilities and can be retained safely behind a trusted-local boundary.

### Ship only a local desktop product

Rejected. Core chat, conversation, RAG, and administrative capabilities are intended to support a hosted release after verification.

## Consequences

### Positive

- High-risk host integrations cannot silently enter the hosted attack surface.
- Local capabilities remain available without forcing them through cloud permissions or file upload.
- Route policy, feature registration, documentation, and QA gain a single deployment-mode vocabulary.

### Negative

- Startup and routing code must be refactored to enforce profile-specific registration.
- Some currently registered routes will be removed from hosted mode.
- Testing must cover both profiles.

## Security and data impact

- Hosted mode is default-deny for local resources and child processes.
- Local trusted mode still requires path canonicalization, executable allowlists, exact approval binding, output confinement, timeouts, cancellation, and audit records.
- A local user must be told when data leaves the machine for a remote model or external service.

## Verification obligations

- `P02-T01` through `P02-T03`: inventory, reachability, and removal/isolation.
- `P02-T06`: typed `HOSTED` and `LOCAL_TRUSTED` configuration validation.
- `P04-T03`, `P04-T05`, and `P04-T06`: route policy, path safety, and local execution hardening.
- `P07-T06`, `P07-T07`, `P07-T12`, `P07-T13`, and `P07-T17`: local feature verification.
- `P12-T03`: cross-configuration acceptance for hosted and local profiles.

## Unresolved assumptions

- Packaging of `LOCAL_TRUSTED` as a desktop wrapper versus a local web application remains outside this task.
- Remote LAN access for local mode is not supported unless a later ADR defines its threat model.
- Multi-user local installations are not supported by this decision.

## Superseded decisions

None. This ADR formalizes the boundary previously described only in the feature manifest and deployment documentation.

## Repository evidence reviewed

- `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`
- `docs/DEPLOYMENT_MODES.md`
- `src/core/local-tools/LocalToolService.ts`
- `client/src/api/runtime.ts`
- `client/src/components/LocalToolsWorkspace.tsx`
- server route registration and service initialization files
