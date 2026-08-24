# Repository Architecture Snapshot Schema

## Status and boundary

- Schema version: `1.0.0`
- Capability workstream: `CF-01`
- Runtime status: `LOCAL_ONLY_EXPERIMENTAL`
- Analysis mode: bounded static text analysis
- Repository code execution: prohibited
- Default generated-source behavior: excluded

The snapshot is provider-neutral and independent of any graph renderer. It is produced only from files reachable through `ApprovedRepositoryGateway` and contains repository-relative paths.

## Determinism

For identical approved input and options:

- node and edge identifiers are SHA-256-derived from normalized structural identity;
- nodes, edges, evidence, warnings, entrypoints, and parser health are sorted;
- `repositoryVersion` is derived from analyzed file paths, byte sizes, and content digests;
- `snapshotDigest` covers the canonical snapshot payload;
- the default `generatedAt` is the canonical timestamp `1970-01-01T00:00:00.000Z`;
- operational cache hit/miss counters are returned separately from the snapshot and do not change its digest.

Callers may supply a real generation timestamp for an exported artifact, but doing so intentionally changes `snapshotDigest`.

## Node kinds

- `repository`
- `project_root`
- `package`
- `module`
- `file`
- `symbol`
- `api_route`
- `database_table`
- `migration`
- `test`
- `build_target`
- `external_dependency`

## Edge kinds

- `contains`
- `imports`
- `references`
- `calls`
- `implements`
- `extends`
- `tests`
- `registers_route`
- `reads_table`
- `writes_table`
- `creates_table`
- `builds`
- `depends_on`

Every node and edge may carry sorted source evidence with repository-relative file, line, parser, confidence, and a short detail. Parser health records grammar/recovery use and confidence rather than presenting fallback results as grammar-backed certainty.

## Resource limits

The builder enforces bounded values for:

- discovered and analyzed files;
- bytes per file and total bytes;
- symbols;
- edges;
- repository path depth;
- query traversal depth;
- query result nodes.

Generated/vendor/build outputs are excluded by default and require an explicit opt-in. Binary and oversized files are represented only by safe metadata when possible. Limit and parser conditions are surfaced as structured warnings.

## Queries

`RepositoryArchitectureQuery` supports:

- ranked node find;
- cycle-safe neighborhood traversal;
- reverse dependency traversal;
- test impact discovery;
- entrypoint reachability.

Queries are bounded by the snapshot limits and return node/edge identifiers, truncation state, reached depth, and warnings. Repository tools expose summary output by default and require explicit full detail, with separate response caps and evidence opt-in.

## Compatibility policy

Additive fields may be introduced within schema `1.x` only when old readers can safely ignore them. Renaming or changing the meaning of node kinds, edge kinds, identity inputs, or required fields requires a schema version change and migration tests.


## Scoped symbol resolution and ambiguity

A symbol relationship is identified from the normalized repository path, project/module scope, language, symbol kind, and source location—not from its display name alone. A same-name symbol in a different file, language, module, or lexical scope is a valid distinct definition. Resolution may select a target only when scoped evidence yields one deterministic target. When candidates remain genuinely ambiguous, the graph emits an `AMBIGUOUS_SYMBOL_REFERENCE` warning and does not create a relationship edge to an arbitrary definition.
