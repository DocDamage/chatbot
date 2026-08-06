# P02-T01 Commands

GitHub Actions run `31033387341` tested exact commit `a0d159dd0eff1991a9a7400664e2eef0286e77a2`. A successful shell step has exit code `0`; `check:phase2` uses `&&`, so every listed child command also returned `0`.

| Command | Exit code | Evidence source |
|---|---:|---|
| `npm run test:release-tools` | 0 | `Repository integrity` → `Verify Phase 2 repository policy` |
| `npm run check:inventory` | 0 | same successful `check:phase2` step |
| `npm run check:phase2` | 0 | same job and step |
| `npm run type-check:server` | 0 | `Type check (server)` |
| `npm run smoke:package` | 0 | `Packaging smoke` |
