# Real-Environment Browser Job Canary Guide (CF-06)

> Status: Operational runbook and verification canary for Milestone CF-06.
> Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Objective

Validate that AI Chatbot Hub can safely execute transparent, authorized browser QA and workflow jobs with strict origin containment, temporary profile sandboxing, DOM/network evidence collection, exact-scope approval confirmation for state mutations, and clean child-process cleanup.

## Operator Prerequisites

1. **Host Environment**:
   - OS: Windows 11, Linux (Ubuntu/Debian), or macOS.
   - Node.js: >= 18.0.0.
   - Playwright: Installed with Chromium browser binaries (`npx playwright install chromium`).
2. **Runtime Policy**:
   - `DEPLOYMENT_MODE` must be `LOCAL_TRUSTED` or `development`.
   - In `hosted` mode, all browser job execution is strictly disabled.

## Verification Canary Steps

1. **Origin Allowlist Containment Check**:
   Execute the automated origin and navigation boundary checks:
   ```powershell
   npx jest src/core/browser/AuthorizedBrowserJob.test.ts --runInBand
   ```

2. **Verify Dangerous Action Exact-Scope Gate**:
   Confirm that form submissions, external posts, purchases, or account mutations cannot execute without explicit phrase-based exact-scope confirmation.

3. **Verify Evidence Artifacts & Process Cleanup**:
   Confirm that screenshot, DOM snapshot, and network trace records are saved with SHA-256 cryptographic digests, and all browser process trees terminate upon cancellation.
