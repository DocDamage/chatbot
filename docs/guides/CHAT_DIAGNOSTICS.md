# Chat Diagnostics Guide: "Why Did This Fail?"

## 1. Overview
The Chat Diagnostics subsystem (`ChatDiagnosticsService` & `ChatRunRepository`) provides full operational transparency into why any specific turn failed, degraded, or deviated from expected output.

## 2. Accessing Diagnostics
Developers and operators can inspect run diagnostics through:
- The UI modal (`ChatDiagnosticsModal.tsx`) accessible via the diagnostics icon on chat turns.
- The REST API endpoint:
  `GET /api/debug/chat-runs/:requestId`
- The CLI shadow report:
  `npm run chat:runtime:shadow-report`

## 3. Normalized Failure Taxonomy
The platform classifies failures into 14 deterministic taxonomy codes:
1. `NORMALIZATION_FAILURE`: Request malformed or invalid channel parameters.
2. `AUTH_REJECTED`: Authentication failure or unauthorized tool access.
3. `VARIABLE_EXTRACTION_ERROR`: Failure to extract conversation state variables.
4. `PLANNER_TIMEOUT`: Context planning step exceeded execution deadline.
5. `RETRIEVAL_NO_RESULTS`: Knowledge retrieval returned zero candidate chunks.
6. `RETRIEVAL_LOW_CONFIDENCE`: Candidate chunks failed minimum authority threshold.
7. `VECTOR_STORE_UNAVAILABLE`: Vector database connection failure or timeout.
8. `GROUNDING_CHECK_FAILED`: Generated response failed citation grounding verification.
9. `MODEL_TIMEOUT`: Provider model call exceeded timeout budget.
10. `MODEL_RATE_LIMITED`: Provider returned 429 quota or rate-limit error.
11. `CIRCUIT_BREAKER_OPEN`: Provider circuit breaker tripped due to consecutive errors.
12. `SAFETY_VIOLATION`: Prompt injection or content safety boundary triggered.
13. `TOOL_EXECUTION_ERROR`: Tool execution failed or timed out.
14. `INTERNAL_RUNTIME_ERROR`: Unhandled exception within the runtime pipeline.

## 4. Privacy & Sanitization
All diagnostic records are strictly sanitized before storage and presentation:
- Passwords, API tokens, bearer headers, and private file paths are redacted.
- Raw internal reasoning prompts or hidden model states are stripped from external responses.
