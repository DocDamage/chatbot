# Changelog

## [1.1.0] - 2026-08-24

### Added
- **Capability Fusion Framework (CF-01 through CF-10)**:
  - **CF-01 (Architecture Graphs)**: Native architecture graph visualization, topology mapping, and reachability analysis.
  - **CF-02 (Lexical Search Engine)**: Clean-room BM25 and proximity retrieval engine for offline and hybridized RAG.
  - **CF-03 (Repository Findings & CycloneDX SBOM)**: Automated vulnerability and finding overlays, SARIF ingestion, and CycloneDX v1.5 SBOM generators.
  - **CF-04 (Local Model Adapter & Hardware Canary)**: `ExternalLocalModelAdapter` integrated with `UniversalLLM`, SSRF protection policies, VRAM leasing, and `LocalHardwareCanary`.
  - **CF-05 (Typed Agent Teams, Git Worktrees & Process Supervisor)**: `AgentTeamCoordinator` DAG scheduling, cryptographic `TaskEnvelope`, native `git worktree` isolation, and bounded `ProcessTreeSupervisor` with tree termination.
  - **CF-06 (Transparent Browser Jobs & Playwright Engine)**: `PlaywrightBrowserDriver` with persistent context profiling, automatic trace `.zip` recording, video capture, origin allowlists, and state-changing approval gates.
  - **CF-07 (Consent-Aware Video Localization & FFmpeg Adapter)**: 12-stage media localization pipeline, `MediaConsentRecord` cryptographic verification, and `ProductionMediaEngineAdapter`.
  - **CF-08 (Lattice Game Development Kit)**: Deterministic Mulberry32 simulation engine, isometric SVG/ASCII visualizers, and agent tool definitions (`simulate_lattice_game`, `render_lattice_scenario`).
  - **CF-09 (Unified Capability Hub & Stock Client Auth)**: Interactive `CapabilityHubPanel`, exact-scope confirmation modals with WCAG 2.1 AA focus-trapping, and authenticated JWT Bearer API client.
  - **CF-10 (Persistent Observability & Rollback Gates)**: Append-only disk persistence (`CapabilityPersistenceStore`), `AlertNotificationDispatcher` webhooks, SLO tracking, and automated degradation rollbacks.
  - **Canary Certification Suite**: `CanaryCertificationSuite` validating all 7 operational pillars with SHA-256 evidence digests.

### Changed
- Upgraded `UniversalLLM` to dynamically register and route requests to `ExternalLocalModelAdapter` in local environments.
- Upgraded `WorktreeLifecycleService` to support native Git worktrees with directory fallback.
- Added JWT authentication header attachment across all frontend Capability Hub and Promotion API calls.
- Updated `.gitignore` to protect runtime persistence stores (`.capabilities/`, `.worktrees/`).

### Verified
- 182 test suites passed (696 tests, 0 failures).
- 31 client Vitest test files passed (96 tests).
- Server, client, and test TypeScript compilation 100% clean.
- Production build and packaging smoke checks 100% clean.
