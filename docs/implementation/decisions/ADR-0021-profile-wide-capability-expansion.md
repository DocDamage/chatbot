# ADR-0021: Profile-Wide Capability Expansion and Governance Framework

- Status: Accepted
- Date: 2026-08-25
- Scope: Profile-Wide Capability Expansion (`PX-00` through `PX-22`)
- Maturity: `DISABLED` (governance baseline established; capabilities remain default-denied)

## Context

AI Chatbot Hub requires expanding its capabilities across 32+ profile-derived domain areas (such as reversible context compression, repository intelligence, project memory, multi-agent operations, local model routing, game engine control, audio stem/mix analysis, desktop voice companion, subtitle OCR and localization, writing studio, study studio, visual web studio, and developer utilities).

Merging entire external repositories wholesale into the core product poses extreme security, licensing, maintainability, and stability risks. A disciplined capability fusion approach is required to integrate worthwhile features while enforcing strict boundaries.

## Decision

1. **Capability Fusion, Not Application Accumulation**:
   External repositories are treated strictly as research, contract, and algorithm inputs. Wholesale imports of entire external application shells, unvetted databases, or unchecked agent frameworks are forbidden.

2. **Strict Integration Modes**:
   Every capability or external source must be assigned exactly one integration mode:
   - `NATIVE_ADAPTATION`: Project-owned TypeScript/Rust/Python modules adapted from permissively licensed (MIT/Apache-2.0/BSD/ISC) upstream code with file-level provenance headers and retained notices.
   - `EXTERNAL_SERVICE_ADAPTER`: The user runs and operates the external service locally; the chatbot communicates exclusively over stable, authorized HTTP/OpenAI-compatible/MCP/WebSocket/CLI protocols.
   - `CLEAN_ROOM_IMPLEMENTATION`: Functionality developed from public specifications, algorithms, and observed behavioral requirements using test-first acceptance; no external code is copied.
   - `REFERENCE_ONLY`: Legally ambiguous, noncommercial, or proprietary sources used solely for conceptual reference without copying code.
   - `REJECTED`: Excluded sources that violate safety, licensing, or security invariants.

3. **Mandatory Server-Authoritative Availability & Default-Deny**:
   - Capabilities are never enabled merely because client panels are present.
   - The server enforces role, profile (`HOSTED` vs `LOCAL_TRUSTED`), maturity level, dependency health, license compliance, and policy checks.
   - All new capabilities begin strictly `DISABLED` or `LOCAL_ONLY_EXPERIMENTAL`.

4. **Exact-Scope Approval Binding**:
   Approvals are bound to cryptographic SHA-256 digests of exact inputs, targets, models, and actions. Any modification to parameters invalidates prior approval.

5. **Release Trains**:
   Capability expansion is phased into four release trains:
   - **Train A (Intelligence Foundation)**: `PX-00` through `PX-07`
   - **Train B (Local Creation and Game/Media Studios)**: `PX-08` through `PX-13`
   - **Train C (Knowledge and Visual Creation)**: `PX-14` through `PX-18`
   - **Train D (Integrated Certification and Release)**: `PX-19` through `PX-22`

6. **Automated Source and License Integrity**:
   CI scanners continuously verify license digests, third-party attribution completeness, file-level provenance, and dependency license compatibility.

## Security & Boundary Invariants

- Hosted deployment (`HOSTED`) strictly prohibits arbitrary filesystem writes, uncontained shell execution, engine mutations, local process spawns, and loopback probes.
- Desktop and engine capabilities are restricted to `LOCAL_TRUSTED` under explicit human approval digests, root confinement, and cancellation guarantees.
- Zero secret leakage in diagnostic bundles, telemetry, or export artifacts.
