# ADR-0001 — Production Database

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The repository can initialize either SQLite or PostgreSQL. When no database URL is configured, the service initializer selects SQLite. The database abstraction describes SQLite as the development option and PostgreSQL as the production option. The current Compose file includes PostgreSQL 16 with pgvector, but hosted migrations, backups, restore, ownership isolation, and upgrade evidence are not yet complete.

A release boundary is required now so later migration, backup, testing, and deployment tasks do not optimize for conflicting persistence targets.

## Decision

1. **Hosted production uses PostgreSQL 16 or newer as the only supported system-of-record database.**
2. **pgvector is required only when the released retrieval configuration stores or searches vectors in PostgreSQL.** It is not required for deployments that do not enable database-backed vector search.
3. **SQLite is supported only for trusted local, single-user operation, development, tests, and clean-machine evaluation.**
4. Hosted mode must fail configuration validation when durable features are enabled without a PostgreSQL connection.
5. In-memory stores and browser storage may cache or stage data, but they are not authoritative persistence.
6. All hosted schema changes must use versioned migrations. Startup-time ad hoc schema mutation cannot be the final release migration strategy.
7. Production readiness requires upgrade testing, backup automation, a successful restore drill, ownership/tenant isolation tests, and documented recovery objectives.

This ADR selects the target. It does not certify the current database implementation or Compose configuration.

## Alternatives considered

### SQLite for every deployment

Rejected. SQLite is appropriate for local single-user use but is a poor default for horizontally scaled hosted workloads, shared ownership enforcement, operational backups, and concurrent background processing.

### Support SQLite and PostgreSQL equally in hosted production

Rejected for the initial release. Dual hosted targets would double migration, concurrency, backup, recovery, and support obligations before either target is certified.

### External managed vector database plus a separate relational database

Deferred. It adds another critical dependency and data-isolation boundary without evidence that the initial release requires it.

## Consequences

### Positive

- Hosted migration, backup, isolation, load, and recovery work has one authoritative target.
- Local use remains lightweight through SQLite.
- The production architecture aligns with the existing PostgreSQL abstraction and pgvector Compose image.

### Negative

- Hosted operators must provision PostgreSQL.
- SQLite-only behaviors may expose compatibility defects that must be fixed rather than accepted in hosted mode.
- Database migration work in Phase 5 remains a release blocker.

## Security and data impact

- PostgreSQL must be private to the application network, encrypted in transit when crossing hosts, authenticated with rotated credentials, and backed up to protected storage.
- Application authorization remains mandatory; database selection alone does not provide tenant isolation.
- Connection strings and backup credentials are secrets and must never enter client bundles, logs, support bundles, or committed files.

## Verification obligations

- `P02-T06`: reject hosted production without the required database configuration.
- `P03-T07`: test empty, previous-release, repeated, and failure-path migrations.
- `P05-T02` through `P05-T07`: centralize migrations, verify PostgreSQL, enforce ownership, back up, and restore.
- `P09-T03` and `P09-T05`: test capacity and database failure behavior.
- `P11-T05` through `P11-T08`: verify the selected database in staging and deployed smoke tests.

## Unresolved assumptions

- The exact managed PostgreSQL vendor and region remain a `P11-T01` deployment choice.
- The release has not yet proven which retrieval modes require pgvector.
- Recovery point and recovery time objectives remain to be set in Phase 5/9.

## Superseded decisions

None. This ADR replaces informal comments and examples that could be read as allowing SQLite for hosted production.

## Repository evidence reviewed

- `src/core/database/Database.ts`
- `src/core/initialization/ServiceInitializer.ts`
- `.env.example`
- `env.example`
- `docker-compose.yml`
- `docs/DEPLOYMENT_MODES.md`
