# Capability Fusion — CF-04 Rolling Record

- Status: `LOCAL_ONLY_EXPERIMENTAL`
- Scope: Workstream CF-04 — Local model and resource adapter layer

> Audit correction (2026-08-24): Core contracts pass focused tests, but the adapter is not registered in the normal application provider bootstrap and the real-hardware canary is unrecorded. This workstream is not 100% surfaced or promotion-ready. See [CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md](./CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md).

## Workstreams & Deliverables

- [x] Provider-neutral, OpenAI-compatible local endpoint contract (`ExternalLocalModelAdapter`).
- [x] Endpoint allowlist limited to loopback/private configured hosts in `local` mode (`LocalEndpointPolicy`).
- [x] Model discovery and capability probing: context length, streaming, embeddings, vision, tools, version, and health states (`LocalModelDiscovery`).
- [x] Resource budget schema for VRAM, concurrency, queue depth, deadline, and cancellation limits (`LocalResourceManager`).
- [x] Deterministic routing policy for privacy (`strict_local`, `prefer_local`), quality, latency, and resource fit (`LocalModelRoutingPolicy`).
- [x] Surfacing provider identity, selected model, degradation state, and fallback reasons to callers.
- [x] Strict rejection of local endpoints and process-management controls in hosted mode.
- [x] Documented real-hardware canary prerequisites (`docs/implementation/canaries/LOCAL_MODEL_CANARY.md`).
