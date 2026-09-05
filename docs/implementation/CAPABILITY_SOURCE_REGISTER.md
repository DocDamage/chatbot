# Capability Source Register and Integration Boundaries

**Date:** 2026-08-25
**Scope:** Authoritative register of all external and profile repositories, licensing terms, and integration modes for AI Chatbot Hub.

> **Audit status:** `IMPLEMENTED_NOT_VERIFIED`. Values such as `main (2026-08-24)` are branch/date observations, not immutable source revisions. Native adaptation, clean-room, notices, or promotion decisions must remain blocked until each relevant source row is pinned to an exact commit/tag, its license text and file exceptions are captured, and the review evidence is attached.

---

## 1. Integration Mode Taxonomy

Every external source is assigned exactly one status:
- **`NATIVE_ADAPTATION`**: Permissive upstream (MIT/Apache-2.0/BSD) adapted natively into project-owned TypeScript/Rust code with file-level provenance tracking and retained copyright/notices.
- **`EXTERNAL_SERVICE_ADAPTER`**: Project connects to a separately installed/run external service via standard protocols (HTTP, MCP, WebSocket, CLI, OpenAI-compatible API).
- **`CLEAN_ROOM_IMPLEMENTATION`**: Implemented independently from published specs, algorithms, and observed behavioral requirements; no external source code copied.
- **`REFERENCE_ONLY`**: Upstream documentation or conceptual designs reviewed; no code copied or direct adapters implemented.
- **`REJECTED` / `BLOCKED`**: Upstream is blocked due to license ambiguity, noncommercial restrictions, or safety policy violations.

---

## 2. Capability Source Register

