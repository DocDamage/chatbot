# P01-T06 Commands and Workflow Results

## Repository inspection

```text
GitHub API: GET /repos/DocDamage/chatbot/branches/main
Result: main at c0725407eb55575330fcde22e39e784c28395090

GitHub contents: docs/implementation/handoffs/CURRENT_HANDOFF.md
Result: P01-T05 VERIFIED; only P01-T06 authorized

GitHub contents: .github/workflows/ci.yml
Result: one sequential test job; later stages depended on all earlier steps succeeding
```

## Preserved commands now executed independently

```bash
bash scripts/release/verify-repository-integrity.sh
node scripts/release/verify-ci-graph.mjs
npm run type-check:server
npm run type-check:tests
npm run type-check:client
npm run lint:server
npm run lint:client
npm run test:security -- --runInBand
npm run test:routes -- --runInBand
npm run test:services -- --runInBand
npm run test:e2e -- --runInBand
npm run test:coverage -- --runInBand
npm run test                         # client working directory
npm run coverage                     # client working directory
npm run a11y                         # client working directory
npm run smoke:package
```

## GitHub Actions verification

| Purpose | Commit | Run | Result | Jobs | Required gate |
|---|---|---:|---|---:|---|
| Positive split-workflow proof | `74e28efada13c5aa24ec3978b9904668f837fb6c` | `31017213617` | success | 16 | `92345163361` success |
| Controlled failure-isolation proof | `8d29a1d2b84f555eb5ab014d870bede25d3f8539` | `31017534074` | expected failure | 16 | `92346297194` expected failure |
| Final restored implementation | `7e95e339aa7e5d661bbe67ccad98418cbfbd2960` | `31017624960` | success | 16 | `92346631141` success |

## Negative probe details

The probe changed only the security step to run the real security command and then exit 17. The security job failed as intended. All other diagnostics still ran to completion, and the unconditional aggregate gate rejected the run. The probe change is not present in the verified implementation commit.
