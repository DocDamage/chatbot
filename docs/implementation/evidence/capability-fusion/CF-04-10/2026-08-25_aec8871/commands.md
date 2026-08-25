# Commands

```text
npm test -- --runInBand --runTestsByPath <focused server suites>
npm run type-check:tests
npm run test:coverage
npm run verify:release
npm run inventory:generate
npm run check:phase2
cd client && npm run coverage
git diff --check
```

`npm run verify:release` passed `release:check` and initially stopped at the expected stale-inventory check after new test modules changed reachability. `npm run inventory:generate` refreshed all four governed artifacts, and `npm run check:phase2` then passed in full.
