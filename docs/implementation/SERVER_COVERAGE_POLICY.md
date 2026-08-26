# Server Coverage Policy

## Purpose

Server coverage is a release control, not a vanity percentage. The policy prevents the repository from appearing healthy while security-sensitive or production-supported code is omitted from measurement.

The machine-readable source of truth is:

`config/server-coverage-policy.json`

The enforcement implementation is:

- `jest.config.js`
- `scripts/release/run-server-coverage.mjs`
- `scripts/release/check-server-coverage.mjs`
- `scripts/release/lib/server-coverage-policy.mjs`

## Coverage scope

The gate measures all TypeScript beneath `src/`.

The only permitted exclusions are:

- declaration files;
- test directories;
- `*.test.ts` files;
- `*.spec.ts` files.

Production entry points and barrel files are not broadly excluded. In particular, `src/**/index.ts` is measured because that pattern includes the real server startup path and other production registration code.

A new exclusion must be added to both `collectCoverageFrom` and `allowedExclusions`. The policy checker rejects unapproved exclusions and specifically rejects the former broad `index.ts` exclusion.

## Active stage

The active stage is `stage-2`.

The Stage 2 candidate baseline was measured locally on the profile-expansion working tree based on commit `55dbcd0a2af1bd4c26f1f28aae7b3e3d6823f7f2`. The policy records that the tree contained the reviewed expansion changes; the `commit` field must be replaced with the final candidate SHA when those changes are committed.

| Metric | Covered | Total | Baseline |
|---|---:|---:|---:|
| Lines | 22,406 | 36,775 | 60.9273% |
| Branches | 9,731 | 19,953 | 48.7696% |
| Functions | 4,366 | 7,634 | 57.1915% |
| Statements | 24,035 | 40,017 | 60.0620% |

The active gate enforces no regression against all four global metrics and against every listed Tier A file. A change that increases uncovered production source without sufficient tests fails the coverage job.

The final audited worktree improves on that locked baseline: 23,085/37,301 lines (61.8884%), 10,197/20,403 branches (49.9779%), 4,532/7,766 functions (58.3569%), and 24,798/40,642 statements (61.0157%). The locked baseline remains unchanged so the added implementation cannot consume the prior uncovered-code budget.

## Global progression

| Stage | Minimum lines | Minimum branches | Enforcement |
|---|---:|---:|---|
| Stage 1 | Locked historical baseline | Locked historical baseline | Passed |
| Stage 2 | 55% | 45% | Active |
| Stage 3 | 65% | 55% | Future ratchet |
| Final | 75% | 65% | Release target |

The active stage may move forward only after the candidate commit passes the next threshold. It must not move backward. Lowering a baseline or threshold to make CI pass is prohibited.

## Tier A — critical controls

Tier A contains authentication, authorization, CSRF, browser security, rate limiting, secret handling, path and upload validation, local execution, SSRF protection, database guardrails, audit redaction, and deployment configuration controls.

Final minimums are:

- 90% line coverage;
- 85% branch coverage.

The final target becomes mandatory when the global policy reaches the `final` stage. Until then, each file has an exact no-regression baseline and its target gap remains visible in `coverage/server-coverage-policy-report.json`.

The following Tier A files had zero measured coverage at the locked baseline and remain explicit release gaps:

- `src/middleware/apiKeyAuth.ts`
- `src/middleware/security.ts`
- `src/core/upload/FileProcessor.ts`
- `src/core/audit/AuditLogger.ts`
- `src/core/config/ProfileManager.ts`

They are not excluded, waived, or represented as complete. Later security and feature tasks must add meaningful behavioral tests and ratchet their stored baselines upward.

## Tier B — production-supported routes and services

Tier B applies to source files backing features classified `PRODUCTION_SUPPORTED` in `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`.

Minimums are:

- 80% line coverage;
- 70% branch coverage.

The policy checker parses the feature manifest on every run. The gate fails when:

- the manifest contains a `PRODUCTION_SUPPORTED` feature not listed in the policy;
- Tier B has supported feature IDs but no mapped source files;
- a mapped Tier B source file is absent from the coverage report;
- a mapped Tier B file falls below 80% lines or 70% branches;
- a mapped file regresses below its locked baseline.

At the P03-T02 baseline, no feature is classified `PRODUCTION_SUPPORTED`, so Tier B correctly contains no feature IDs or files. Promotion of a feature to production support must update the manifest and policy in the same pull request.

## Experimental and preview source

Experimental or preview code is not hidden from global production coverage. It remains in the all-`src/**/*.ts` global measurement.

If future architecture work removes experimental code from production coverage, the same change must prove that the code is also excluded from production registration/build boundaries and classified outside `PRODUCTION_SUPPORTED`. A coverage-only exclusion is not permitted.

## Commands

Run the full server coverage gate:

```bash
npm run test:coverage -- --runInBand
```

Validate an existing coverage report without rerunning Jest:

```bash
npm run check:server-coverage
```

Run policy unit tests:

```bash
npm run test:release-tools
```

The full gate writes:

`coverage/server-coverage-policy-report.json`

The report contains:

- current and baseline global counts;
- active and future global targets;
- every Tier A and Tier B file;
- current counts and percentages;
- target gaps;
- policy violations;
- pass/fail status.

## Baseline and ratchet procedure

1. Add or improve meaningful behavioral tests.
2. Run the full server coverage command.
3. Confirm no source was removed or excluded merely to improve the percentage.
4. Update a file baseline only upward after reviewing the exact covered/total counts.
5. Move the global stage only when the complete release suite passes the next milestone.
6. Record the tested commit, CI run, commands, and report in the task evidence bundle.
7. Never overwrite a higher baseline with a lower result.

## Prohibited shortcuts

The following do not satisfy this policy:

- lowering thresholds or baselines;
- adding broad source exclusions;
- excluding `index.ts` or route-registration files;
- deleting tests without equivalent coverage;
- replacing runtime behavior tests with mock-only assertions;
- promoting a feature to `PRODUCTION_SUPPORTED` without Tier B mapping;
- counting experimental code as production-supported solely because it compiles;
- reporting the final Tier A or global targets as achieved before the measured report proves it.
