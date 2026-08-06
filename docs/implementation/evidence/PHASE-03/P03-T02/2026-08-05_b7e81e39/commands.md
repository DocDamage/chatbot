# P03-T02 Verification Commands

## Expanded baseline audit

| Command or workflow step | Exit code | Result |
|---|---:|---|
| `npm run test:coverage -- --runInBand` on audit commit `42ef5cbeb832114cf2e393a6b21bc4840117c55e` | 0 | Measured the expanded all-server-source baseline in GitHub Actions run `31065400189` |
| `npm run test:release-tools` | 0 | Coverage-policy unit tests passed |

## Clean implementation candidate

GitHub Actions run `31066377115` tested commit `b7e81e3935185c06cbaab2fb7e2ee199a69dcaca`.

| Command or required job | Exit code | Result |
|---|---:|---|
| `npm ci` | 0 | Lockfile installation passed |
| `npm --prefix client ci` | 0 | Client lockfile installation passed |
| `npm run test:release-tools` | 0 | Release-policy tests passed |
| `npm run type-check:server` | 0 | Passed |
| `npm run type-check:tests` | 0 | Passed |
| `npm run type-check:client` | 0 | Passed |
| `npm run lint:server` | 0 | Passed |
| `npm run lint:client` | 0 | Passed |
| `npm run test:security -- --runInBand` | 0 | Passed |
| `npm run test:routes -- --runInBand` | 0 | Passed |
| `npm run test:services -- --runInBand` | 0 | Passed |
| `npm run test:coverage -- --runInBand` | 0 | 126 suites and 394 tests passed; server coverage policy passed |
| `npm --prefix client test` | 0 | Passed |
| `npm --prefix client run coverage` | 0 | Passed |
| `npm --prefix client run a11y` | 0 | Passed |
| browser E2E smoke job | 0 | Passed |
| PostgreSQL migration job | 0 | Passed |
| SQLite migration job | 0 | Passed |
| `npm run smoke:package` | 0 | Passed |
| container build and smoke job | 0 | Passed |
| `npm run check:docs` | 0 | Passed |
| `node scripts/release/check-release-evidence.mjs` | 0 | Evidence structure validation passed |
| aggregate required gate | 0 | All required jobs passed |

## Generated report

The coverage command writes:

`coverage/server-coverage-policy-report.json`

The report records global counts, active and future milestones, Tier A and Tier B source records, target gaps, violations, and pass/fail state.
