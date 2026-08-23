# CF-00 Verification Commands

All commands completed successfully in GitHub Actions CI run `32668575991` against commit `58dd3ec1076928a973496c63daa72cba52e77db3`.

| Command or gate | Result |
|---|---:|
| `bash scripts/release/verify-repository-integrity.sh` | `0` |
| `node scripts/release/verify-ci-graph.mjs` | `0` |
| `npm ci` and `npm --prefix client ci` | `0` |
| Lockfile zero-diff gate | `0` |
| `npm run type-check` on Node 22 and Node 24 | `0` |
| Server, client, and test type checks | `0` |
| Server and client lint | `0` |
| Route and service integration tests | `0` |
| Client unit/component tests | `0` |
| `npm run test:e2e` | `0` |
| Client accessibility gate | `0` |
| Security tests | `0` |
| Server and client coverage enforcement | `0` |
| SQLite migration test | `0` |
| `bash scripts/release/smoke-container.sh` | `0` |
| `npm run smoke:package` | `0` |
| Release scanner tests | `0` |
| Repository inventory regeneration and zero-diff gate | `0` |
| Inventory, reachability, file-size, environment, and docs checks | `0` |
| Release-evidence validation | `0` |
| Required CI gate | `success` |

## Focused test

`src/core/coding/security/ApprovedRepositoryGateway.test.ts` is included in the passing server coverage suite. It covers approved listing, absolute/traversal/null/sensitive denial, symlink/junction denial, bounded reads, binary refusal, bounded search metadata, and agent-tool failure at the common boundary.
