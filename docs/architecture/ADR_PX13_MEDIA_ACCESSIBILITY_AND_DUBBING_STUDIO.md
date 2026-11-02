# Architecture Decision Record: Phase PX-13 — Media Accessibility, Subtitle OCR, Dubbing, Narration, and Read-Along

## Status
Accepted (`LOCAL_ONLY_EXPERIMENTAL`)

## Context
Accessibility and localization across video, audio, and documents require subtitle extraction (burned-in OCR), editing, synchronization, consent-aware voice dubbing, document narration, and synchronized EPUB 3 read-along artifacts.

## Decisions
1. **Media Project Model:** Encapsulates media streams, technical metadata, and cryptographic provenance hash. Never overwrites original source assets.
2. **Burned-In Subtitle OCR:** Cropping to user-specified bounding boxes, candidate frame extraction, and consecutive frame deduplication to prevent unbounded disk usage.
3. **Subtitle Format Interoperability:** Full bidirectional support for SRT, WebVTT, ASS/SSA, and plain text transcripts with frame snapping and timing shift operations.
4. **Voice Dubbing & Rights Gate:** Requires verified subject consent records for cloned/custom voices. Stock engine voices include synthetic media disclosure notices.
5. **Clean-Room Document Narration & EPUB 3 Read-Along:** Generates chapter-divided narration packages and synchronized EPUB 3 Media Overlays with SMIL 3.0 syntax meeting WCAG AAA conformance.
6. **Authorized Media URL Ingest Guardrails:** Strictly rejects non-http(s) protocols, embedded URL credentials, and DRM-protected streams.

## Consequences
- Multi-format subtitle extraction and editing with zero data loss.
- Non-destructive translation variant tracks and strict voice consent safeguards.
- Full verification through `MediaAccessibility.eval.test.ts`.
