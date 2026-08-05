# ADR-0010 — Telemetry and Privacy Policy

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The repository has structured logging, metrics, analytics, feedback, audit helpers, provider calls, document ingestion, conversations, and local integrations. Current analytics code can retain normalized query text, user IDs, session IDs, and usage patterns in memory. Current logger helpers can record user IDs, IP addresses, error stacks, and arbitrary metadata. No certified redaction, consent, retention, export, or deletion program exists.

Operational visibility is required, but content telemetry would create unnecessary privacy and security risk.

## Decision

### Default collection policy

- **No third-party product analytics or advertising telemetry is enabled by default.**
- `LOCAL_TRUSTED` telemetry is off by default except local diagnostic logs the user explicitly runs or exports.
- `HOSTED` collects only data-minimized operational telemetry needed for reliability, security, billing/cost control, and audit.
- Raw prompts, model responses, retrieved passages, uploaded-file contents, extracted text, provider keys, authentication tokens, authorization headers, full local paths, and local command output are excluded from routine logs, metrics, traces, and support bundles.
- Product analytics that records query text, conversation content, or behavioral profiling is disabled until a separate opt-in design, privacy notice, retention policy, and deletion path are verified.

### Identifiers and network data

- Use internal pseudonymous identifiers rather than email addresses or display names in operational telemetry.
- IP addresses are collected only where required for security, abuse prevention, or network diagnostics, and are access-restricted and short-lived.
- Metrics labels must avoid user, session, prompt, file, URL, or other high-cardinality personal values.

### Retention defaults

- Operational application logs: maximum 30 days unless an incident hold is documented.
- Security and privileged-action audit records: maximum 90 days by default, with longer retention requiring an explicit legal/operational decision.
- Aggregated non-identifying service metrics may be retained longer when they cannot be reversed into user activity.
- Local diagnostics remain on the user's machine until the user deletes or exports them.

### Provider disclosure

Before sending data to an external model, search, GIS, SEC, webhook, or other service, the product must disclose the provider class and the categories of data transmitted. A provider change cannot silently alter privacy terms.

### User rights and operations

Hosted users need documented export and deletion paths for conversations, memories, files, and account data. Support bundles must be generated locally or server-side with deterministic redaction and user review where practical.

This ADR is a release policy, not a claim that current code complies.

## Alternatives considered

### Log full prompts and responses for debugging

Rejected as the default. It materially increases breach impact and conflicts with local/private workflows.

### Collect no operational data

Rejected for hosted production because incidents, abuse, provider failure, cost anomalies, and recovery cannot be managed responsibly without bounded telemetry.

### Enable third-party analytics by default

Rejected because it is not necessary for initial operation and lacks consent, minimization, and deletion evidence.

## Consequences

### Positive

- Privacy risk and support-bundle exposure are reduced.
- Operations still receive bounded health, performance, security, and cost signals.
- Local-first behavior remains credible.

### Negative

- Some debugging becomes harder without raw content.
- Redaction, access controls, retention jobs, and privacy documentation require implementation.
- Existing query analytics and arbitrary metadata logging must be gated or redesigned.

## Security and data impact

- Telemetry stores are protected data systems with least-privilege access, encryption, retention enforcement, and audit.
- Secrets and content redaction must be tested with representative failures.
- Error stacks must be separated from user-facing responses and sanitized before external export.
- Audit integrity must not depend solely on the same mutable logs used for diagnostics.

## Verification obligations

- `P04-T10` and `P04-T11`: secret redaction and audit logging.
- `P05-T08`: export, deletion, retention, and orphan cleanup.
- `P10-T01` through `P10-T07`: logging, metrics, tracing, alerts, runbooks, and support bundle.
- `P12-T05`: deployed privacy/security configuration acceptance.
- `P12-T06`: executable privacy and administration documentation.

## Unresolved assumptions

- Applicable legal jurisdictions and any required longer retention are not selected.
- Billing telemetry is deferred until a billing model exists.
- The exact pseudonymization and audit-store design remains for Phase 4/10.
- User-facing consent language requires product/legal review before launch.

## Superseded decisions

None. This ADR supersedes any assumption that current analytics or logger fields are automatically approved for production collection.

## Repository evidence reviewed

- `src/core/observability/logger.ts`
- `src/core/observability/metrics.ts`
- `src/core/analytics/AnalyticsService.ts`
- feedback, audit, export, and provider settings routes
- `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`
