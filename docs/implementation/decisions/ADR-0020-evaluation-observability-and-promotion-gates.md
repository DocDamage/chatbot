# ADR-0020: Evaluation, Observability, and Promotion Gates

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-10
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-10 delivers the evaluation suites, observability infrastructure, SLO/SLI tracking, and automated promotion gate engine for Capability Fusion.

1. **Cross-Capability Evaluation Suites (`CapabilityEvaluationSuite`)**:
   Provides objective, reproducible evaluation runners covering all 10 domain areas in the Capability Fusion roadmap:
   - `path_containment_and_secret_denial`: Enforces `ApprovedRepositoryGateway` boundary, directory traversal blocks, and secret token denial.
   - `architecture_graph_determinism_and_recall`: Validates stable topological sorting and SHA-256 graph digest determinism.
   - `lexical_hybrid_retrieval_ranking`: Calibrates BM25 lexical and dense retrieval ranking and injection defenses.
   - `provider_routing_and_resource_exhaustion`: Enforces VRAM, RAM, latency bounds, and telemetry fallbacks.
   - `agent_team_isolation_and_merge_conflicts`: Validates worktree isolation and concurrent patch collision handling.
   - `browser_origin_and_state_change_policy`: Enforces URL origin allowlists and exact-scope confirmation gates.
   - `media_consent_egress_and_cleanup`: Validates consent record digests, blocks unauthorized voice cloning, and cleans up artifacts.
   - `deterministic_game_replay`: Verifies PRNG seed replay consistency and asset resource envelopes.
   - `hosted_mode_denial`: Enforces strict denial of local child processes and loopback probes in hosted profile.
   - `sanitized_logs_and_support_bundles`: Redacts API keys, tokens, emails, and PII prior to diagnostic export.

2. **Observability & Service Level Objectives (`CapabilityObservabilityService`)**:
   - Aggregates live latency (p50/p95/p99), success rates, and cost estimates.
   - Tracks error budgets across key SLOs (Availability >= 99.5%, P95 Latency < 500ms, Privacy & Safety = 100%).
   - Generates scrubbed, privacy-preserving Diagnostic Support Bundles with verifiable SHA-256 digests.

3. **3-Stage Promotion Engine & Decision Records (`CapabilityPromotionEngine`)**:
   - Enforces the 3-stage capability promotion lifecycle:
     - **Stage 1 (`DISABLED` -> `LOCAL_ONLY_EXPERIMENTAL`)**: Requires unit/integration test pass and documented canary.
     - **Stage 2 (`LOCAL_ONLY_EXPERIMENTAL` -> `PRODUCTION_PREVIEW`)**: Requires accessible UI, complete documentation, benchmark score >= 90%, and healthy SLOs.
     - **Stage 3 (`PRODUCTION_PREVIEW` -> `PRODUCTION_SUPPORTED`)**: Requires full production verification gate pass, signed ADR, and release candidate commit certification.
   - Generates immutable cryptographically signed `PromotionDecisionRecord` logs.
   - Supports automated rollback execution upon SLO breach or degradation.

4. **Capability Hub UI Integration (`CapabilityPromotionView`)**:
   - Provides an accessible interactive dashboard for executing evaluation suites, inspecting SLO gauges, and exporting support bundles.

## Security & Privacy Invariants

- **Zero Secret Leaks**: All telemetry and diagnostic bundles run through automated secret and PII scrubbers.
- **Role-Based Promotion Authority**: Promotion actions require `developer` or `admin` roles; unauthorized promotion attempts fail closed.
- **Cryptographic Audit Trail**: Every evaluation run, support bundle, and promotion decision produces a deterministic SHA-256 digest.
