# CF-04 through CF-10 integration checkpoint evidence

Status: `IMPLEMENTED_NOT_VERIFIED`.

The existing CF-04 through CF-10 work was ported from `codex/cf03-findings` onto current `main` in `codex/cf04-cf10-integration`. Conflict resolution retained the newer merged CF-03 implementation and regenerated repository inventory, reachability, and CycloneDX SBOM artifacts.

Implementation checkpoint: `315e5db457195f24b0a0d228d4ee5a684d2dfd1f`.

## Result

Type checks, lint, focused capability tests, focused client tests, built-server browser E2E, and all executed server tests passed. The full release command failed at the unchanged uncovered-count policy. Therefore the candidate is not merge-ready, release-verified, or eligible for maturity promotion.

## Blocking coverage delta

- Statements: `14520` uncovered; maximum `14243` — 277 over.
- Branches: `8853` uncovered; maximum `8217` — 636 over.
- Lines: `13132` uncovered; maximum `13039` — 93 over.
- Functions: `2997` uncovered; maximum `2905` — 92 over.

Thresholds and exclusions were not changed.
