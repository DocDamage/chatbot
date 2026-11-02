# ADR-0014: Local Model and Resource Adapter Layer

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-04
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-04 delivers a provider-neutral, OpenAI-compatible local model adapter layer to connect to separately operated local model servers (e.g. Warpdrv, llama.cpp server, Ollama, vLLM, LM Studio) in `LOCAL_TRUSTED` / `local` mode.

1. **OpenAI-Compatible Local Endpoint Contract**:
   `ExternalLocalModelAdapter` implements the standard `LLMAdapter` interface and supports chat completions, streaming SSE chunks, embeddings, and capability probing.
2. **Strict SSRF & Allowlist Policy**:
   `LocalEndpointPolicy` restricts outbound connections to loopback (`127.0.0.1`, `localhost`, `::1`) or explicitly allowlisted hosts. Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`) and wildcard bindings are strictly rejected.
3. **Hosted Mode Rejection**:
   In `HOSTED` / `hosted` mode, local model endpoints and process-management controls are strictly rejected and cannot be activated.
4. **Capability Probing & Health States**:
   `LocalModelDiscovery` probes context windows, tool calling, vision, embeddings, version headers, and health states (`healthy`, `startup_unavailable`, `overloaded`, `version_mismatch`, `incompatible`, `unreachable`).
5. **Resource Budgets & Concurrency Enforcer**:
   `LocalResourceManager` tracks concurrency slots, queue depths, and VRAM limits, enforcing graceful queueing, timeout bounds, and cancellation via `AbortSignal`.
6. **Deterministic Routing Policy & Caller Telemetry**:
   `LocalModelRoutingPolicy` supports `strict_local`, `prefer_local`, and `local_disabled` privacy modes, surfacing degradation states (`fallback_to_cloud`, `fallback_to_template`, `overloaded_rejected`) and explicit fallback reasons to callers.

## Boundaries and Security Invariants

- **Zero Process Management Authority**: No binary download, no background compilation of `llama.cpp`, and no server process launching (`child_process.spawn`/`exec`) is performed by AI Chatbot Hub. The user/operator is responsible for launching and operating their local model endpoint independently.
- **Clean License Boundary**: No Warpdrv (AGPL-3.0) or Guaardvark code is copied into the MIT codebase. Integration occurs purely over the standard OpenAI-compatible HTTP REST protocol.
- **Authority Preservation**: No new shell, filesystem write, Git-write, browser-control, or hosted-filesystem authority is introduced.
