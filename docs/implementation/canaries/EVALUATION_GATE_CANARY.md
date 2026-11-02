# Evaluation & Promotion Gate Canary Guide (CF-10)

> Status: Operational runbook and verification canary for Milestone CF-10.
> Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Objective

Validate that AI Chatbot Hub's cross-capability evaluation suites, SLO observability service, and 3-stage capability promotion engine can execute on-demand benchmark evaluations across all 10 domain vectors, generate scrubbed support diagnostics, and produce immutable `PromotionDecisionRecord` logs with SHA-256 digests.

## Operator Prerequisites

1. **Host Environment**:
   - OS: Windows 11, Linux, or macOS.
   - Node.js: >= 18.0.0.
2. **Authority**:
   - Promotion evaluation is open to all users; executing promotions requires `developer` or `admin` role.

## Verification Canary Steps

1. **Execute Complete 10-Domain Evaluation Suite**:
   ```powershell
   npx jest src/core/capabilities/evaluation/CapabilityEvaluationSuite.test.ts --runInBand
   ```

2. **Verify SLO Metric Aggregation & Error Budgeting**:
   ```powershell
   npx jest src/core/capabilities/observability/CapabilityObservabilityService.test.ts --runInBand
   ```

3. **Verify 3-Stage Promotion Engine & Decision Records**:
   ```powershell
   npx jest src/core/capabilities/promotion/CapabilityPromotionEngine.test.ts --runInBand
   ```

4. **Verify Privacy Scrubbing & Diagnostic Bundles**:
   Confirm that secrets (API keys, bearer tokens) and PII are redacted prior to telemetry emission and export.
