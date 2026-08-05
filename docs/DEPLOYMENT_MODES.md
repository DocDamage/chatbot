# Deployment Modes

> This document describes intended execution modes. It does not certify any environment as production-ready.

## Status metadata

- Reconciled by task: `P00-T03`.
- Architecture decisions established by task: `P00-T04`.
- Decision baseline: `main` commit `4b10a434f5b60216608da74303d4193bc289e372`.
- Decision date: `2026-08-05` America/New_York.
- No mode is deployment-verified until the later implementation and release gates pass.

## Authoritative release sources

- [Master Production Completion Tracker](implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md)
- [Production Feature Manifest](implementation/PRODUCTION_FEATURE_MANIFEST.md)
- [Release Evidence Index](implementation/RELEASE_EVIDENCE_INDEX.md)
- [Architecture and Release Decisions](implementation/decisions/README.md)

## Accepted architecture boundary

The accepted deployment profiles are:

- `HOSTED`: a multi-user network service with local filesystem, local command, Sprite Lab external-tool, FL Studio/MCP, and other desktop integrations excluded from server registration.
- `LOCAL_TRUSTED`: a trusted-user application on Windows 11 x64 where local integrations may be enabled only with feature flags, roles, confinement, approval, and audit.

Related decisions:

- [ADR-0001 — Production database](implementation/decisions/ADR-0001-production-database.md)
- [ADR-0002 — Hosted and local boundaries](implementation/decisions/ADR-0002-hosted-and-local-product-boundaries.md)
- [ADR-0003 — GitHub Pages](implementation/decisions/ADR-0003-github-pages-purpose.md)
- [ADR-0007 — Redis](implementation/decisions/ADR-0007-redis-deployment-model.md)
- [ADR-0008 — Hosting target](implementation/decisions/ADR-0008-production-hosting-target.md)

## Verification levels used here

- **Documented:** commands and intended behavior are described.
- **Automated-verified:** named automated checks passed against an exact commit and date.
- **Manual-verified:** documented human runtime steps passed against an exact commit, environment, and date.
- **Deployment-verified:** the intended deployed environment passed smoke, dependency, persistence, security, recovery, and operational checks.

A documented command or accepted ADR is not proof that implementation or deployment passed.

## Local development

```bash
npm run dev
```

Intended endpoints:

- Client: `http://localhost:3000`
- API: `http://localhost:3001`
- Vite proxies API requests during development.

Classification: development use only. This mode is not deployment-verified.

## Built trusted-local evaluation

```bash
npm run build
npm start
```

Intended behavior:

- Open `http://localhost:3001`.
- Express serves the built client and API from one origin.
- SQLite is the default trusted-local database.
- `JWT_SECRET` must be strong.
- CORS must use an explicit allowed origin.
- Local integrations remain disabled unless deliberately enabled and approved.

Classification: a `LOCAL_TRUSTED` production-mode simulation. A successful start may become automated-verified or manual-verified evidence, but it is not a hosted deployment.

## Hosted application

The target is a single-region managed Linux OCI container platform with:

- managed TLS ingress;
- private PostgreSQL 16+ as the system of record;
- private authenticated Redis 7-compatible service;
- protected artifact storage;
- secret management;
- logs, metrics, traces, alerts, backups, and rollback.

Local filesystem browsing, local commands, workspace mutation, desktop-tool control, Sprite Lab external adapters, and FL Studio/MCP are excluded from `HOSTED`.

Classification: architecture accepted, not deployment-verified.

## Static demo / GitHub Pages

GitHub Pages is an optional static demonstration only.

- It must show a visible limitation notice.
- Backend and privileged controls must be disabled.
- It must contain no secrets or private data.
- It is not connected to a production API by this decision.
- `P01-T05` must repair it under these limits or remove it.

Classification: static demo, not the hosted product.

## Provider, file, OS, experimental, and privacy boundaries

- Initial provider targets: OpenAI for `HOSTED`; Ollama for `LOCAL_TRUSTED`.
- Initial file targets are deliberately narrow; consult ADR-0005.
- Local integration support initially targets Windows 11 x64; hosted containers target Linux x86_64.
- Preview and local-only features follow the registration policy in ADR-0009.
- Routine telemetry excludes prompt, response, file, secret, and local-command content by default under ADR-0010.

None of these targets are production-supported until their later verification tasks pass.

## Evaluation checklist

When evaluating an environment, record the exact commit, date, profile, operating system, commands, exit codes, and runtime results. At minimum, check:

- liveness and readiness;
- client load;
- authenticated, unauthorized, and forbidden route behavior;
- deployment-profile route registration;
- provider behavior and failure states;
- persistence across restart;
- migration state;
- dependency health;
- secret and header policy;
- logs, metrics, traces, and redaction;
- backup/restore and rollback where claiming deployment verification.

No checklist item is passed until evidence is committed under `docs/implementation/evidence/` and indexed.
