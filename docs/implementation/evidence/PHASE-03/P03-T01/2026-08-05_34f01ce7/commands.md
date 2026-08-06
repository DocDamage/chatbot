# P03-T01 Commands

All commands below were executed by GitHub Actions run `31062952540` against commit `34f01ce7f8aa52b4579b6aa883c8c9c6c7a1a594`.

| Command | Exit code |
|---|---:|
| `bash scripts/release/verify-repository-integrity.sh` | 0 |
| `node scripts/release/verify-ci-graph.mjs` | 0 |
| `npm ci` and `npm --prefix client ci` on Node 22 | 0 |
| `npm ci` and `npm --prefix client ci` on Node 24 | 0 |
| `git diff --exit-code -- package-lock.json client/package-lock.json` | 0 |
| `npm run type-check` on Node 22 and Node 24 | 0 |
| `npm run type-check:server` | 0 |
| `npm run type-check:client` | 0 |
| `npm run type-check:tests` | 0 |
| `npm run lint:server` | 0 |
| `npm run lint:client` | 0 |
| `npm run test:routes -- --runInBand` | 0 |
| `npm run test:services -- --runInBand` | 0 |
| `npm --prefix client run test` | 0 |
| `npm run test:e2e -- --runInBand` | 0 |
| `npm --prefix client run a11y` | 0 |
| `npm run test:security -- --runInBand` | 0 |
| `npm run test:coverage -- --runInBand` | 0 |
| `npm --prefix client run coverage` | 0 |
| `npx jest --runTestsByPath src/core/database/Database.test.ts --runInBand` | 0 |
| `bash scripts/release/smoke-container.sh` | 0 |
| `npm run smoke:package` | 0 |
| `npm run test:release-tools` | 0 |
| `npm run inventory:generate` plus generated-file diff check | 0 |
| `npm run check:inventory` | 0 |
| `npm run check:reachability` | 0 |
| `npm run check:file-size` | 0 |
| `npm run check:env` | 0 |
| `npm run check:docs` | 0 |
| `node scripts/release/check-release-evidence.mjs` | 0 |
| Aggregate `required-gate` | 0 |