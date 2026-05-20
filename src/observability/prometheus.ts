/**
 * Prometheus Metrics Exporter
 */

import { metricsCollector } from '../core/observability/metrics';
import { logger } from '../core/observability/logger';

export class PrometheusExporter {
  private metrics: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    this.metrics.set(key, value);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  /**
   * Export metrics in Prometheus format
   */
  export(): string {
    const lines: string[] = [];

    // Export gauges
    for (const [key, value] of this.metrics.entries()) {
      lines.push(`${key} ${value}`);
    }

    // Export counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`${key} ${value}`);
    }

    // Export histograms (simplified - just average)
    for (const [key, values] of this.histograms.entries()) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      lines.push(`${key}_avg ${avg}`);
      lines.push(`${key}_count ${values.length}`);
    }

    // Add application metrics
    const appMetrics = metricsCollector.getMetrics();
    lines.push(`chatbot_requests_total ${appMetrics.requests.total}`);
    lines.push(`chatbot_requests_success ${appMetrics.requests.successful}`);
    lines.push(`chatbot_requests_failed ${appMetrics.requests.failed}`);
    lines.push(`chatbot_latency_p50 ${appMetrics.latency.p50}`);
    lines.push(`chatbot_latency_p95 ${appMetrics.latency.p95}`);
    lines.push(`chatbot_latency_p99 ${appMetrics.latency.p99}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Format metric key with labels
   */
  private formatKey(name: string, labels?: Record<string, string>): string {
    let key = name.replace(/[^a-zA-Z0-9_]/g, '_');

    if (labels) {
      const labelParts = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      key = `${key}{${labelParts}}`;
    }

    return key;
  }

  /**
   * Get metrics from application
   */
  static getApplicationMetrics(): string {
    const exporter = new PrometheusExporter();
    const appMetrics = metricsCollector.getMetrics();

    // Export request metrics
    exporter.recordGauge('chatbot_requests_total', appMetrics.requests.total);
    exporter.recordGauge('chatbot_requests_success', appMetrics.requests.successful);
    exporter.recordGauge('chatbot_requests_failed', appMetrics.requests.failed);

    // Export latency metrics
    exporter.recordGauge('chatbot_latency_p50', appMetrics.latency.p50);
    exporter.recordGauge('chatbot_latency_p95', appMetrics.latency.p95);
    exporter.recordGauge('chatbot_latency_p99', appMetrics.latency.p99);

    // Export cache metrics
    if (appMetrics.cache) {
      exporter.recordGauge('chatbot_cache_hits', appMetrics.cache.hits);
      exporter.recordGauge('chatbot_cache_misses', appMetrics.cache.misses);
      const totalCacheLookups = appMetrics.cache.hits + appMetrics.cache.misses;
      exporter.recordGauge(
        'chatbot_cache_hit_rate',
        totalCacheLookups > 0 ? appMetrics.cache.hits / totalCacheLookups : 0
      );
    }

    return exporter.export();
  }
}

