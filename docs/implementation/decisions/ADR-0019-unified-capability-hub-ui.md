# ADR-0019: Unified Capability Hub UI

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-09
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-09 delivers the Unified Capability Hub UI, consolidating all chatbot capabilities, runtime boundaries, job lifecycles, and verification evidence into one accessible, controllable interface.

1. **Structured Capability Registry (`CapabilityRegistry`)**:
   Provides a centralized, profile-aware registry (`/api/capabilities`) mapping every system capability across the 6 mandatory roadmap sections:
   - `available_now`
   - `needs_setup`
   - `local_only`
   - `preview`
   - `disabled_by_policy`
   - `unhealthy_degraded`
   Each capability exposes detailed specifications: processing location (`local`, `hosted`, `hybrid`, `browser`), provider, required dependencies, authority and data egress constraints, health state, cost/resource estimates, and actionable diagnostics for missing dependencies.

2. **Job Lifecycle & Cryptographic Audit Trail (`CapabilityJobManager`)**:
   Tracks execution jobs across capability workstreams (Agent Teams CF-05, Browser Jobs CF-06, Video Localization CF-07, Lattice Game Dev CF-08, Findings Analyzer CF-03).
   Maintains state transitions (`pending_approval`, `running`, `completed`, `failed`, `cancelled`), captured evidence records, cancellation hooks, and SHA-256 audit digest verification.

3. **Accessible 2D Repository Topology & Findings View (`RepositoryFindingsView`)**:
   Renders CF-03 findings and repository structure through an interactive 2D SVG hotspot graph paired with an accessible, screen-reader friendly data table with sortable columns, trust boundary indicators, and test gap signals.

4. **Exact-Scope Confirmation Modal (`ExactScopeConfirmModal`)**:
   Dangerous actions (e.g., disabling security controls or terminating running teams) require explicit, typed phrase confirmation (exact scope) rather than generic consent dialogs.

5. **Plain-Language Onboarding & Isolation Guidance**:
   Explains runtime profile isolation (`hosted` vs `LOCAL_TRUSTED`), data retention policies, and security invariants in plain language without requiring source-code inspection.

## Boundaries and Security Invariants

- **Profile Containment**: In `hosted` mode, local-only capabilities are marked `disabled_by_policy` on both client and server, preventing arbitrary child-process and local loopback access.
- **Role-Based Access Control**: Sensitive actions (e.g. `disable_capability`) are restricted to `admin` or `developer` roles.
- **Zero Stealth / Evasion**: All automation jobs operate transparently with verifiable evidence streams and cryptographic digests.
