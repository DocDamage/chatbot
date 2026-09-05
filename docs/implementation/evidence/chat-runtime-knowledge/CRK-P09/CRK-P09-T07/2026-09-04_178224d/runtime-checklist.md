# Runtime Task Checklist — CRK-P09-T07: Authority, Freshness, Quality & Version Compatibility Exit Gate

## Phase 09 Definition of Done & Exit Gate (§1992-1998)

### Implementation
- [x] Baseline source authority tiers and calibration model implemented (`src/types/retrieval-scoring.ts`, `src/core/knowledge/SourceAuthorityPolicy.ts`).
- [x] Freshness scorer with domain-dependent half-lives and exponential decay `exp(-ageDays / halfLifeDays)` implemented (`src/core/knowledge/FreshnessScorer.ts`).
- [x] Version compatibility evaluator with strict semver matching implemented (`src/core/knowledge/VersionCompatibilityEvaluator.ts`).
- [x] Quality scorer evaluating positive indicators and spam/minification penalties implemented (`src/core/knowledge/QualityScorer.ts`).
- [x] Versioned `RetrievalPolicyEngine` implementing composite weighting formula implemented (`src/core/knowledge/RetrievalPolicyEngine.ts`).
- [x] Conflict resolver preserving conflict audit records and signaling material uncertainty implemented (`src/core/knowledge/RetrievalConflictResolver.ts`).
- [x] Source-size rule satisfied (all production files <= 150 lines, strictly under 300-line ceiling).

### Tests & Verification
- [x] Authority, version, and freshness evaluated as separate signals (§1994).
- [x] Retrieval policy is versioned and modular (§1995).
- [x] Version-conflict benchmark passes (§1996):
  - [x] Godot 3 answer does not outrank Godot 4.7 docs for a 4.7 project (§1986).
  - [x] Random blog does not outrank official TypeScript docs (§1987).
  - [x] Old Stack Overflow workaround does not outrank fixed current API docs (§1988).
  - [x] Irrelevant high-authority source does not beat highly relevant lower source (§1989).
  - [x] Stale source can still win when user explicitly asks for historical version (§1990).
- [x] Old high-similarity content no longer dominates current technical answers (§1997).
- [x] Full type check (`npm run type-check`: 0 errors).
- [x] Linter (`npm run lint:server`: 0 warnings/errors).
