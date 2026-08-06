# P03-T02 Runtime Checklist

## Runtime QA requirement

Direct user-facing runtime QA is not required for this task because P03-T02 changes CI coverage measurement and enforcement rather than application behavior, routes, persistence, or UI.

## Regression safety executed

- [x] Server coverage test suite passed.
- [x] Existing security, route, service, and E2E suites passed.
- [x] Client unit, coverage, and accessibility checks passed.
- [x] Production package build and smoke passed.
- [x] Production container build and smoke passed.
- [x] PostgreSQL and SQLite migration checks passed.
- [x] Aggregate required gate passed.

## Policy runtime behavior

- [x] `npm run test:coverage -- --runInBand` runs Jest coverage and the policy checker as one gate.
- [x] A machine-readable report is written to `coverage/server-coverage-policy-report.json`.
- [x] The checker accepts the exact locked Stage 1 baseline.
- [x] Unit tests prove that lower percentages fail.
- [x] Unit tests prove that additional uncovered source fails even at an unchanged percentage.
- [x] Unit tests prove Tier A per-file regression fails.
- [x] Unit tests prove final-stage Tier A targets are enforced.
- [x] Unit tests prove a production-supported feature cannot exist without Tier B source mapping.
- [x] Unit tests prove broad `index.ts` exclusion is rejected.

## Result

`PASSED` — CI policy behavior was exercised on the clean implementation candidate, and the full application regression matrix remained green.
