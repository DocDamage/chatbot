# P02-T06 Commands

Run `31033387341` tested exact implementation commit `a0d159dd0eff1991a9a7400664e2eef0286e77a2`.

| Command | Exit code | Evidence source |
|---|---:|---|
| `npm run check:env` | 0 | child of successful `npm run check:phase2` |
| `npm run type-check:server` | 0 | `Type check (server)` |
| `npm run type-check:tests` | 0 | `Type check (tests)` |
| `npm run test:coverage -- --runInBand` | 0 | includes `ConfigValidator.test.ts` |
| `npm run smoke:package` | 0 | `Packaging smoke` |
| `npm run check:phase2` | 0 | `Repository integrity` |
