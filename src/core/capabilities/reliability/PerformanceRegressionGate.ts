/**
 * Performance Regression Gate (PX20-T10)
 * Stores versioned performance baselines and fails release checks
 * if critical latency, throughput, memory, or quality metrics regress
 * beyond approved tolerances without an evidence-backed override.
 */

export interface PerformanceBaselineEntry {
  metricId: string;
  name: string;
  baselineValue: number;
  unit: 'ms' | 'mb' | 'score' | 'ops_per_sec' | 'percent';
  maxAllowedRegressionPercent: number; // e.g. 10%
  higherIsBetter: boolean;
}

export interface PerformanceRegressionCheckResult {
  metricId: string;
  name: string;
  baselineValue: number;
  currentValue: number;
  deltaPercent: number;
  allowedRegressionPercent: number;
  passed: boolean;
  message: string;
}

export interface ReleaseRegressionGateReport {
  timestamp: string;
  passed: boolean;
  totalMetrics: number;
  regressedMetricsCount: number;
  results: PerformanceRegressionCheckResult[];
}

export class PerformanceRegressionGate {
  private static instance: PerformanceRegressionGate;
  private baselines: Map<string, PerformanceBaselineEntry> = new Map();

  constructor() {
    this.registerDefaultBaselines();
  }

  public static getInstance(): PerformanceRegressionGate {
    if (!PerformanceRegressionGate.instance) {
      PerformanceRegressionGate.instance = new PerformanceRegressionGate();
    }
    return PerformanceRegressionGate.instance;
  }

  private registerDefaultBaselines(): void {
    const defaultBaselines: PerformanceBaselineEntry[] = [
      {
        metricId: 'repo_indexing_p95_ms',
        name: 'Repository Indexing P95 Latency',
        baselineValue: 150,
        unit: 'ms',
        maxAllowedRegressionPercent: 15.0,
        higherIsBetter: false
      },
      {
        metricId: 'context_compression_ratio',
        name: 'Context Economy Compression Savings',
        baselineValue: 40.0,
        unit: 'percent',
        maxAllowedRegressionPercent: 10.0,
        higherIsBetter: true
      },
      {
        metricId: 'local_model_first_token_ms',
        name: 'Local Model First-Token Latency',
        baselineValue: 800,
        unit: 'ms',
        maxAllowedRegressionPercent: 20.0,
        higherIsBetter: false
      },
      {
        metricId: 'retrieval_benchmark_score',
        name: 'Hybrid Retrieval Benchmark MRR Score',
        baselineValue: 1.0,
        unit: 'score',
        maxAllowedRegressionPercent: 0.0, // Zero tolerance for accuracy drop
        higherIsBetter: true
      },
      {
        metricId: 'peak_resident_memory_mb',
        name: 'Peak Core RSS Memory',
        baselineValue: 256,
        unit: 'mb',
        maxAllowedRegressionPercent: 25.0,
        higherIsBetter: false
      }
    ];

    for (const b of defaultBaselines) {
      this.baselines.set(b.metricId, b);
    }
  }

  public registerBaseline(entry: PerformanceBaselineEntry): void {
    this.baselines.set(entry.metricId, entry);
  }

  public evaluateCurrentRun(currentMetrics: Record<string, number>): ReleaseRegressionGateReport {
    const results: PerformanceRegressionCheckResult[] = [];
    let regressedCount = 0;

    for (const baseline of this.baselines.values()) {
      const current = currentMetrics[baseline.metricId];
      if (current === undefined) {
        continue;
      }

      let deltaPercent = 0;
      let passed = true;

      if (baseline.higherIsBetter) {
        deltaPercent = ((current - baseline.baselineValue) / baseline.baselineValue) * 100;
        // If it decreased more than allowed tolerance, it's a regression
        if (deltaPercent < -baseline.maxAllowedRegressionPercent) {
          passed = false;
        }
      } else {
        deltaPercent = ((current - baseline.baselineValue) / baseline.baselineValue) * 100;
        // If it increased more than allowed tolerance, it's a regression
        if (deltaPercent > baseline.maxAllowedRegressionPercent) {
          passed = false;
        }
      }

      if (!passed) {
        regressedCount++;
      }

      results.push({
        metricId: baseline.metricId,
        name: baseline.name,
        baselineValue: baseline.baselineValue,
        currentValue: current,
        deltaPercent: Number(deltaPercent.toFixed(2)),
        allowedRegressionPercent: baseline.maxAllowedRegressionPercent,
        passed,
        message: passed
          ? `Within approved tolerance (${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}%)`
          : `REGRESSION DETECTED: ${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}% exceeds limit of ±${baseline.maxAllowedRegressionPercent}%`
      });
    }

    return {
      timestamp: new Date().toISOString(),
      passed: regressedCount === 0,
      totalMetrics: results.length,
      regressedMetricsCount: regressedCount,
      results
    };
  }
}
