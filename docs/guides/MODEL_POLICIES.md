# Model Policies & Provider Routing Guide

## 1. Overview
The Model Routing system intelligently assigns user requests to optimal model tiers based on task complexity, latency requirements, cost limits, and provider health.

## 2. Model Capability Tiers
The runtime categorizes models into three primary tiers:
- **Fast / Lightweight (`Tier 1`)**:
  - Targets: Intent classification, simple state extraction, chitchat, summarization.
  - Typical models: `gpt-4o-mini`, `claude-3-haiku`, `gemini-1.5-flash`, `ollama:llama3-8b`.
  - Latency: < 400ms target.
- **Balanced / Standard (`Tier 2`)**:
  - Targets: General question answering, documentation synthesis, coding explanations.
  - Typical models: `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`.
  - Latency: < 1500ms target.
- **Complex / Reasoning (`Tier 3`)**:
  - Targets: Multi-step architectural refactoring, complex mathematical proofs, deep debug analysis.
  - Typical models: `o1-preview`, `o3-mini`, `claude-3-opus`.
  - Latency: Higher latency tolerated for rigorous reasoning.

## 3. Provider Fallback & Circuit Breakers
If the primary provider for an assigned model tier encounters consecutive errors or rate limits:
1. The circuit breaker trips into `OPEN` state.
2. Requests seamlessly fall back to secondary configured providers (e.g., Anthropic -> OpenAI -> Gemini -> Local Ollama).
3. Background health checks periodically probe the primary provider until the circuit transitions to `HALF_OPEN` and resets to `CLOSED`.

## 4. Policy Configuration & Overrides
Operators configure provider preferences in `config/models.json` or through bot profiles. User-requested model overrides are honored only when allowed by the workspace policy.
