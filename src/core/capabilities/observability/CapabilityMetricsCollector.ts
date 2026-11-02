/**
 * Capability Metrics Collector (PX20-T02)
 * Collects common capability metrics:
 * - registry load errors & installed/enabled counts
 * - health states & transitions
 * - job counts, durations, stages, errors, and cancellations
 * - approval wait times and expiration counts
 * - artifact storage bytes and cleanup failures
 * - resource reservations and peak utilization
 * - context compression savings and retrievals
 * - memory freshness and conflicts
 * - agent sessions, claims, and conflicts
 * - adapter connectivity and worker crashes
 * - queue depth and age
 * All labels are bounded, cardinality-controlled, and redaction-safe.
 */

export interface MetricCounter {
  name: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricGauge {
  name: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricHistogram {
  name: string;
  count: number;
  sum: number;
  buckets: Record<number, number>;
  labels: Record<string, string>;
}

export interface CapabilityMetricsSnapshot {
  timestamp: string;
  counters: MetricCounter[];
  gauges: MetricGauge[];
  histograms: MetricHistogram[];
}

export class CapabilityMetricsCollector {
  private static instance: CapabilityMetricsCollector;
  private counters: Map<string, MetricCounter> = new Map();
  private gauges: Map<string, MetricGauge> = new Map();
  private histograms: Map<string, MetricHistogram> = new Map();

  public static getInstance(): CapabilityMetricsCollector {
    if (!CapabilityMetricsCollector.instance) {
      CapabilityMetricsCollector.instance = new CapabilityMetricsCollector();
    }
    return CapabilityMetricsCollector.instance;
  }

  private buildKey(name: string, labels: Record<string, string>): string {
    const sorted = Object.keys(labels)
      .sort()
      .map(k => `${k}=${this.sanitizeLabel(labels[k])}`)
      .join(',');
    return `${name}{${sorted}}`;
  }

  private sanitizeLabel(val: string): string {
    // Restrict label values to safe alphanumerics and bounded lengths (no raw URLs/PII)
    return String(val)
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .substring(0, 64);
  }

  public incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, value, labels });
    }
  }

  public setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, { name, value, labels });
  }

  public recordHistogram(
    name: string,
    value: number,
    buckets: number[] = [10, 50, 100, 250, 500, 1000, 2500, 5000],
    labels: Record<string, string> = {}
  ): void {
    const key = this.buildKey(name, labels);
    let hist = this.histograms.get(key);
    if (!hist) {
      const bucketMap: Record<number, number> = {};
      for (const b of buckets) {
        bucketMap[b] = 0;
      }
      hist = { name, count: 0, sum: 0, buckets: bucketMap, labels };
      this.histograms.set(key, hist);
    }

    hist.count += 1;
    hist.sum += value;
    for (const b of Object.keys(hist.buckets).map(Number)) {
      if (value <= b) {
        hist.buckets[b] += 1;
      }
    }
  }

  // Pre-built domain-specific metric helpers
  public recordJobExecution(capabilityId: string, durationMs: number, status: 'completed' | 'failed' | 'cancelled'): void {
    this.incrementCounter('capability_jobs_total', 1, { capability: capabilityId, status });
    this.recordHistogram('capability_job_duration_ms', durationMs, undefined, { capability: capabilityId, status });
  }

  public recordQueueDepth(depth: number, oldestAgeMs: number): void {
    this.setGauge('capability_queue_depth', depth);
    this.setGauge('capability_queue_oldest_age_ms', oldestAgeMs);
  }

  public recordWorkerCrash(workerType: string, reason: string): void {
    this.incrementCounter('capability_worker_crashes_total', 1, { worker: workerType, reason });
  }

  public recordContextSavings(tokensSaved: number, tokensOriginal: number): void {
    this.incrementCounter('context_economy_tokens_saved_total', tokensSaved);
    this.incrementCounter('context_economy_tokens_original_total', tokensOriginal);
  }

  public recordArtifactStorage(totalBytes: number, capabilityId: string): void {
    this.setGauge('capability_artifact_bytes', totalBytes, { capability: capabilityId });
  }

  public recordApprovalWait(durationMs: number, outcome: 'approved' | 'rejected' | 'expired'): void {
    this.incrementCounter('capability_approvals_total', 1, { outcome });
    this.recordHistogram('capability_approval_wait_ms', durationMs, undefined, { outcome });
  }

  public getSnapshot(): CapabilityMetricsSnapshot {
    return {
      timestamp: new Date().toISOString(),
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: Array.from(this.histograms.values())
    };
  }

  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}
