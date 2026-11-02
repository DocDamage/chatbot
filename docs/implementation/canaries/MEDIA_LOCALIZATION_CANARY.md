# Consent-Aware Media Localization Canary Guide (CF-07)

> Status: Operational runbook and verification canary for Milestone CF-07.
> Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Objective

Validate that AI Chatbot Hub's video and audio localization pipeline safely enforces explicit operator consent records, blocks unauthorized voice cloning or likeness reproduction, executes transcription and translation in isolated sandboxes, and cleans up all temporary media upon completion or cancellation.

## Operator Prerequisites

1. **Host Environment**:
   - OS: Windows 11, Linux, or macOS.
   - Node.js: >= 18.0.0.
   - FFmpeg (Optional for hardware media muxing): on system `PATH`.
2. **Consent Requirement**:
   - A valid `MediaConsentRecord` signed with SHA-256 digest before any voice or video processing commences.

## Verification Canary Steps

1. **Consent & Voice Cloning Enforcement Check**:
   Execute the consent verification test suite:
   ```powershell
   npx jest src/core/multimodal/VideoProcessor.test.ts --runInBand
   ```

2. **Verify Ephemeral Sandbox & File Cleanup**:
   Confirm that all temporary video frames, audio segments, and subtitle files are created inside `MediaLocalizationSandbox` and purged on cancellation.

3. **Verify Synthetic Media Disclosure**:
   Confirm that every exported localized media bundle includes provenance metadata and synthetic media disclosures.
