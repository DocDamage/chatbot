# P02-T04 Commands

Run `31033387341` tested exact implementation commit `a0d159dd0eff1991a9a7400664e2eef0286e77a2`.

| Command | Exit code | Evidence source |
|---|---:|---|
| `npm run test:release-tools` | 0 | `Repository integrity` Phase 2 policy step |
| `npm run check:file-size` | 0 | child of successful `npm run check:phase2` |
| `npm run check:phase2` | 0 | `Repository integrity` |
| `bash scripts/release/verify-repository-integrity.sh` | 0 | `Verify repository integrity` |
