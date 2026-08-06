# P03-T04 Verification Commands

| Command or gate | Exit code | Result |
|---|---:|---|
| GitHub Actions run `31074967710` | 0 | All independent jobs and aggregate required gate passed |
| `npm --prefix client run test:a11y:unit` | 0 | 4 files / 13 tests passed |
| `npm --prefix client run test:a11y:e2e` | 0 | 5 Chromium Playwright/Axe workflows passed |
| Client, server, and test type checks | 0 | Passed |
| Client and server lint | 0 | Passed |
| Node 22/24 dependency and lockfile integrity | 0 | Passed |
| Server and client coverage enforcement | 0 | Passed |
| Security, route, service, migration, and existing E2E smoke | 0 | Passed |
| Package, container, Pages, repository, environment, docs, and evidence gates | 0 | Passed |
| Aggregate required gate | 0 | Passed |
