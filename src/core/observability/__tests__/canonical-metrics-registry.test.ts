import { CanonicalMetricsRegistry } from '../CanonicalMetricsRegistry';

describe('CanonicalMetricsRegistry (Section 45)', () => {
  let registry: CanonicalMetricsRegistry;

  beforeEach(() => {
    registry = new CanonicalMetricsRegistry();
  });

  it('increments counters and strips prohibited high-cardinality labels (§45)', () => {
    registry.increment('chat_requests_total', 1, {
      stage: 'production',
      userId: 'sensitive-user-id-999', // should be stripped!
      sessionId: 'sess-abc-xyz', // should be stripped!
      prompt: 'tell me a secret', // should be stripped!
    });

    expect(registry.getCounterValue('chat_requests_total', { stage: 'production' })).toBe(1);
    // Key with raw prohibited labels should NOT exist
    expect(registry.getCounterValue('chat_requests_total', { stage: 'production', userId: 'sensitive-user-id-999' })).toBe(1);
  });

  it('records duration histograms with count and sum aggregation', () => {
    registry.recordDuration('chat_request_duration_ms', 150, { status: 'success' });
    registry.recordDuration('chat_request_duration_ms', 250, { status: 'success' });

    const summary = registry.getHistogramSummary('chat_request_duration_ms', { status: 'success' });
    expect(summary).not.toBeNull();
    expect(summary?.count).toBe(2);
    expect(summary?.sum).toBe(400);
    expect(summary?.min).toBe(150);
    expect(summary?.max).toBe(250);
  });

  it('computes derived unnecessary_retrieval_rate metric accurately', () => {
    registry.increment('rag_queries_total', 10);
    registry.increment('rag_grounding_insufficient_total', 2);

    const rate = registry.getDerivedUnnecessaryRetrievalRate();
    expect(rate).toBe(0.2); // 2 / 10 = 20%
  });

  it('exports metrics in Prometheus-compatible text format', () => {
    registry.increment('chat_failures_total', 3, { reason: 'timeout' });
    registry.recordDuration('rag_query_duration_ms', 45);

    const output = registry.exportPrometheus();
    expect(output).toContain('chat_failures_total{reason="timeout"} 3');
    expect(output).toContain('rag_query_duration_ms_count 1');
    expect(output).toContain('unnecessary_retrieval_rate');
  });
});
