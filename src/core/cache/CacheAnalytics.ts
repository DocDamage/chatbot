/**
 * Cache Analytics - Track cache effectiveness
 */

import { logger } from '../observability/logger';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
  levelStats: Map<string, {
    hits: number;
    misses: number;
    hitRate: number;
  }>;
}

export class CacheAnalytics {
  private metrics: CacheMetrics;
  private levelStats: Map<string, { hits: number; misses: number }> = new Map();

  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      evictions: 0,
      levelStats: new Map(),
    };
  }

  /**
   * Record a cache hit
   */
  recordHit(level: string): void {
    this.metrics.hits++;
    this.updateLevelStats(level, true);
    this.updateHitRate();
    logger.debug('Cache hit', { level });
  }

  /**
   * Record a cache miss
   */
  recordMiss(level: string): void {
    this.metrics.misses++;
    this.updateLevelStats(level, false);
    this.updateHitRate();
    logger.debug('Cache miss', { level });
  }

  /**
   * Record cache eviction
   */
  recordEviction(): void {
    this.metrics.evictions++;
  }

  /**
   * Update cache size
   */
  updateSize(size: number): void {
    this.metrics.size = size;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics for a specific level
   */
  getLevelMetrics(level: string): { hits: number; misses: number; hitRate: number } | undefined {
    const stats = this.levelStats.get(level);
    if (!stats) return undefined;

    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      evictions: 0,
      levelStats: new Map(),
    };
    this.levelStats.clear();
  }

  /**
   * Update level statistics
   */
  private updateLevelStats(level: string, isHit: boolean): void {
    const stats = this.levelStats.get(level) || { hits: 0, misses: 0 };
    if (isHit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    this.levelStats.set(level, stats);

    // Update level stats in metrics
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
    this.metrics.levelStats.set(level, {
      hits: stats.hits,
      misses: stats.misses,
      hitRate,
    });
  }

  /**
   * Update overall hit rate
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }
}

