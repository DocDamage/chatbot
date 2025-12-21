/**
 * Performance Monitor - Track quality metrics
 * Research: MIT Online Learning, Performance Monitoring
 */

import { logger } from '../observability/logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  metrics: Map<string, number>;
  summary: {
    averageLatency: number;
    successRate: number;
    averageQuality: number;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private windowSize: number = 1000; // Last N metrics

  /**
   * Record metric
   */
  record(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.windowSize) {
      this.metrics.shift();
    }

    logger.debug('Performance metric recorded', { name: metric.name, value: metric.value });
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): PerformanceSnapshot {
    const recent = this.metrics.slice(-100); // Last 100 metrics

    const metricsMap = new Map<string, number[]>();
    for (const metric of recent) {
      if (!metricsMap.has(metric.name)) {
        metricsMap.set(metric.name, []);
      }
      metricsMap.get(metric.name)!.push(metric.value);
    }

    const averages = new Map<string, number>();
    for (const [name, values] of metricsMap.entries()) {
      averages.set(name, values.reduce((sum, v) => sum + v, 0) / values.length);
    }

    const latency = averages.get('latency') || 0;
    const success = averages.get('success_rate') || 0;
    const quality = averages.get('quality') || 0;

    return {
      timestamp: new Date(),
      metrics: averages,
      summary: {
        averageLatency: latency,
        successRate: success,
        averageQuality: quality
      }
    };
  }

  /**
   * Get metric trend
   */
  getTrend(metricName: string, window: number = 10): {
    current: number;
    previous: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const recent = this.metrics
      .filter(m => m.name === metricName)
      .slice(-window * 2);

    if (recent.length < 2) {
      return {
        current: 0,
        previous: 0,
        change: 0,
        trend: 'stable'
      };
    }

    const current = recent.slice(-window);
    const previous = recent.slice(0, window);

    const currentAvg = current.reduce((sum, m) => sum + m.value, 0) / current.length;
    const previousAvg = previous.reduce((sum, m) => sum + m.value, 0) / previous.length;

    const change = currentAvg - previousAvg;
    const trend = Math.abs(change) < 0.01 ? 'stable' : change > 0 ? 'up' : 'down';

    return {
      current: currentAvg,
      previous: previousAvg,
      change,
      trend
    };
  }

  /**
   * Check if performance is degrading
   */
  isDegrading(threshold: number = 0.1): boolean {
    const latencyTrend = this.getTrend('latency');
    const qualityTrend = this.getTrend('quality');

    return (
      (latencyTrend.trend === 'up' && latencyTrend.change > threshold) ||
      (qualityTrend.trend === 'down' && Math.abs(qualityTrend.change) > threshold)
    );
  }
}

