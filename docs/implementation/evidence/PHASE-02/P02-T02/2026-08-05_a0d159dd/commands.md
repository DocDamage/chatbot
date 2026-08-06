# P02-T02 Commands

Run `31033387341` tested exact commit `a0d159dd0eff1991a9a7400664e2eef0286e77a2`. Successful steps imply exit code `0`.

| Command | Exit code | Evidence source |
|---|---:|---|
| `npm run test:release-tools` | 0 | `Repository integrity` Phase 2 policy step |
| `npm run check:reachability` | 0 | child of successful `npm run check:phase2` |
| `npm run check:phase2` | 0 | `Repository integrity` |
| `npm run type-check:server` | 0 | `Type check (server)` |
| `npm run test:coverage -- --runInBand` | 0 | `Server tests (coverage)` |
