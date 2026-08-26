# Plan Authority, Reconciliation, and Scope Policy

**Date:** 2026-08-25
**Scope:** Reconcile all governing plans for AI Chatbot Hub.

---

## 1. Authority Hierarchy

When engineering, architectural, licensing, or testing requirements conflict across documents, the order of precedence is strictly:

1. **Accepted Architecture and Security Decision Records (`docs/implementation/decisions/ADR-*.md`)**
2. **Master Production Completion Tracker (`docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`)**
3. **Production Feature Manifest (`docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`)**
4. **Final Completion Implementation Plan (`docs/implementation/FINAL_COMPLETION_IMPLEMENTATION_PLAN.md`)**
5. **Capability Fusion Roadmap (`docs/implementation/CAPABILITY_FUSION_ROADMAP.md`)**
6. **Profile-Wide Capability Expansion Plan (`docs/AI_CHATBOT_HUB_PROFILE_WIDE_CAPABILITY_EXPANSION_IMPLEMENTATION_PLAN.md`)**
7. **Task Issues, Handoffs, and Implementation Notes**

*Rule:* The more restrictive security, evidence, licensing, accessibility, or production-support requirement always prevails.

---

## 2. Planning Layer Mapping & Reconciliation

| Plan / Layer | Core Focus | Relationship to Current Codebase |
|---|---|---|
| **100% Production Completion Plan** | Core chatbot release (Phase 0–14, 124 tasks) | Governing standard for first core production release. 23 tasks verified, 101 pending. |
| **Final Completion Implementation Plan** | Multi-phase roadmap covering core completion + extension gates | Operational reference for core completion milestones. |
| **Capability Fusion Roadmap (CF-00–CF-10)** | Initial 11 fusion areas (approved repos, graph, BM25, SARIF/SBOM, local models, agent teams, browser, dubbing, game pkg, hub, promotion) | Integrated on branch `codex/cf04-cf10-integration` (PR #171) at `LOCAL_ONLY_EXPERIMENTAL`. |
| **Profile-Wide Expansion Plan (PX-00–PX-22)** | Deep expansion into 32+ profile repositories across 4 release trains | Extends CF-00..CF-10. All capabilities start `DISABLED` and progress through rigorous governance gates. |

---

## 3. Superseded Statements & Historical Evidence Preservation

1. **Superseded Initial Commit:** References in early plans to `8b963232...` are historical; the baseline is re-anchored to `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f` (and PR #171 head `aec88716...`).
2. **Historical Evidence:** All existing evidence bundles in `docs/implementation/evidence/` (Phase 00..03, CF-01..10) remain immutable and permanently indexed in `RELEASE_EVIDENCE_INDEX.md`.
3. **Release Blocker Boundaries:** Core 124 tasks in `MASTER_PRODUCTION_COMPLETION_TRACKER.md` govern the 1.0 core release. Profile-wide expansion (`PX-00` through `PX-22`) is phased across release trains A, B, C, and D without blocking core production milestones.
