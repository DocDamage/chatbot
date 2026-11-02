# Clean-Room Implementation Protocol and Source Isolation Governance

**Date:** 2026-08-25
**Scope:** Governance protocol for clean-room implementation of capabilities derived from proprietary, noncommercial, ambiguous, or unlicensed sources.

---

## 1. Objectives and Scope

When a target capability is identified in a source that has:
- PolyForm Noncommercial, Community, or Non-OSI terms (e.g. `PageLM`, `pdf2audio`);
- Proprietary or unverified licenses (e.g. `Omni-Memory`);
- Ambiguous/missing root licenses (e.g. `UE5 MCP Bridge`);
- Weak copyleft or isolating license terms (e.g. `AssetCooker` MPL-2.0);

the implementation **must strictly adhere to this Clean-Room Protocol**. Direct copying, decompilation, code translation, or AST porting from the source into AI Chatbot Hub's codebase is strictly prohibited.

---

## 2. The 7-Stage Clean-Room Protocol

```text
[1. Source Specification Review] ---> [2. Behavioral Spec Authoring]
                                               |
[4. Test-First Suite Implementation] <--- [3. Spec Review & Legal Isolation Gate]
           |
[5. Independent Clean Implementation] ---> [6. Clean-Room Declaration]
                                                    |
                                          [7. Merge Verification]
```

### Stage 1: Specification and Behavioral Analysis
- A designated engineer reviews published documentation, academic papers, API contracts, or high-level functional concepts.
- The reviewer records functional inputs, expected outputs, state transitions, edge cases, and algorithm summaries without extracting source code.

### Stage 2: Behavioral Specification Authoring
- A clean behavioral specification document is written describing:
  - Data models and JSON schemas;
  - State machines and transition rules;
  - Mathematical / algorithmic formulas (e.g. BM25 scoring, TF-IDF, token-budget calculations);
  - Error and failure handling semantics.

### Stage 3: Legal Isolation Gate
- The behavioral specification is vetted to ensure zero copyrighted code snippets, internal variable names, or proprietary structures are present.

### Stage 4: Test-First Acceptance Suite
- Independent test suites (`*.test.ts`) are created verifying all behavioral requirements before implementing production code.

### Stage 5: Independent Clean-Room Implementation
- Production code is authored in TypeScript/Rust from the behavioral specification and tests alone.
- No access to the original source code is allowed during the coding phase.

### Stage 6: Clean-Room Declaration
- The resulting PR and task evidence bundle must contain a `clean-room-declaration.md` certifying that no source code was copied or translated.

### Stage 7: Independent Merge Verification
- An independent reviewer validates that the PR satisfies all test and compliance criteria.

---

## 3. Explicit Source Classifications

| Source | Classification | Clean-Room Policy |
|---|---|---|
| **Omni-Memory** | `CLEAN_ROOM_IMPLEMENTATION` | Implemented via project-owned Git/branch memory schema and tests. |
| **PageLM** | `CLEAN_ROOM_IMPLEMENTATION` | Study Studio implemented cleanly from educational schemas and standard prompt templates. |
| **pdf2audio** | `CLEAN_ROOM_IMPLEMENTATION` | Chaptered audio narration built on clean-room pipeline using standard PDF parsers and local TTS. |
| **UE5 MCP Bridge** | `BLOCKED` | **BLOCKED** from all native implementation until upstream license is legally resolved. |
| **AssetCooker** | `EXTERNAL_SERVICE_ADAPTER` | Treated as an external standalone CLI tool; MPL files remain strictly external. |
