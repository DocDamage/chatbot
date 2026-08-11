# Polyglot coding upgrade implementation audit

This bundle records the implementation boundary for the polyglot coding upgrade. The exact source SHA used for the checked-in benchmark artifacts is recorded in `baseline/environment.json` and `upgraded/environment.json`.

## Implemented

- Polyglot capability descriptors and repository/build detection for the fixture families.
- Repository snapshots, instruction/manifest evidence, symbol indexing, relationship queries, structural retrieval, and adaptive context allocation.
- Typed coding controller artifacts, preconditioned multi-file structured patches, review, diagnostics, native verification, bounded repair, and shared authorization.
- Provider-routed structured patch drafting with explicit model opt-in, isolated benchmark application, visible/hidden checks, and redacted execution metadata.
- Code routes and client workflow status for draft, approval, verification, review findings, repair, and unverified risks.
- Fixed 27-case fixture manifest with reproducible baseline/upgraded report generation.

## Verification record

- `npm run type-check` — passed.
- `npm run lint:server` and `npm run lint:client` — passed.
- `npm run build` — passed.
- `npm test -- --runInBand` — 148 suites passed, 459 tests passed, 2 skipped.
- `npm run test:security` — 10 tests passed.
- `npm run test:e2e:services` — 5 tests passed.
- `npm run check:phase2` — passed.
- Focused coding benchmark executor and repair tests — passed.

## Explicit limitations

- The live benchmark was attempted with `provider: openai` and `networkPolicy: explicit-live-model-only`; the endpoint returned `429 no credits remaining`, so no provider patch or hidden-regression execution evidence was produced. Preflight evidence remains recorded: 13 ready cases, 14 unsupported cases, and 12 passing checks.
- The current machine reports 13 ready and 14 unsupported fixture toolchains. Unsupported tools are not counted as passes.
- The current checked-in preflight has three hidden checks and zero hidden passes because no model patch was applied.
- Parser support includes the TypeScript AST provider, maintained Tree-sitter grammars for the priority polyglot families, labeled resilient recovery, and explicit fallback behavior; dedicated maintained AST adapters for every listed language are not claimed.
- `npm run release:check` still fails the repository’s existing server coverage threshold; the policy was not weakened. The failure is the uncovered-count threshold, while all collected suites pass.
- Coding remains `LOCAL_ONLY_EXPERIMENTAL` in the production feature manifest; this implementation does not certify the feature for hosted production.