| Source / Repository | Canonical Upstream / Mirror | Reviewed Revision / Branch | Root License | File Exceptions / Notices | Integration Mode | Security & Compliance Boundary | Status |
|---|---|---|---|---|---|---|---|
| **Headroom** | `DocDamage/Headroom` | `main` (`2026-08-24`) | Apache-2.0 | NOTICE file present; ML models separate | `NATIVE_ADAPTATION` / `EXTERNAL_SERVICE_ADAPTER` | Native compression algorithms adapted; ML compressors use external adapter | Active |
| **Graft** | `DocDamage/graft` | `main` (`2026-08-24`) | MIT | Copyright (c) 2026 Graft authors | `NATIVE_ADAPTATION` | Native architecture card provider; deterministic graph maintained | Active |
| **Basemind** | `DocDamage/basemind` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Narrow memory/context contracts adapted; uncontained shell execution stripped | Active |
| **RepoCortex** | `DocDamage/RepoCortex` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Native pack and governance contracts adapted with file headers | Active |
| **Knowledge Work Plugins** | `DocDamage/knowledge-work-plugins` | `main` (`2026-08-24`) | Apache-2.0 | Apache NOTICE retained | `NATIVE_ADAPTATION` | Clean project-owned `CapabilityPack` schema; packaging concepts adapted | Active |
| **ContextLattice** | `DocDamage/ContextLattice` | `main` (`2026-08-24`) | Apache-2.0 | Standard Apache-2.0 | `EXTERNAL_SERVICE_ADAPTER` | Separately operated memory service; protocol contracts adapted | Active |
| **Remembrandt** | `DocDamage/remembrandt` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Transparent Markdown memory schema and export engine | Active |
| **MemPalace** | `DocDamage/mempalace` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `REFERENCE_ONLY` | Reference only; evaluation benchmark reference pending security review | Active |
| **Omni-Memory** | `DocDamage/omni-memory` | `main` (`2026-08-24`) | Proprietary / Ambiguous | No OSI permissive license | `CLEAN_ROOM_IMPLEMENTATION` | Strict clean-room implementation based on published specs; zero source copying | Active |
| **Agent Quest** | `DocDamage/agent-quest` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Event stream and operator UI concepts adapted; accessible theme | Active |
| **Godot MCP X** | `DocDamage/godot-mcp-x` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `EXTERNAL_SERVICE_ADAPTER` | MCP/CLI protocol adapter for local Godot editor/runtime | Active |
| **Forge CLI** | `DocDamage/forge-cli` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Native transaction, manifest, and rollback engine | Active |
| **MAST** | `DocDamage/mast` | `main` (`2026-08-24`) | MIT (Assets separate) | Sample assets have separate terms | `EXTERNAL_SERVICE_ADAPTER` | Unity adapter; sample assets isolated from repo | Active |
| **UE5 MCP Bridge** | `DocDamage/ue5-mcp-bridge` | `main` (`2026-08-24`) | Unresolved / Missing | No root license verified | `REJECTED` / `BLOCKED` | **BLOCKED** until root license and upstream rights are legally cleared | Blocked |
| **StemDeck** | `DocDamage/stemdeck` | `main` (`2026-08-24`) | Apache-2.0 | Demucs/model weights separate | `NATIVE_ADAPTATION` / `EXTERNAL_SERVICE_ADAPTER` | Isolated local media worker for audio stem processing | Active |
| **Monoleaf** | `DocDamage/monoleaf` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Lossless Markdown WYSIWYG and tracked changes adapted | Active |
| **Lexicon** | `DocDamage/lexicon` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Local grammar and proofreading engine adapted natively | Active |
| **SpeakoFlow** | `DocDamage/speakoflow` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `EXTERNAL_SERVICE_ADAPTER` | Standalone local voice companion communicating via chatbot API | Active |
| **Jarvis** | `DocDamage/jarvis` | `main` (`2026-08-24`) | Custom / Ambiguous | Custom license text | `REFERENCE_ONLY` | Concept reference only; global OS automation strictly excluded | Active |
| **PageLM** | `DocDamage/pagelm` | `main` (`2026-08-24`) | PolyForm Noncommercial | Noncommercial restriction | `CLEAN_ROOM_IMPLEMENTATION` | Strict clean-room implementation for Study Studio; no code copied | Active |
| **Airship** | `DocDamage/airship` | `main` (`2026-08-24`) | Custom / Ambiguous | License review required | `EXTERNAL_SERVICE_ADAPTER` | Sandboxed preview adapter; no unsandboxed execution | Active |
| **OpenForge** | `DocDamage/openforge` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Visual block editing and schema adapted natively | Active |
| **SubtitleYC** | `DocDamage/subtitleyc` | `main` (`2026-08-24`) | MIT | Tesseract/OCR binaries separate | `NATIVE_ADAPTATION` | Local OCR worker pipeline adapted natively | Active |
| **pdf2audio** | `DocDamage/pdf2audio` | `main` (`2026-08-24`) | PolyForm Noncommercial | Noncommercial restriction | `CLEAN_ROOM_IMPLEMENTATION` | Clean-room narration pipeline; no noncommercial code in MIT product | Active |
| **PixelRefiner** | `DocDamage/pixelrefiner` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Pixel-art cleanup, palette quantization, grid algorithms adapted | Active |
| **AssetCooker** | `DocDamage/assetcooker` | `main` (`2026-08-24`) | MPL-2.0 | Weak copyleft | `EXTERNAL_SERVICE_ADAPTER` | Separately installed CLI adapter; MPL files kept completely isolated | Active |
| **TwentyFiveSlicer** | `DocDamage/twentyfiveslicer` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Sprite slicing and coordinate calculation algorithms adapted | Active |
| **CodeMunch Pro** | `DocDamage/codemunch-pro` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Byte-offset symbol index and call graph extraction adapted | Active |
| **DevLens Agent** | `DocDamage/devlens-agent` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Churn, complexity, and hotspot scoring algorithms adapted | Active |
| **Picchio** | `DocDamage/picchio` | `main` (`2026-08-24`) | MIT / Model-specific | Checkpoint weights separate | `EXTERNAL_SERVICE_ADAPTER` | External local model server via OpenAI-compatible endpoint | Active |
| **Capsule** | `DocDamage/capsule` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Deterministic mock API engine adapted natively | Active |
| **Book-to-Skill** | `DocDamage/book-to-skill` | `main` (`2026-08-24`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Document-to-skill layout and extraction workflow adapted | Active |
| **RepoDNA** | `DocDamage/RepoDNA` | `2e55216e95...` | MIT | Covered by `CF-01_REPODNA_NOTICE.md` | `NATIVE_ADAPTATION` | Architecture graph concepts implemented in TypeScript | Active |
| **RepoRelay** | `DocDamage/RepoRelay` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Gateway and approved repository access boundaries | Active |
| **SearchEngineSuite** | `DocDamage/SearchEngineSuite` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `CLEAN_ROOM_IMPLEMENTATION` | Clean-room BM25 lexical search implementation | Active |
| **GitGalaxy** | `DocDamage/GitGalaxy` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Graph visualization concepts adapted | Active |
| **Guaardvark** | `DocDamage/Guaardvark` | `main` (`2026-08-23`) | Apache-2.0 | Apache NOTICE retained | `NATIVE_ADAPTATION` | SARIF validation and security finding normalization | Active |
| **Warpdrv** | `DocDamage/Warpdrv` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `EXTERNAL_SERVICE_ADAPTER` | Local model process and hardware telemetry adapter | Active |
| **dev-house** | `DocDamage/dev-house` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Typed agent roles, teams, and worktree isolation | Active |
| **Pydoll** | `DocDamage/Pydoll` | `main` (`2026-08-23`) | Apache-2.0 | Apache NOTICE retained | `NATIVE_ADAPTATION` | Transparent browser automation driver and state gates | Active |
| **video-dubbing-translator** | `DocDamage/video-dubbing-translator` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Consent-governed subtitle/dubbing pipeline | Active |
| **Lattice** | `DocDamage/Lattice` | `main` (`2026-08-23`) | MIT | Standard MIT notice | `NATIVE_ADAPTATION` | Deterministic game dev simulation and test verification | Active |

---

## 3. Explicit Prohibitions & Enforcements

1. **Zero Monolithic Imports**: No external package.json, full web client, or uncontained daemon is directly imported.
2. **License Invariants**: Noncommercial (PolyForm), ambiguous, or copyleft licenses (MPL/GPL) must NEVER be mixed into the core project-owned MIT/Apache codebase.
3. **No Unsandboxed OS Control**: Unsandboxed keyboard, mouse, or screen automation is strictly rejected.
