# P03-T03 Verification Commands

| Command or gate | Exit code | Result |
|---|---:|---|
| GitHub Actions run `31069162209` | 0 | Passed |
| `node --test scripts/release/__tests__/client-coverage-policy.test.mjs` | 0 | 8 policy tests passed |
| `npm --prefix client run coverage` | 0 | 29 client test files, 76 tests, coverage policy passed |
| Client type check and lint | 0 | Passed |
| Repository inventory generation/currentness checks | 0 | Passed |
| Security, route, service, and E2E smoke checks | 0 | Passed |
| Package and container smoke | 0 | Passed |
| Migration and release-evidence checks | 0 | Passed |
| Aggregate required gate | 0 | Passed |
