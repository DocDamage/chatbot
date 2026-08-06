# P03-T02 — Meaningful Server Coverage Policy Evidence

## Result

- Task: `P03-T02 — Implement meaningful server coverage policy`
- Status: `VERIFIED`
- Tested implementation commit: `b7e81e3935185c06cbaab2fb7e2ee199a69dcaca`
- Branch: `agent/p03-t02-server-coverage-policy`
- Pull request: `#159`
- Verification workflow: GitHub Actions run `31066377115`
- Verification result: all 18 independent jobs and the aggregate required gate passed

## Behavior implemented

The former 1% global Jest threshold was replaced by a machine-readable, risk-based server coverage policy.

The policy now:

- measures all `src/**/*.ts` server source;
- excludes only declarations and test/spec files;
- prohibits the prior broad `!src/**/index.ts` exclusion;
- locks an exact expanded global baseline;
- fails on either a lower percentage or a larger uncovered-item count;
- applies the same no-regression rule to every Tier A and Tier B file;
- inventories 19 Tier A critical-control files;
- defines final Tier A targets of 90% lines and 85% branches;
- binds Tier B to exact `PRODUCTION_SUPPORTED` feature-manifest records;
- defines Tier B targets of 80% lines and 70% branches;
- defines staged global targets of 55/45, 65/55, and final 75/65;
- writes a machine-readable report to `coverage/server-coverage-policy-report.json`;
- prevents a feature from being promoted to `PRODUCTION_SUPPORTED` without explicit Tier B source mapping.

## Honest expanded baseline

The baseline was measured after the coverage scope was expanded, on commit `42ef5cbeb832114cf2e393a6b21bc4840117c55e` in GitHub Actions run `31065400189`.

| Metric | Covered | Total | Baseline |
|---|---:|---:|---:|
| Lines | 7,879 | 20,918 | 37.6661% |
| Branches | 3,109 | 11,326 | 27.4501% |
| Functions | 1,719 | 4,624 | 37.1756% |
| Statements | 8,319 | 22,562 | 36.8717% |

The task does not claim that the final global or Tier A targets have already been reached. Stage 1 prevents regression while later authorized tasks add meaningful behavioral tests and ratchet the policy forward.

## Explicit remaining coverage gaps

Five Tier A critical-control files had zero measured coverage at the locked baseline:

- `src/middleware/apiKeyAuth.ts`
- `src/middleware/security.ts`
- `src/core/upload/FileProcessor.ts`
- `src/core/audit/AuditLogger.ts`
- `src/core/config/ProfileManager.ts`

These files remain measured, reported, and release-blocking gaps. They were not excluded or represented as complete.

No feature is currently classified `PRODUCTION_SUPPORTED`, so Tier B correctly has no active feature or file mappings. Any future promotion requires manifest and policy updates in the same change.

## Verification

GitHub Actions run `31066377115` passed:

- repository policy tests;
- dependency and lockfile verification;
- server, client, and test TypeScript checks;
- server and client lint;
- server security tests;
- server route and service tests;
- server coverage and policy enforcement;
- client tests and coverage;
- client accessibility checks;
- browser E2E smoke;
- PostgreSQL and SQLite migration checks;
- package smoke;
- container build and smoke;
- documentation validation;
- release-evidence structure validation;
- aggregate required gate.

The server coverage job completed with 126 passing suites and 394 passing tests and accepted the locked Stage 1 policy.

## Gate integrity

No test was deleted or skipped, no threshold was lowered to make CI pass, and no risky source was hidden from the report. The implementation expands measured source and records lower honest percentages rather than preserving the former false-green number.
