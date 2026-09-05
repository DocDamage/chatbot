import {
  CANONICAL_METRIC_NAMES,
  CanonicalMetricNameSchema,
  PROHIBITED_HIGH_CARDINALITY_LABELS,
} from './observability-spec';

describe('Observability Specification Types', () => {
  it('verifies exact count of 28 specified metrics (27 base + derived rate)', () => {
    expect(CANONICAL_METRIC_NAMES.length).toBe(28);
  });

  it('validates metric names with zod schema', () => {
    expect(CanonicalMetricNameSchema.safeParse('chat_requests_total').success).toBe(true);
    expect(CanonicalMetricNameSchema.safeParse('unnecessary_retrieval_rate').success).toBe(true);
    expect(CanonicalMetricNameSchema.safeParse('unregistered_metric').success).toBe(false);
  });

  it('verifies prohibited high cardinality labels are specified', () => {
    expect(PROHIBITED_HIGH_CARDINALITY_LABELS).toContain('userId');
    expect(PROHIBITED_HIGH_CARDINALITY_LABELS).toContain('sessionId');
    expect(PROHIBITED_HIGH_CARDINALITY_LABELS).toContain('prompt');
  });
});
