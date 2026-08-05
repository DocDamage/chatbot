# Architecture and Release Decisions

Release-governing ADRs live in this directory using:

`ADR-####-<short-name>.md`

Each ADR identifies status, date, decision owners, context, decision, alternatives, consequences, security/data impact, verification obligations, unresolved assumptions, and superseded decisions.

## Accepted decisions

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001-production-database.md) | Hosted production database is PostgreSQL; SQLite is trusted-local only | Accepted |
| [ADR-0002](ADR-0002-hosted-and-local-product-boundaries.md) | Separate `HOSTED` and `LOCAL_TRUSTED` product profiles | Accepted |
| [ADR-0003](ADR-0003-github-pages-purpose.md) | GitHub Pages is an optional static demo, never the full product | Accepted |
| [ADR-0004](ADR-0004-supported-llm-provider-boundary.md) | Initial targets are OpenAI hosted and Ollama local; others remain preview/experimental | Accepted |
| [ADR-0005](ADR-0005-supported-file-formats.md) | Narrow initial file-format support target with preview and unsupported sets | Accepted |
| [ADR-0006](ADR-0006-supported-operating-systems.md) | Windows 11 x64 local integrations and Linux x86_64 hosted containers | Accepted |
| [ADR-0007](ADR-0007-redis-deployment-model.md) | Private authenticated Redis for hosted cache/coordination, optional loopback local Redis | Accepted |
| [ADR-0008](ADR-0008-production-hosting-target.md) | Managed Linux OCI container platform with managed data services | Accepted |
| [ADR-0009](ADR-0009-experimental-module-support-policy.md) | Manifest categories control registration and support promotion | Accepted |
| [ADR-0010](ADR-0010-telemetry-and-privacy-policy.md) | Data-minimized operational telemetry; no content analytics by default | Accepted |

## Governance

- An accepted ADR defines the intended architecture; it does not certify that the current code or deployment complies.
- Implementation and verification remain tracked in `../MASTER_PRODUCTION_COMPLETION_TRACKER.md`.
- Feature support remains controlled by `../PRODUCTION_FEATURE_MANIFEST.md`.
- Evidence for completed governance tasks is indexed in `../RELEASE_EVIDENCE_INDEX.md`.
- A later ADR must explicitly identify any decision it supersedes.
