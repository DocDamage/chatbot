# ADR-0012: Clean-room lexical repository retrieval

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion Milestone A
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

Repository lexical retrieval is implemented as a project-owned TypeScript provider. It uses the published Okapi BM25 scoring model and independently designed token, phrase, proximity, generation, and fusion contracts.

Every discovery and source read goes through `ApprovedRepositoryGateway`. The provider does not execute repository code, package scripts, compilers, or build tools. It is bounded by configured file, byte, token, posting, query, and result limits; supports cancellation; activates only fully constructed immutable generations; and returns source digest, repository version, generation, range, score components, reasons, and warning state.

## Provenance and license boundary

SearchEngineSuite was assessed without a reusable repository license. No SearchEngineSuite source, tests, comments, names, internal structure, or line-by-line translation is used. The source basis is published BM25 algorithm literature and project-owned design and tests. Optional structural and vector inputs are provider-neutral and cannot grant filesystem, command, write, browser, process, Git, or hosted-filesystem authority.

## Consequences

Lexical search remains useful when optional structural or vector providers are unavailable; their absence is reported as a warning rather than represented as success. Existing literal repository search remains available as a comparison/fallback baseline.
