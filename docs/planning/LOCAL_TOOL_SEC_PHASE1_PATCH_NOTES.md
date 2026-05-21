# Local Tool + SEC Phase 1 Patch Notes

Status: Patch created
Date: 2026-05-21

## Implemented in this patch

- Added full-scale expansion planning document.
- Added expansion schema definitions for:
  - tool catalog
  - tool capabilities
  - tool replacement maps
  - tool install profiles
  - local executable registry
  - local tool run audit log
  - SEC companies
  - SEC filings
  - SEC filing documents
  - SEC filing sections
  - SEC filing chunks
  - SEC XBRL facts
  - SEC watchlists
  - SEC ingestion runs
  - SEC source citations
  - education sources
  - education plans
  - education flashcards
  - education quizzes
- Added expansion database bootstrap helper.
- Added editable tool catalog service with required seed records.
- Added local executable detection and run-planning service.
- Added SEC foundation service with status/search/planned-ingestion behavior.
- Added education foundation service with seeded learning sources and draft plan creation.
- Added routes for:
  - `/api/local-tools/detect`
  - `/api/local-tools/executables`
  - `/api/local-tools/run/plan`
  - `/api/tool-catalog`
  - `/api/tool-catalog/stats`
  - `/api/sec/status`
  - `/api/sec/companies/search`
  - `/api/sec/ingest/plan`
  - `/api/education/sources`
  - `/api/education/stats`
  - `/api/education/plans`
- Registered new routes in the route manifest as developer-only audited routes.
- Added Docker Compose for local PostgreSQL + pgvector and Redis.
- Added `.env.example` for local full-scale configuration.
- Updated `.gitignore` to keep private local tools and bundles out of Git.
- Updated route manifest test coverage for the new route groups.

## Intentionally not implemented yet

This is Phase 1 foundation. It does not claim completion of the full-scale system.

Not done yet:

- Live SEC EDGAR downloader.
- SEC rate-limited API client.
- SEC filing parser.
- XBRL parser.
- Full-scale SEC bulk ingestion.
- Actual external executable execution.
- Aseprite CLI wrapper.
- Aseprite/LibreSprite/Pixelorama fallback execution.
- Sprite Lab UI.
- 3D Asset Lab UI.
- Education Builder UI.
- Audio MIDI/pattern generation.

## Required verification

Run these after pulling the patch locally:

```bash
npm install
cd client && npm install && cd ..
docker compose up -d
cp .env.example .env
npm run type-check
npm test -- --runInBand
npm run build
```

Manual smoke checks:

```text
GET /api/tool-catalog
GET /api/local-tools/detect
GET /api/local-tools/executables
GET /api/sec/status
POST /api/sec/ingest/plan
GET /api/education/sources
```

All privileged routes require the existing developer/admin auth flow.

## Next implementation step

Phase 2 should implement the real `LocalToolRunner` execution bridge with:

- typed command templates,
- per-tool risk profiles,
- session approvals,
- output capture,
- execution timeout,
- stdout/stderr artifact files,
- workspace path enforcement,
- UI approval controls.
