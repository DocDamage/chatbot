/**
 * Section 45: Canonical Metrics Registry & Observability Service
 * Implements the 27 specified metrics, cardinality sanitization, and Prometheus formatting.
 */
import {
  CanonicalMetricName,
  CANONICAL_METRIC_NAMES,
  PROHIBITED_HIGH_CARDINALITY_LABELS,
  MetricSample,
} from '../../types/observability-spec';

export interface MetricCounterState {
  count: number;
  labels: Record<string, string>;
}

export interface MetricHistogramState {
  count: number;
  sum: number;
  min: number;
  max: number;
  labels: Record<string, string>;
}

export class CanonicalMetricsRegistry {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, { count: number; sum: number; min: number; max: number }> = new Map();
  private recordedSamples: MetricSample[] = [];

  sanitizeLabels(labels?: Record<string, string>): Record<string, string> {
    if (!labels) return {};
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      // Guardrail against high cardinality labels (§45)
      const isProhibited = PROHIBITED_HIGH_CARDINALITY_LABELS.some(
        (p) => p.toLowerCase() === key.toLowerCase(),
      );
      if (!isProhibited) {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  private makeKey(metricName: CanonicalMetricName, labels: Record<string, string>): string {
    const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    const labelStr = sortedEntries.map(([k, v]) => `${k}="${v}"`).join(',');
    return labelStr ? `${metricName}{${labelStr}}` : metricName;
  }

  increment(metricName: CanonicalMetricName, value = 1, rawLabels?: Record<string, string>): void {
    const labels = this.sanitizeLabels(rawLabels);
    const key = this.makeKey(metricName, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.recordedSamples.push({
      metricName,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  recordDuration(metricName: CanonicalMetricName, durationMs: number, rawLabels?: Record<string, string>): void {
    const labels = this.sanitizeLabels(rawLabels);
    const key = this.makeKey(metricName, labels);
    const existing = this.histograms.get(key) || { count: 0, sum: 0, min: Infinity, max: -Infinity };

    existing.count += 1;
    existing.sum += durationMs;
    existing.min = Math.min(existing.min, durationMs);
    existing.max = Math.max(existing.max, durationMs);

    this.histograms.set(key, existing);

    this.recordedSamples.push({
      metricName,
      value: durationMs,
      labels,
      timestamp: Date.now(),
    });
  }

  getCounterValue(metricName: CanonicalMetricName, labels: Record<string, string> = {}): number {
    const sanitized = this.sanitizeLabels(labels);
    const key = this.makeKey(metricName, sanitized);
    return this.counters.get(key) || 0;
  }

  getHistogramSummary(metricName: CanonicalMetricName, labels: Record<string, string> = {}) {
    const sanitized = this.sanitizeLabels(labels);
    const key = this.makeKey(metricName, sanitized);
    return this.histograms.get(key) || null;
  }

  getDerivedUnnecessaryRetrievalRate(): number {
    let totalRag = 0;
    let insufficientGrounding = 0;

    for (const [key, val] of this.counters.entries()) {
      if (key.startsWith('rag_queries_total')) {
        totalRag += val;
      }
      if (key.startsWith('rag_grounding_insufficient_total')) {
        insufficientGrounding += val;
      }
    }

    if (totalRag === 0) return 0;
    return insufficientGrounding / totalRag;
  }

  exportPrometheus(): string {
    const lines: string[] = [];

    // Export counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`${key} ${value}`);
    }

    // Export histograms
    for (const [key, val] of this.histograms.entries()) {
      lines.push(`${key}_count ${val.count}`);
      lines.push(`${key}_sum ${val.sum}`);
    }

    // Export derived unnecessary_retrieval_rate
    const rate = this.getDerivedUnnecessaryRetrievalRate();
    lines.push(`unnecessary_retrieval_rate ${rate.toFixed(4)}`);

    return lines.join('\n');
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.recordedSamples = [];
  }
}
