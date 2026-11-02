# Capability Fusion — CF-09 Rolling Record

- Status: `LOCAL_ONLY_EXPERIMENTAL`
- Scope: Workstream CF-09 — Unified Capability Hub UI

> Audit correction (2026-08-24): The Hub is mounted and substantially surfaced, but its CF-04–CF-08 buttons are diagnostics rather than full workflows. Browser E2E, automated accessibility, and manual keyboard/screen-reader certification remain open. See [CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md](./CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md).

## Workstreams & Deliverables

- [x] Implemented `CapabilityJobManager` lifecycle engine with progress tracking, SHA-256 audit digest generation, evidence recording, cancellation, and exact-scope confirmation (`CapabilityJobManager.ts`).
- [x] Implemented `CapabilityRegistry` indexing CF-00 through CF-08 capabilities across the 6 roadmap sections with dynamic health probing, diagnostics, and profile-based filtering (`CapabilityRegistry.ts`).
- [x] Built server-side REST API router mounted at `/api/capabilities` with role enforcement, diagnostics, and action dispatch (`src/server/routes/capabilities.ts`).
- [x] Implemented accessible 2D SVG graph and data table pair for CF-03 findings and repository hotspot visualization (`RepositoryFindingsView.tsx`).
- [x] Implemented `ExactScopeConfirmModal` requiring typed confirmation phrases for dangerous actions (`ExactScopeConfirmModal.tsx`).
- [x] Implemented `CapabilityHubPanel` React component with 6-section filtering, specification modal, job evidence inspector, and onboarding guide (`CapabilityHubPanel.tsx`, `CapabilityHubPanel.css`).
- [x] Integrated Capability Hub into `LocalToolsWorkspace` navigation (`LocalToolsWorkspace.tsx`).
- [x] Architectural Decision Record ADR-0019 (`docs/implementation/decisions/ADR-0019-unified-capability-hub-ui.md`).
- [x] Comprehensive test suites for backend registry (`CapabilityRegistry.test.ts`) and client components (`CapabilityHubPanel.test.tsx`).
