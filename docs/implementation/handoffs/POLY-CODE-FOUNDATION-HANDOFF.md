# Polyglot coding foundation handoff

- Objective: implement the repository-aware polyglot coding upgrade plan.
- Scope completed in this change: capability registry, repository snapshot/intelligence, TypeScript AST provider with labeled fallback, relationship queries, structural retrieval, adaptive context allocation, typed controller/request artifacts, natural-language preconditioned editing, safe command capability runner, diagnostics, bounded repair controller, staged review, test strategy, shared coding authorization, knowledge provenance, coding model metadata plus provider-routed structured patch drafting, fixture manifest, and benchmark/toolchain preflight.
- Runtime integration: `CodingAgent`, `EnhancedOrchestrator`, and `src/server/routes/code.ts`.
- Production boundary: coding remains local-only experimental; this handoff does not promote the feature in the production manifest.
- Verification: server and test type-checks, server lint, server build, focused coding/orchestrator/provider tests, and `npm run eval:coding` plus upgraded preflight.
- Known limitations: the benchmark runner currently records fixture/toolchain/check evidence but does not invoke a model or apply generated patches; the full baseline-vs-upgraded correctness comparison, hidden regression scoring, provider-specific AST adapters, and the repository-wide release coverage baseline remain open. The existing release coverage threshold is anchored to an older baseline and the current checkout already exceeds it before this upgrade; it was not weakened.
- Rollback: remove/disable the new coding endpoints/controller integration and retain the existing `CodingAgent`, `CodeReviewer`, `PatchGenerator`, and `VerificationRunner` compatibility paths.
