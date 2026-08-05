# ADR-0004 — LLM Provider Support Boundary

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The repository contains adapters or configuration paths for Ollama, OpenAI, Anthropic, Gemini, Hugging Face, generic OpenAI-compatible endpoints, vision providers, and a deterministic template adapter. Adapter presence does not prove current API compatibility, streaming, cancellation, cost accuracy, privacy behavior, model availability, or release canaries.

A narrow initial support boundary is required so Phase 6 can prove rather than assume provider behavior.

## Decision

### Initial production-support targets

- **Hosted profile:** OpenAI direct API.
- **Trusted-local profile:** Ollama.

These providers are targets only. They remain `PRODUCTION_PREVIEW` until the Phase 6 contract suite, live canaries, failure behavior, cost controls, privacy disclosure, and release evidence pass.

### Preview candidates

- Anthropic direct API.
- Google Gemini direct API.
- Generic OpenAI-compatible endpoints.

They may remain visible only as explicitly labeled preview options and must not be required for the initial production release.

### Experimental or internal-only

- Hugging Face inference path: experimental until authentication, endpoint behavior, rate limits, model contracts, and live canaries are defined.
- Vision adapters: separate capability previews; text-provider support does not imply vision support.
- Ensemble and device-routing adapters: experimental until independently evaluated.
- Template adapter: permitted for tests, setup diagnostics, and an explicit degraded-state message only. It is not an LLM provider and must never be presented as the requested model's successful output.

Provider names and model IDs are configuration, not permanent support claims. A release must publish an allowlisted, canary-tested provider/model matrix.

## Alternatives considered

### Support every implemented adapter in the first release

Rejected. It would multiply contract, privacy, cost, outage, and model-drift obligations before the shared provider test suite exists.

### Ollama only

Rejected as the complete product boundary because hosted operation needs a managed remote-provider path.

### Generic OpenAI-compatible only

Rejected as the primary hosted contract because compatible endpoints vary materially in authentication, schemas, streaming, errors, and model behavior.

## Consequences

### Positive

- Initial provider certification has a bounded scope.
- Local-first use remains available without a remote model key.
- Additional providers can be promoted through the same evidence process.

### Negative

- Existing adapters may be hidden or labeled preview.
- Users relying on preview providers receive no production support promise.
- Hard-coded legacy model defaults must be removed or converted to validated configuration.

## Security and data impact

- Provider keys must be encrypted at rest, masked after entry, redacted from logs, and rotatable.
- Users must be told whether prompts, retrieved context, files, and metadata leave the local machine.
- Hosted requests may not silently fall back to another remote provider with different privacy or cost terms.
- Local Ollama endpoints must default to loopback and must not be treated as trusted merely because they are local URLs.

## Verification obligations

- `P06-T01`: publish the exact provider/model capability matrix.
- `P06-T02`: run one contract suite across every promoted provider.
- `P06-T03`: run protected live canaries before release.
- `P06-T04` and `P06-T05`: verify timeout, cancellation, retry, circuit breaking, token limits, and cost ceilings.
- `P07-T01` and `P07-T02`: show requested, active, degraded, and failed provider states accurately.
- `P04-T10`: complete key lifecycle and redaction controls.

## Unresolved assumptions

- Exact OpenAI and Ollama model IDs will be chosen close to release and may change independently of this ADR.
- Streaming and tool-call support are not assumed until tested.
- A later ADR may promote Anthropic, Gemini, or a named compatible provider without reopening the hosted/local product boundary.

## Superseded decisions

None. This ADR supersedes broad environment-example wording that could be mistaken for a support guarantee.

## Repository evidence reviewed

- `src/core/providers/LLMAdapter.ts`
- `src/core/providers/OllamaAdapter.ts`
- `src/core/providers/HuggingFaceAdapter.ts`
- `src/core/providers/UniversalLLM.ts`
- `src/core/initialization/ServiceInitializer.ts`
- `env.example`
- `package.json`
