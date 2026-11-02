# ADR-0017: Consent-Aware Video Localization and Dubbing

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-07
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-07 delivers a local, consent-bound media localization and dubbing pipeline to enable transparent subtitle generation, language translation, voice dubbing, and lip-syncing without unauthorized voice cloning, privacy leaks, or unapproved data egress.

1. **`MediaConsentRecord` & Source-Rights Verification**:
   Every media localization workflow requires an immutable `MediaConsentRecord` confirming source rights, rightsholder identity, synthetic media disclosure acknowledgement, and explicit operator signoff with a cryptographic SHA-256 consent digest (`computeConsentDigest`).
2. **Strict Voice-Cloning Authorization Gate**:
   Voice cloning and reference-voice synthesis are strictly prohibited unless `voiceCloningAuthorized: true` is verified in the active consent record. Attempting voice synthesis without explicit rightsholder authorization fails closed (`UnauthorizedVoiceCloningError`).
3. **Biometric Privacy Protection**:
   Consent records retain legal and verification attestations without storing unnecessary permanent voice prints or biometric embeddings.
4. **Isolated Ephemeral Media Sandboxing**:
   `MediaLocalizationSandbox` provisions isolated workspace subdirectories (`audio`, `vocals`, `subtitles`, `chunks`, `output`) per job under `temp/media-localization/{jobId}`. Path traversal and sandbox escapes are strictly blocked, total disk budgets are enforced, and all intermediate artifacts are cleaned up on job completion or cancellation.
5. **12-Stage Pipeline with Progress & Provenance**:
   `VideoLocalizationPipeline` executes 12 structured stages: `preflight`, `validate_media`, `extract_audio`, `separate_vocals`, `transcribe_align`, `review_transcript`, `translate`, `synthesize_voice`, `fit_timing`, `reconstruct_mix`, `lip_sync`, and `finalize_export`.
6. **Data-Egress Warnings & Synthetic Media Disclosures**:
   Remote translation services (such as Google Translate) trigger mandatory data-egress warning acknowledgements before execution. Local offline translation and TTS are supported. All finalized exports attach a standardized `SyntheticMediaDisclosure` notice and `LocalizationProvenance` metadata manifest.

## Boundaries and Security Invariants

- **Clean License Boundary**: Pure MIT-compatible contracts and clean-room pipeline orchestrators; no external proprietary dependencies are imported.
- **Fail-Closed Verification**: Unapproved jobs, expired consent records, or missing source rights fail closed.
- **Auditability**: Generated outputs include full provenance tracking of source hashes, target languages, model configurations, and replay seeds.
