# Dependency, Model, Asset, and Service Terms Register

**Date:** 2026-08-25
**Scope:** Categorized legal and technical boundary register for binary tools, neural model weights, voice datasets, fonts, media codecs, and third-party web services.

---

## 1. Boundary Separation Principle

A permissive code license (MIT / Apache-2.0 / BSD) on a software repository **does not** automatically license:
- Neural network model checkpoints and weights.
- Pretrained speech/voice synthesis models or training datasets.
- Proprietary font files and icon assets.
- Game sample sprites, textures, and 3D meshes.
- External binary tools (e.g. FFmpeg, Tesseract, Ollama).
- Cloud API endpoints and hosted provider terms of service.

Every non-code asset and runtime dependency is cataloged below with its specific redistribution and operational requirements.

---

## 2. Model & Checkpoint Terms

| Model / Weight Family | Domain Area | Origin / Checkpoint Source | License / Terms of Use | Local vs Hosted Policy | Status |
|---|---|---|---|---|---|
| **Demucs (StemDeck)** | Stem separation (`PX-11`) | Meta Research / PyTorch Hub | MIT / CC-BY-NC / Model-specific | Optional local-only download by user; never bundled in hosted repo | External runtime |
| **Whisper / FastWhisper** | Speech-to-Text (`PX-12`, `PX-13`) | OpenAI / Systran | MIT / Apache-2.0 | User-managed local execution via local adapter | External runtime |
| **Piper / Kokoro TTS** | Text-to-Speech (`PX-12`, `PX-15`) | Piper / StyleTTS2 authors | MIT / Apache-2.0 / Open Weights | User-configured local voices; no unauthorized clones | External runtime |
| **Ollama Local LLMs** | Local text/code inference (`PX-07`) | Meta (Llama), Mistral, Qwen | Llama Community / Apache-2.0 | User operates Ollama instance independently; loopback API only | External runtime |
| **Picchio MoE** | Local MoE inference (`PX-07`) | Upstream Picchio / GGUF | Model-specific terms | User-operated local endpoint; no model weights in Git tree | External runtime |

---

## 3. Binaries, Codecs, and System Dependencies

| Dependency | Purpose | Distribution / Runtime Model | License | Compliance Invariant |
|---|---|---|---|---|
| **FFmpeg** | Audio/video slicing, conversion | System binary / user PATH | LGPL-2.1+ / GPL (build-dependent) | Invoked via child process or CLI; never compiled statically into core binary |
| **Tesseract OCR** | Subtitle image OCR (`PX-13`) | System binary / user PATH | Apache-2.0 | User-provided system installation |
| **Godot Engine CLI** | Game editor/runtime verification (`PX-08`) | External binary | MIT | Operated over IPC / MCP / stdio |
| **Unity / Unreal Editors** | Game creation adapters (`PX-09`) | External proprietary editor | Proprietary EULA | Controlled solely via local bridge; no proprietary binaries bundled |
| **DABOOK Python sidecar** (`services/dabook`) | Structure-aware PDF → RAG/training dataset pipeline | Vendored source; deps installed into `services/dabook/.venv` by `npm run setup:dabook`, pinned in `services/dabook/uv.lock` | pypdfium2 (BSD-3-Clause / Apache-2.0, bundles PDFium BSD-3), pydantic, typer, rich, fastapi, tomli_w (MIT), uvicorn, portalocker, psutil (BSD-3-Clause), ftfy, python-multipart (Apache-2.0). Optional extras: `[export]` pyarrow (Apache-2.0); `[tokens]` tiktoken (MIT); `[gpu]` pynvml (BSD-3-Clause). Dev only: pytest (MIT), ruff (MIT), reportlab (BSD-3-Clause), httpx (BSD-3-Clause), jsonschema (MIT) | Invoked as a child process; no Python packages bundled into the Node build. **Network:** DABOOK itself makes no network calls. LLM-assisted SFT (`assist.provider`) talks only to the configured endpoint: a local Ollama server by default, or an operator-supplied OpenAI-compatible endpoint (opt-in, cost-capped; the API key is read from an environment variable and never stored). `tiktoken` downloads its vocabulary from OpenAI's public blob store on first use and falls back to an estimate when offline. Any further extra (e.g. OCR/Docling) must be added here before enabling. Book-derived training data is governed by the license, review and contamination gates described in `DABOOK_INTEGRATION_PLAN.md` Phase 4: only `owned`/`permissive`/`public_domain` books may be exported for training |

---

## 4. Assets, Fonts, and Media Terms

| Asset Category | Target Feature | Permitted License | Prohibition / Boundary |
|---|---|---|---|
| **UI Icons** | Studio dashboards | MIT / Lucide / Feather / Apache-2.0 | No unlicensed stock icons |
| **Typography / Fonts** | Studio clients | SIL Open Font License (OFL) / Inter / Roboto | No commercial proprietary font redistribution |
| **Game / Sprite Samples** | Sprite & Lattice studios | CC0 / Public Domain / MIT | No proprietary game rips or unvetted sprite assets |

---

## 5. Third-Party Service and API Terms

| External Service | Capability Area | Terms Policy | Data Egress Rule |
|---|---|---|---|
| **OpenAI / Anthropic / Gemini** | Cloud LLM providers | Official API terms of service | Egress only when user explicitly configures API keys and selects cloud provider |
| **Web Search (DuckDuckGo / Brave)** | Online retrieval | Official API terms | Egress only when user triggers search-enabled queries |
| **OSM / GIS Providers** | Map layers | OpenStreetMap / ODbL | Tiles fetched client-side with proper attribution |
