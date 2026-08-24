# Capability Fusion — CF-07 Rolling Record

- Status: `LOCAL_ONLY_EXPERIMENTAL`
- Scope: Workstream CF-07 — Consent-aware video localization and dubbing

> Audit correction (2026-08-24): Orchestration and consent contracts are implemented, but no concrete production media engine adapter or end-user workflow is configured. Mock-backed tests are not a real dubbing canary. See [CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md](./CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md).

## Workstreams & Deliverables

- [x] Defined `MediaConsentRecord` with source-rights verification, voice-cloning restrictions, synthetic-media disclosure, and cryptographic consent digest (`MediaConsentRecord.ts`).
- [x] Defined `VideoLocalizationJob` contract with 12 structured stages, resource budget limits (duration, resolution, file size, disk usage), deterministic replay seed, and provenance metadata (`VideoLocalizationJob.ts`).
- [x] Implemented isolated ephemeral workspace sandbox manager with path traversal prevention, disk quotas, and automatic cleanup (`MediaLocalizationSandbox.ts`).
- [x] Implemented 12-stage `VideoLocalizationPipeline` orchestrating preflight, validation, audio extraction, vocal separation, transcription/alignment (SRT), translation, voice synthesis, timing fit, mix reconstruction, optional lip-sync, and export (`VideoLocalizationPipeline.ts`).
- [x] Enforced data-egress warning acknowledgement for external translation services and supported local offline translation providers.
- [x] Attached standardized `SyntheticMediaDisclosure` notices and provenance manifests (`localization_manifest.json`) to all exported media.
- [x] Architectural Decision Record ADR-0017 (`docs/implementation/decisions/ADR-0017-consent-aware-video-localization.md`).
- [x] Comprehensive test suite with 17 passing tests (`VideoLocalizationJob.test.ts`).
