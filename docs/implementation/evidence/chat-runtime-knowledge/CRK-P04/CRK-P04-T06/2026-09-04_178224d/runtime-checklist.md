# Runtime Task Checklist — CRK-P04-T06: Phase 04 Exit Gate

## Phase 04 Definition of Done & Exit Gate (§1203-1209)

### Implementation
- [x] Coding/debug guided workflows exist (`CodingBuildWorkflow` and `DebugWorkflow`).
- [x] Normal chat cleanly bypasses the workflow engine when not needed (§1206).
- [x] Escape hatch / cancellation works without trapping user (§1180-1190).
- [x] Tool approval remains exact, auditable, and tamper-resistant (§1191-1202).
- [x] Source-size rule is satisfied (all production files <= 176 lines, < 300 lines limit).
- [x] Wired into `ChatRuntimeFactory.ts`.

### Tests
- [x] Workflow schema validation for 9 step types (4/4 passed).
- [x] Workflow state persistence and step lifecycle (4/4 passed).
- [x] Tool approval cryptographic hashing, expiry, and tampering rejection (4/4 passed).
- [x] Workflow integration and exit gate verification (4/4 passed).
- [x] 16/16 unit and integration tests pass across 4 suites.

### Verification
- [x] Type-check (`npm run type-check`: 0 errors).
- [x] Lint (`npm run lint:server`: 0 warnings/errors).
- [x] Affected suites (`npm test` passes cleanly).

### Evidence
- [x] Exact commit SHA recorded.
- [x] Commands recorded in `commands.md`.
- [x] Changed files recorded in `changed-files.txt`.
- [x] Placed in `docs/implementation/evidence/chat-runtime-knowledge/CRK-P04/CRK-P04-T06/2026-09-04_178224d/`.
- [x] Archive handoff generated.
