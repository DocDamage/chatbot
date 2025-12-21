/**
 * A/B Tester - Test new models/strategies
 * Research: MIT Online Learning, A/B Testing Best Practices
 */

import { logger } from '../observability/logger';

export interface ABTest {
  id: string;
  name: string;
  variants: {
    id: string;
    name: string;
    weight: number; // 0-1, sum should be 1
  }[];
  metrics: string[];
  startDate: Date;
  endDate?: Date;
  active: boolean;
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  userId: string;
  metric: string;
  value: number;
  timestamp: Date;
}

export class ABTester {
  private tests: Map<string, ABTest> = new Map();
  private results: ABTestResult[] = [];

  /**
   * Create A/B test
   */
  createTest(test: ABTest): void {
    this.tests.set(test.id, test);
    logger.info('A/B test created', { testId: test.id, name: test.name });
  }

  /**
   * Assign user to variant
   */
  assignVariant(testId: string, userId: string): string {
    const test = this.tests.get(testId);
    if (!test || !test.active) {
      return 'control'; // Default
    }

    // Weighted random assignment
    const random = Math.random();
    let cumulative = 0;

    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        logger.debug('Variant assigned', { testId, userId, variantId: variant.id });
        return variant.id;
      }
    }

    return test.variants[test.variants.length - 1].id; // Fallback
  }

  /**
   * Record test result
   */
  recordResult(result: ABTestResult): void {
    this.results.push(result);
    logger.debug('A/B test result recorded', {
      testId: result.testId,
      variantId: result.variantId,
      metric: result.metric
    });
  }

  /**
   * Get test results
   */
  getResults(testId: string): {
    variant: string;
    metric: string;
    average: number;
    count: number;
  }[] {
    const test = this.tests.get(testId);
    if (!test) return [];

    const variantResults = new Map<string, Map<string, number[]>>();

    for (const result of this.results) {
      if (result.testId === testId) {
        if (!variantResults.has(result.variantId)) {
          variantResults.set(result.variantId, new Map());
        }
        const variantMetrics = variantResults.get(result.variantId)!;
        if (!variantMetrics.has(result.metric)) {
          variantMetrics.set(result.metric, []);
        }
        variantMetrics.get(result.metric)!.push(result.value);
      }
    }

    const summary: Array<{ variant: string; metric: string; average: number; count: number }> = [];

    for (const [variantId, metrics] of variantResults.entries()) {
      for (const [metric, values] of metrics.entries()) {
        const average = values.reduce((sum, v) => sum + v, 0) / values.length;
        summary.push({
          variant: variantId,
          metric,
          average,
          count: values.length
        });
      }
    }

    return summary;
  }

  /**
   * Get active tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.tests.values()).filter(t => t.active);
  }
}

