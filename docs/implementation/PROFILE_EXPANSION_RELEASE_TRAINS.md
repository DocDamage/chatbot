# Profile-Wide Capability Expansion — Release Trains

**Date:** 2026-08-25
**Program:** Profile-Wide Capability Expansion (`PX`)

---

## 1. Release Train Architecture

To ensure continuous delivery and prevent blocking core releases, capability development is organized into 4 decoupled release trains:

```text
+-------------------------------------------------------------------------------+
|  TRAIN A: Intelligence Foundation                                             |
|  - PX-00: Rebaseline & Program Authorization                                  |
|  - PX-01: Source Provenance & Integration Decisions                           |
|  - PX-02: Capability Platform (Packs, Jobs, Approvals, Artifacts)            |
|  - PX-03: Context Economy & Lossless Compression                              |
|  - PX-04: Repository Intelligence & Code Health                               |
|  - PX-05: Project Memory & Git Knowledge                                      |
|  - PX-06: Multi-Agent Operations & Workspaces                                 |
|  - PX-07: Local Model Routing & Resource Adapters                             |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|  TRAIN B: Local Creation and Game/Media Studios                               |
|  - PX-08: Godot Engine Bridge & Gameplay Verification                         |
|  - PX-09: Unity, Unreal & Asset-Cooking Adapters                              |
|  - PX-10: Sprite, Pixel-Art & Image Studio                                    |
|  - PX-11: Stem Separation & Audio Mix Lab                                     |
|  - PX-12: Desktop Voice Companion & Local Audio                               |
|  - PX-13: Subtitle OCR & Media Localization Studio                            |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|  TRAIN C: Knowledge and Visual Creation                                       |
|  - PX-14: Lossless Writing & Publishing Studio                                |
|  - PX-15: Source-Grounded Study Studio                                        |
|  - PX-16: Visual Web Studio & Click-to-Code                                   |
|  - PX-17: Developer Utility Pack & Mock API System                            |
|  - PX-18: Unified Capability Hub UI & Job Center                              |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|  TRAIN D: Integrated Certification and Release                                |
|  - PX-19: Hardened Security, Sandboxing & Egress Policy                       |
|  - PX-20: Concurrency, Resilience & Disaster Recovery                         |
|  - PX-21: Benchmark Certification & Golden Evaluation Proof                   |
|  - PX-22: Release Certification & Operational Maintenance                     |
+-------------------------------------------------------------------------------+
```

---

## 2. Release & Promotion Invariants

1. **Independent Progression**: Completing tasks within a train enables capabilities to advance through `DISABLED` -> `LOCAL_ONLY_EXPERIMENTAL` -> `PRODUCTION_PREVIEW` -> `PRODUCTION_SUPPORTED` based strictly on ADR-0020 evaluation benchmarks and SLO metrics.
2. **Core Independence**: The core 1.0 release (governed by `MASTER_PRODUCTION_COMPLETION_TRACKER.md` core tasks) may release independently of Train B/C/D capabilities.
