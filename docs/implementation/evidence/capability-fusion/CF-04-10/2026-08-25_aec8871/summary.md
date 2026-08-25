# CF-04 through CF-10 local release verification

Status: `AUTOMATED_RELEASE_VERIFIED_PENDING_HUMAN_REVIEW_AND_EXTERNAL_CANARIES`.

Implementation checkpoint: `aec8871623870623204bc93e90ebeb52dd51aea0`.

The unchanged server and client coverage policies now pass. This increment adds behavior-focused tests for capability routes and cancellation, browser drivers, agent-team coordination, provider discovery/routing and streaming, localization stage cancellation, promotion and observability gates, multi-provider orchestration, image processing with and without optional native dependencies, critical configuration validation, Knowledge OS UI workflows, curated utilities, and Capability Hub workspace navigation.

The complete local release sequence passed when evaluated as `release:check` followed by the regenerated governed inventory and `check:phase2`. Server type checks, test type checks, lint, release/security/routes/services/E2E tests, browser E2E, global coverage and Tier A policy, client type checks/lint/tests/coverage/accessibility, package smoke, inventory, reachability, file-size, environment, and documentation checks all pass.

## Exact coverage

- Server statements: `16447/29929` covered; `13482 <= 14243` uncovered.
- Server branches: `7400/15568` covered; `8168 <= 8217` uncovered.
- Server lines: `15208/27380` covered; `12172 <= 13039` uncovered.
- Server functions: `3316/6126` covered; `2810 <= 2905` uncovered.
- Client statements: `1437/2440` covered; `1003 <= 1047` uncovered.
- Client branches: `1013/1843` covered; `830 <= 830` uncovered.
- Client lines: `1335/2144` covered; `809 <= 848` uncovered.
- Client functions: `426/794` covered; `368 <= 414` uncovered.

Thresholds, source mappings, exclusions, maturity, and hosted-mode boundaries were not weakened. GitHub Required CI run `32877962271` passed on evidence-bearing head `cff8c72db7d3eb815cefcc40ef76f6dca31a397f`, including the final Required CI gate. Independent human review is now the remaining merge gate. Real hardware, native cross-platform, media-rights/quality, manual accessibility, and hosted-production canaries remain external gates.
