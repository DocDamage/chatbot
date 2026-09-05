# CF-04 through CF-10 coverage increment 1

Status: `IMPLEMENTED_NOT_VERIFIED`.

Checkpoint: `2007291a9b63d821326e95d0618f8df10e9ced6b`.

This increment adds behavior-focused coverage for browser job integrity, expiry, approval, action dispatch, and budgets; Capability Registry diagnostics and Capability Job Manager terminal guards; evaluation-suite aggregation and reporting; and Lattice action, combat, win/loss, and resource-budget behavior.

All 182 executed server suites and 720 tests passed, with 2 tests skipped. The unchanged uncovered-count policy still fails, so the integration remains a draft and is not eligible for merge or maturity promotion.

## Coverage movement

- Statements: `14520` to `14390` uncovered — 130 fewer; 147 remain over budget.
- Branches: `8853` to `8728` uncovered — 125 fewer; 511 remain over budget.
- Lines: `13132` to `13019` uncovered — 113 fewer; policy now passes with 20 lines of headroom.
- Functions: `2997` to `2979` uncovered — 18 fewer; 74 remain over budget.

Thresholds, source mappings, and exclusions were not changed.
