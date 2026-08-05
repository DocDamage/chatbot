# ADR-0008 — Production Hosting Target

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The repository includes a Node/Express server, React/Vite client, PostgreSQL and Redis development services, local integrations, and a client-only Pages workflow. No production environment is certified. A target architecture is needed now so CI, configuration, security, observability, persistence, and rollback work converge on one deployment class.

## Decision

The initial hosted production target is a **single-region managed Linux OCI container platform** with the following architecture:

- One versioned application image containing the built Express server and static client.
- TLS termination at a managed ingress or reverse proxy.
- Private managed PostgreSQL 16+ as the system of record, with pgvector only when required by the selected retrieval mode.
- Private managed Redis 7-compatible service for cache, rate limiting, and short-lived coordination.
- Private object/artifact storage for uploads, generated exports, and large evidence that must outlive an application container.
- A managed secret store or protected deployment-secret mechanism.
- Centralized logs, metrics, traces, alerts, and immutable release metadata.
- Automated staging and production deployment with health-gated rollout and demonstrated rollback.
- At least one application instance initially, with architecture and state placement compatible with later horizontal scaling.

The target is provider-neutral at this phase. `P11-T01` must select the specific vendor, region, network layout, storage services, and cost controls before implementation of the final deployment pipeline.

GitHub Pages is excluded from this architecture except as the static demo defined in ADR-0003. Local integrations are excluded by ADR-0002.

## Alternatives considered

### Unmanaged virtual machine with manual deployment

Rejected for the initial target because repeatability, patching, secret handling, observability, and rollback would depend too heavily on manual operator state.

### Kubernetes

Deferred. It adds operational complexity not justified before capacity tests show a need.

### Serverless functions for every API route

Rejected as the primary target because streaming, long-running ingestion, background work, WebSockets, native dependencies, and process lifecycle require more analysis.

### GitHub Pages as the full host

Rejected because it cannot run the backend.

## Consequences

### Positive

- Build, smoke, health, secrets, networking, and rollback work target one deployment class.
- Managed data services reduce operational burden.
- The image can be reproduced and promoted from staging to production.

### Negative

- A vendor and budget still must be selected.
- Containerization and external artifact storage require implementation work.
- Native or local-only tools cannot run in hosted production.

## Security and data impact

- Only ingress is public; PostgreSQL, Redis, internal metrics, and administration remain private.
- Application containers run as non-root with minimal capabilities and explicit writable paths.
- Secrets are injected at runtime and never built into images or client assets.
- Artifact storage uses private access, ownership checks, encryption, retention, and malware/parser controls.

## Verification obligations

- `P03-T08`: build and smoke the production image.
- `P04-T09` and `P04-T10`: browser policy and secret lifecycle.
- `P10`: operational telemetry and runbooks.
- `P11-T01`: select concrete hosting services and network boundaries.
- `P11-T02` through `P11-T08`: harden image, ingress, deployment, rollback, and smoke.
- `P12`: clean-machine, staging-like, and security acceptance.

## Unresolved assumptions

- Vendor, region, availability-zone strategy, domain, and monthly budget are not selected.
- WebSocket and long-running-job scaling requirements remain to be measured.
- Multi-region disaster recovery is not part of the initial target.

## Superseded decisions

None. This ADR replaces vague “run Docker” and client-only Pages interpretations with an explicit target class.

## Repository evidence reviewed

- `package.json`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- server startup and health files
- `docs/DEPLOYMENT_MODES.md`
