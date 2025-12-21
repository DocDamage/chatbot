/**
 * Metrics Collection
 */

import { logger } from './logger';

export interface Metrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    byIntent: Record<string, number>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    samples: number[];
  };
  cache: {
    hits: number;
    misses: number;
  };
  errors: {
    byType: Record<string, number>;
    total: number;
  };
}

class MetricsCollector {
  private metrics: Metrics = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
      byIntent: {}
    },
    latency: {
      p50: 0,
      p95: 0,
      p99: 0,
      samples: []
    },
    cache: {
      hits: 0,
      misses: 0
    },
    errors: {
      byType: {},
      total: 0
    }
  };

  recordRequest(success: boolean, intent?: string): void {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    if (intent) {
      this.metrics.requests.byIntent[intent] = (this.metrics.requests.byIntent[intent] || 0) + 1;
    }
  }

  recordLatency(ms: number): void {
    this.metrics.latency.samples.push(ms);
    
    // Keep only last 1000 samples
    if (this.metrics.latency.samples.length > 1000) {
      this.metrics.latency.samples.shift();
    }

    // Calculate percentiles
    if (this.metrics.latency.samples.length > 0) {
      const sorted = [...this.metrics.latency.samples].sort((a, b) => a - b);
      const len = sorted.length;
      this.metrics.latency.p50 = sorted[Math.floor(len * 0.5)] || 0;
      this.metrics.latency.p95 = sorted[Math.floor(len * 0.95)] || 0;
      this.metrics.latency.p99 = sorted[Math.floor(len * 0.99)] || 0;
    }
  }

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
  }

  recordError(errorType: string): void {
    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byIntent: {}
      },
      latency: {
        p50: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      cache: {
        hits: 0,
        misses: 0
      },
      errors: {
        byType: {},
        total: 0
      }
    };
  }
}

export const metricsCollector = new MetricsCollector();

