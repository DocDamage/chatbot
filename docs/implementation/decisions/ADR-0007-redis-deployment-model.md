# ADR-0007 — Redis Deployment Model

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The application can use Redis for cache and shared coordination. The current Compose file publishes port 6379 to the host and starts Redis without authentication or TLS. That is acceptable only as an explicitly loopback-bound local development convenience, not as a production model. Redis also must not become an undocumented durable system of record.

## Decision

### Hosted profile

- Use a managed or separately operated Redis 7-compatible service on a private application network.
- Require authenticated connections and TLS whenever traffic crosses a host boundary.
- Do not publish Redis directly to the public internet or a general host interface.
- Use Redis only for reconstructable cache, shared rate limiting, short-lived coordination, and explicitly documented queue state.
- Durable user records, approvals, audit evidence, and unreconstructable job state belong in PostgreSQL or protected artifact storage.
- Define dependency-specific fail behavior: high-risk abuse controls fail closed; low-risk cache reads may degrade without Redis when documented.

### Trusted-local profile

- Redis is optional.
- When used, it must bind to loopback or a private container network by default.
- Disk cache or in-process cache may be used as documented local fallbacks, but they do not prove multi-instance behavior.

The existing Compose file is classified as development-only until `P11-T03` removes unsafe host exposure and credentials from production-like defaults.

## Alternatives considered

### Publicly exposed self-hosted Redis

Rejected because it creates avoidable credential, data, command, and denial-of-service risk.

### Redis as the primary durable database

Rejected because the application already requires relational ownership, migrations, backups, and auditability in PostgreSQL.

### Remove Redis entirely

Rejected because shared rate limiting, cache, and coordination are useful for horizontally scaled hosted deployment.

## Consequences

### Positive

- Redis failure and data-loss expectations are explicit.
- Production networking aligns with least privilege.
- Local development can remain simple without making unsafe Compose defaults authoritative.

### Negative

- Hosted deployment gains a managed dependency and cost.
- Shared limits and queue behavior require multi-instance tests.
- Local and hosted cache behavior may differ.

## Security and data impact

- Redis credentials are secrets and must be rotated and redacted.
- Keys and values must minimize personal data and use bounded TTLs.
- Untrusted input must not become unbounded key cardinality or payload size.
- Proxy/IP-derived rate-limit dimensions require trusted-proxy validation.

## Verification obligations

- `P04-T08`: authentication, TLS, rate classes, fail behavior, proxy handling, and multi-instance tests.
- `P09-T05`: Redis outage and recovery behavior.
- `P10-T02` and `P10-T05`: Redis metrics, dashboards, and alerts.
- `P11-T03`: safe Compose and deployment manifests.
- `P12-T05`: verify Redis is not publicly exposed.

## Unresolved assumptions

- The exact managed Redis vendor remains a `P11-T01` decision.
- Which queues, if any, require durable recovery remains to be inventoried.
- Local Redis fallback behavior is not yet certified.

## Superseded decisions

None. This ADR rejects the current development Compose port mapping as a production pattern.

## Repository evidence reviewed

- `docker-compose.yml`
- `.env.example`
- `env.example`
- Redis cache and rate-limit implementation files
- `docs/DEPLOYMENT_MODES.md`
