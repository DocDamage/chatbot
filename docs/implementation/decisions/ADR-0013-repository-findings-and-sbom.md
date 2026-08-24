# ADR-0013: Repository findings, SARIF, and SBOM data

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion Milestone B / CF-03
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-03 provides evidence-linked signals, not vulnerability verdicts. Findings declare a severity, confidence, evidence location and digest, provenance, and one of `signal`, `suspected_weakness`, `confirmed_defect`, or `accepted_risk`. Suppressions are per-finding and carry an audit reason.

SARIF intake accepts only version 2.1.0 and repository-relative paths. The project produces deterministic CycloneDX 1.5 JSON from `package.json` through `ApprovedRepositoryGateway`; an external vulnerability scanner remains responsible for vulnerability claims.

The overlay data model is UI-neutral and supports an accessible table/2D graph pair. It joins findings with ownership, churn, test-gap, and trust-boundary metadata. It intentionally does not provide a 3D-only view.

## Boundaries

No GitGalaxy source, tests, comments, or internal structures are copied. This subsystem reads only through `ApprovedRepositoryGateway`, executes no analyzed code, and does not grant write, command, browser, Git, process, hosted-filesystem, or vulnerability-proof authority.

