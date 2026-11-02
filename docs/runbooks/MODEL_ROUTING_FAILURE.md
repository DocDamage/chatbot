# Runbook: Model Routing Failure & Provider Outage Triage

## 1. Severity & Impact
- **Severity**: P1 (Critical) if no models respond; P2 (High) if routing is degraded to fallback providers.
- **Impact**: Increased latency, rate limit errors (HTTP 429), model generation timeouts, or empty responses.

## 2. Detection & Alerts
- Alert: `ModelProviderCircuitBreakerOpen` triggered when a provider experiences > 5 consecutive failures.
- Alert: `ModelQuotaDepleted` triggered on 429 rate limit errors from upstream LLM providers.
- Metric: `model_provider_errors_total{provider="<name>"} > 5`.

## 3. Triage & Incident Investigation
1. **Identify Failing Provider**:
   Inspect recent model execution errors:
   `GET /api/debug/chat-runs?failureCode=MODEL_TIMEOUT,MODEL_RATE_LIMITED`
2. **Check Upstream Provider Status Pages**:
   Verify external health status for OpenAI, Anthropic, Google Gemini, or local Ollama daemon.
3. **Verify Active Circuit Breaker State**:
   Confirm that the `ModelExecutionEngine` has automatically diverted traffic to secondary providers.

## 4. Remediation Steps
- **Force Manual Provider Failover**:
  Update runtime environment flags or bot profiles to prioritize alternative providers (e.g. divert OpenAI traffic to Anthropic or Gemini).
- **Activate Local Ollama Fallback**:
  If external cloud APIs are unreachable, route essential traffic to locally hosted models (e.g. `llama3:8b`).
- **Reset Circuit Breaker**:
  Once provider health is confirmed restored:
  Send a health probe or restart provider connections to return state to `CLOSED`.
