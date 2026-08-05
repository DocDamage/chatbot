# Deployment Modes

> This document describes intended execution modes. It does not certify any environment as production-ready.

## Status metadata

- Reconciled by task: `P00-T03`.
- Reconciliation baseline: `main` commit `f520cc4a71b975a8f816454ab2c174b8e5663617`.
- Reconciliation date: `2026-08-04` America/New_York.
- Production hosting, database, Redis, Pages purpose, provider support, and telemetry/privacy decisions remain assigned to `P00-T04` and later tasks.

## Authoritative release sources

- [Master Production Completion Tracker](implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md)
- [Production Feature Manifest](implementation/PRODUCTION_FEATURE_MANIFEST.md)
- [Release Evidence Index](implementation/RELEASE_EVIDENCE_INDEX.md)

## Verification levels used here

- **Documented:** commands and intended behavior are described.
- **Automated-verified:** named automated checks passed against an exact commit and date.
- **Manual-verified:** documented human runtime steps passed against an exact commit, environment, and date.
- **Deployment-verified:** the intended deployed environment passed smoke, dependency, persistence, security, and operational checks.

A documented command is not proof that it was run successfully.

## Local development

```bash
npm run dev
```

Intended endpoints:

- Client: `http://localhost:3000`
- API: `http://localhost:3001`
- Vite proxies API requests during development.

Classification: development use only. This mode is not deployment-verified.

## Built local evaluation

```bash
npm run build
npm start
```

Intended behavior:

- Open `http://localhost:3001`.
- Express serves the built client and API from one origin.
- `JWT_SECRET` must be strong.
- Production-mode CORS must use an explicit allowed origin.

Classification: a local production-mode simulation. A successful local start may become automated-verified or manual-verified evidence, but it is not a production deployment by itself.

## Hosted application

A hosted release requires a separately selected and verified architecture for:

- application hosting and TLS;
- PostgreSQL and migrations where hosted persistence is claimed;
- Redis network isolation and authentication where used;
- secrets and rotation;
- upload/artifact storage;
- provider connectivity and degraded behavior;
- backups and restore;
- logs, metrics, traces, and alerts;
- repeatable deployment and rollback.

Classification: not deployment-verified at the `P00-T03` reconciliation baseline.

## Static demo / GitHub Pages

A static client does not supply the Express API, authentication, database, Redis, local tools, provider integrations, or background services.

It must be treated as one of the following after the Pages ADR is completed:

1. a static UI demonstration with unavailable backend features clearly disabled;
2. a client configured for a separately deployed API; or
3. removed from the release path.

It must not be presented as the complete production application without a separately deployed and verified backend.

## Local-only experimental capabilities

The production feature manifest currently places local filesystem, audio, coding, local-command, Sprite Lab, FL Studio, and related desktop integrations in `LOCAL_ONLY_EXPERIMENTAL` where applicable. They are intended for a trusted local machine and must not be exposed in hosted mode unless a later verified task changes the classification.

## Privileged API groups

The repository includes privileged route groups such as settings, files, audio, plans, code, knowledge, administration, export, and webhooks. Presence of middleware or tests does not by itself certify the complete authorization model. Current route policy and release status must be taken from the manifest, tracker, and later security evidence.

## Evaluation checklist

When evaluating a built environment, record the exact commit, date, environment, commands, exit codes, and runtime results. At minimum, check:

- liveness and readiness;
- client load;
- authenticated and unauthorized route behavior;
- provider behavior and failure states;
- persistence across restart;
- migration state;
- dependency health;
- secret and header policy;
- logs and metrics;
- backup/restore and rollback where claiming deployment verification.

No checklist item is considered passed until evidence is recorded in `docs/implementation/evidence/` and indexed.
