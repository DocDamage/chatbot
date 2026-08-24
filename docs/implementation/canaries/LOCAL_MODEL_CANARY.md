# Real-Hardware Local Model Canary Guide (CF-04)

> Status: Operational runbook and verification canary for Milestone CF-04.
> Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Objective

Validate that AI Chatbot Hub can safely communicate with a separately operated local model server (such as Warpdrv, llama.cpp server, or Ollama) running on the operator's machine without embedding server binaries or spawning background processes.

## Operator Prerequisites

1. **Hardware Requirements**:
   - Host OS: Windows 11 x64 or Linux x86_64 / ARM64.
   - RAM: Minimum 16 GB system memory (32 GB+ recommended for 14B+ models).
   - GPU (Optional but recommended): NVIDIA RTX (6GB+ VRAM for 7B/8B Q4_K_M quantizations, 16GB+ for 14B/32B quantizations) or Apple Silicon.
2. **Separately Installed Local Server** (Choose one):
   - **Warpdrv / llama.cpp server**: Running at `http://127.0.0.1:8080/v1` (e.g. `llama-server -m models/qwen2.5-coder-7b-instruct.Q4_K_M.gguf --port 8080 --ctx-size 32768`).
   - **Ollama**: Running at `http://127.0.0.1:11434/v1` (e.g. `ollama run qwen2.5-coder:7b`).
   - **LM Studio / vLLM**: Serving an OpenAI-compatible API on loopback.

> [!IMPORTANT]
> AI Chatbot Hub does NOT download model weights, compile `llama.cpp`, or launch server subprocesses. The local server must be started separately by the operator.

## Configuration Steps

1. In your local `.env` file, configure the endpoint:
   ```env
   LOCAL_MODEL_ENABLED=true
   LOCAL_MODEL_BASE_URL=http://127.0.0.1:8080/v1
   LOCAL_MODEL_PROVIDER_NAME=warpdrv
   LOCAL_MODEL_ALLOWLIST=127.0.0.1,localhost,::1
   LOCAL_MODEL_MAX_CONCURRENCY=2
   LOCAL_MODEL_MAX_QUEUE_DEPTH=8
   LOCAL_MODEL_TIMEOUT_MS=60000
   LOCAL_MODEL_ROUTING_PRIVACY_MODE=prefer_local
   ```

2. Verify that `DEPLOYMENT_MODE` is set to `development` or `local` (local models are strictly rejected if `DEPLOYMENT_MODE=hosted`).

## Verification Canary Steps

1. **Model Discovery and Capability Probe**:
   Execute the automated capability discovery check:
   ```powershell
   npx jest src/core/providers/local/LocalModelAdapter.test.ts --runInBand
   ```

2. **Verify SSRF & Hosted-Mode Denial**:
   Confirm that attempts to target non-allowlisted hosts or execute under `hosted` mode fail closed:
   ```powershell
   npm run type-check:server
   npm run lint:server
   ```

3. **Verify Routing & Fallback**:
   Confirm that `prefer_local` successfully routes to the local model when healthy, and `strict_local` prevents any external data transmission if the local model is unavailable.
