# P01-T01 Commands

| Command | Exit code | Result |
|---|---:|---|
| `npm ci` | 0 | Passed |
| `npm --prefix client ci` | 0 | Passed |
| `npm run type-check:server` | 0 | Passed |
| `npm run type-check:tests` | 0 | Passed |
| `npm run type-check:client` | 0 | Passed |
| `npm run lint:server` | 0 | Passed |
| `npm run lint:client` | 0 | Passed |
| `npm run test:security -- --runInBand` | 0 | Passed |
| `npm run test:routes -- --runInBand` | 0 | Passed |
| `npm run test:services -- --runInBand` | 0 | Passed |
| `npm run test:e2e -- --runInBand` | 0 | Passed |
| `npm run test:coverage -- --runInBand` | 0 | Passed |
| `npm --prefix client test` | 0 | Passed |
| `npm --prefix client run build` | 0 | Passed |

The user-supplied standalone client-only `npm run build` returned exit code 2 with 14 `TS2304` errors. That environment did not have the root package's Node declarations available.
