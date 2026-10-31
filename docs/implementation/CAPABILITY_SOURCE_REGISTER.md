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
| **Serena** | `oraios/serena` | `5e4f5cd173c7ff3eed37ee3f1de6c266b937c5dc` (`v2.1.0`); runtime `serena-agent==2.1.0` | GPL-3.0-or-later application / MIT SolidLSP | Full component policy and both licenses retained under `services/coding-tools` | `EXTERNAL_SERVICE_ADAPTER` | Separate optional read-only MCP process over selected snapshots; no upstream application code copied into core | Local experimental; `docs/CODING_TOOLS.md` |
| **Aider** | `Aider-AI/aider` | `253f0368b873ba30d8ee26e463718f0c03614ddf` (`v0.86.2`); runtime `aider-chat==0.86.2` | Apache-2.0 | Full license retained; hash-locked Python dependencies separate | `EXTERNAL_SERVICE_ADAPTER` | Scoped private-copy edits, loopback Ollama, no automatic target execution/commits, reviewed patches | Local experimental; `docs/CODING_TOOLS.md` |
| **ast-grep** | `ast-grep/ast-grep` | `48b54b3120b70fa9e8cbb40a03bf3bfebe6bf50a` (`0.51.0`); runtime `@ast-grep/cli@0.51.0` | MIT | Full copyright/license retained; npm integrity lock | `EXTERNAL_SERVICE_ADAPTER` | Direct bounded CLI arguments over selected source, preview-only rewrites | Local experimental; `docs/CODING_TOOLS.md` |
| **Context7** | `upstash/context7` | `7836c583918374fbecffacf866afb7594b919466` (review 2026-10-31); runtime `@upstash/context7-mcp@4.4.4` | MIT | Full copyright/license retained; remote service terms separate | `EXTERNAL_SERVICE_ADAPTER` | Only library resolution/documentation MCP tools, explicit questions, no automatic repository upload | Local experimental; `docs/CODING_TOOLS.md` |
| **REA** | `DocDamage/rea` / `morluto/rea` | `d48e472fa6a664cacbb400560e673533005795ce`; runtime `rea-agents@6.8.0` | MIT | Copyright (c) 2026 morluto; full notice in `services/rea/LICENSE.rea`; separately locked dependencies | `EXTERNAL_SERVICE_ADAPTER` | Local developer/admin static MCP workflows, approved target snapshots, isolated per-job process, owner-scoped evidence; no target execution or arbitrary tool dispatch | Local experimental; see `docs/REA.md` |
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
