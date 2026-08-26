# Profile-Wide Capability Expansion — Milestones and Issues Specification

**Date:** 2026-08-25
**Program:** Profile-Wide Capability Expansion (`PX`)

---

## 1. Milestone Definitions

| Milestone | Scope / Target | Release Train | Gate Criteria |
|---|---|---|---|
| **`PX-00`** | Rebaseline, Plan Reconciliation, and Program Authorization | Foundation | Plan authority signed, ADR-0021 accepted, all PX tasks tracked. |
| **`PX-01`** | Source Provenance, Licensing, and Integration Decisions | Foundation | Source register complete, clean-room protocol defined, notice/integrity scanners passing. |
| **`PX-02`** | Capability Pack, Registry, Job, Permission, and Artifact Platform | Train A | Standardized pack schema, default-deny permissions, job orchestration, artifact lineage. |
| **`PX-03`** | Context Economy and Reversible Compression | Train A | Token budgeting, reversible lossless compression, citation retention, retrieval ranking. |
| **`PX-04`** | Repository Intelligence, Code Health, and Impact Analysis | Train A | Byte-offset symbol index, call graph, complexity/churn risk analysis, test impact maps. |
| **`PX-05`** | Provenance-Preserving Project Memory and Git Integration | Train A | Branch/worktree/symbol-anchored memory, freshness decay, cross-branch reconciliation. |
| **`PX-06`** | Multi-Agent Operations, Scoped Communication, and Workspaces | Train A | Agent teams, structured event streaming, workspace claims, collision prevention. |
| **`PX-07`** | Local Model Routing, Resource Management, and Inference Adapters | Train A | Hardware discovery, VRAM/latency routing, disk-streamed MoE / local provider adapters. |
| **`PX-08`** | Godot Engine Bridge, Safe Editor Transactions, and Verification | Train B | MCP/CLI Godot bridge, transaction journal, scene validation, gameplay assertions. |
| **`PX-09`** | Unity, Unreal, and Asset-Cooking Integration Adapters | Train B | Isolated Unity/Unreal adapters, MPL AssetCooker isolation, cooking manifests. |
| **`PX-10`** | Sprite, Image, and Game Asset Studio | Train B | Palette quantization, pixel-art cleanup, grid detection, multi-resolution slicing. |
| **`PX-11`** | Local Audio Stem Separation and Mix Analysis Lab | Train B | 6-stem separation worker, LUFS/BPM/key analysis, multi-track mixer preview. |
| **`PX-12`** | Local Desktop Voice Companion and Audio Workflow | Train B | Local low-latency STT/TTS, screen context awareness, approval-gated actions. |
| **`PX-13`** | Subtitle OCR, Media Accessibility, and Dubbing Studio | Train B | Burned-in OCR, cue alignment, multi-language dubbing, accessible SRT/ASS export. |
| **`PX-14`** | Lossless Writing, Review, and Publishing Studio | Train C | Markdown WYSIWYG, tracked changes, grammar/style proofreading, clean export. |
| **`PX-15`** | Source-Grounded Study, Notes, and Examination Studio | Train C | Flashcards, quizzes, study notes, chaptered audio narration, strict citations. |
| **`PX-16`** | Visual Web Studio and Click-to-Code Workspace | Train C | Visual block editing, iframe live preview, click-to-component code navigation. |
| **`PX-17`** | Developer Utility Pack and Mock API System | Train C | Mock API server, dynamic seeding, skill export, schema generators. |
| **`PX-18`** | Unified Capability Hub, Job Console, and Diagnostic Center | Train C | Integrated hub UI, job lifecycle monitoring, diagnostic bundles, telemetry views. |
| **`PX-19`** | Hardened Security, Sandbox Containment, and Privacy Policy | Train D | Threat modeling, root confinement, SSRF protections, secret scrubbing. |
| **`PX-20`** | High-Resilience Runtime, Concurrency, and Disaster Recovery | Train D | Chaos drills, queue failover, database migration verifications, backup drills. |
| **`PX-21`** | Golden Evaluations, Benchmark Certification, and SLO Proof | Train D | Cross-domain evaluation suites, SLI/SLO threshold verification, performance gates. |
| **`PX-22`** | Release Certification, Documentation, and Maintenance | Train D | Release candidate packaging, documentation verification, long-term support SLA. |

---

## 2. Issue Structure and Quality Gates

Every implementation issue for the PX program must contain:
1. **Clear Task ID & Phase Scope**
2. **Explicit Upstream Source & Integration Mode (`NATIVE`, `ADAPTER`, `CLEAN_ROOM`, etc.)**
3. **Security, Privacy, and Deployment Profile Invariants**
4. **Automated Unit & Integration Test Obligations**
5. **Exact Runtime Evidence Path and Schema Requirements**
6. **One-Task-One-Thread Rule Enforcement**
