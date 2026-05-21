/**
 * Multi-Level Cache - L1 (in-memory), L2 (Redis), L3 (disk)
 * Research: Latest caching papers, MIT Systems Group
 */

import { CacheManager } from '../../utils/cache';
import { RedisCache } from './RedisCache';
import { DiskCache } from './DiskCache';
import { CacheAnalytics } from './CacheAnalytics';
import { logger } from '../observability/logger';

export interface CacheLevel {
  level: number;
  name: string;
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear?: () => Promise<void> | void;
}

export class MultiLevelCache<T> {
  private levels: CacheLevel[] = [];
  private l1Cache: CacheManager;
  private l2Cache?: RedisCache;
  private l3Cache?: DiskCache;
  private analytics: CacheAnalytics;
  private cacheTags: Map<string, Set<string>> = new Map(); // key -> tags
  private tagKeys: Map<string, Set<string>> = new Map(); // tag -> keys

  constructor(redisUrl?: string, diskCacheDir?: string) {
    this.analytics = new CacheAnalytics();
    // Initialize L1 (in-memory)
    this.l1Cache = new CacheManager(3600);
    this.levels.push({
      level: 1,
      name: 'memory',
      get: async <T>(key: string) => this.l1Cache.get<T>(key),
      set: async <T>(key: string, value: T, ttl?: number) => {
        this.l1Cache.set(key, value, ttl);
      },
      delete: async (key: string) => {
        this.l1Cache.delete(key);
      },
      clear: () => {
        this.l1Cache.clear();
      },
    });

    // Initialize L2 (Redis) if URL provided
    if (redisUrl) {
      this.l2Cache = new RedisCache(redisUrl);
      this.l2Cache.initialize(redisUrl).then(() => {
        if (this.l2Cache?.isEnabled()) {
          this.levels.push({
            level: 2,
            name: 'redis',
            get: async <T>(key: string) => this.l2Cache!.get<T>(key),
            set: async <T>(key: string, value: T, ttl?: number) => {
              await this.l2Cache!.set(key, value, ttl);
            },
            delete: async (key: string) => {
              await this.l2Cache!.delete(key);
            },
            clear: async () => {
              await this.l2Cache!.clear();
            },
          });
          logger.info('Redis cache (L2) added to multi-level cache');
        }
      });
    }

    // Initialize L3 (Disk) if directory provided
    if (diskCacheDir) {
      this.l3Cache = new DiskCache(diskCacheDir);
      if (this.l3Cache.isEnabled()) {
        this.levels.push({
          level: 3,
          name: 'disk',
          get: async <T>(key: string) => this.l3Cache!.get<T>(key),
          set: async <T>(key: string, value: T, ttl?: number) => {
            await this.l3Cache!.set(key, value, ttl);
          },
          delete: async (key: string) => {
            await this.l3Cache!.delete(key);
          },
          clear: async () => {
            await this.l3Cache!.clear();
          },
        });
        logger.info('Disk cache (L3) added to multi-level cache');
      }
    }

    logger.info('Multi-level cache initialized', { levels: this.levels.length });
  }

  /**
   * Get value from cache (check all levels)
   */
  async get(key: string): Promise<T | undefined> {
    // Try each level in order
    for (const level of this.levels) {
      try {
        const value = await level.get<T>(key);
        if (value !== undefined) {
          this.analytics.recordHit(level.name);
          // Promote to L1 if found in lower level
          if (level.level > 1 && this.l1Cache) {
            await this.l1Cache.set(key, value);
          }
          return value;
        }
      } catch (error) {
        logger.warn(`Cache get failed at level ${level.level}`, { error, key });
      }
    }

    this.analytics.recordMiss('all');
    return undefined;
  }

  /**
   * Set value in cache (write to all levels)
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    // Write to all levels in parallel
    await Promise.all(
      this.levels.map(level => level.set(key, value, ttl))
    );
    logger.debug('Cache set', { key, levels: this.levels.length });
  }

  /**
   * Delete from all levels
   */
  async delete(key: string): Promise<void> {
    await Promise.all(
      this.levels.map(level => level.delete(key))
    );
    logger.debug('Cache deleted', { key });
  }

  /**
   * Clear all configured cache levels and tag indexes.
   */
  async clear(): Promise<void> {
    await Promise.all(
      this.levels.map(async level => {
        if (level.clear) {
          await level.clear();
        }
      })
    );
    this.cacheTags.clear();
    this.tagKeys.clear();
    logger.info('Multi-level cache cleared', { levels: this.levels.map(level => level.name) });
  }

  /**
   * Add cache level
   */
  addLevel(level: CacheLevel): void {
    this.levels.push(level);
    // Sort by level number
    this.levels.sort((a, b) => a.level - b.level);
    logger.info('Cache level added', { level: level.name, levelNumber: level.level });
  }

  /**
   * Get statistics
   */
  getStats() {
    const analytics = this.analytics.getMetrics();
    return {
      levels: this.levels.map(l => l.name),
      hits: analytics.hits,
      misses: analytics.misses,
      hitRate: analytics.hitRate.toFixed(2) + '%',
      size: analytics.size,
      evictions: analytics.evictions,
      levelStats: Object.fromEntries(analytics.levelStats),
    };
  }

  /**
   * Get cache analytics
   */
  getAnalytics() {
    return this.analytics.getMetrics();
  }

  /**
   * Set value with tags for invalidation
   */
  async setWithTags(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    await this.set(key, value, ttl);
    
    if (tags && tags.length > 0) {
      this.cacheTags.set(key, new Set(tags));
      for (const tag of tags) {
        if (!this.tagKeys.has(tag)) {
          this.tagKeys.set(tag, new Set());
        }
        this.tagKeys.get(tag)!.add(key);
      }
    }
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagKeys.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      await this.delete(key);
      count++;
    }

    this.tagKeys.delete(tag);
    logger.info('Cache invalidated by tag', { tag, count });
    return count;
  }

  /**
   * Invalidate cache by tags - OPTIMIZED with parallel execution
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const results = await Promise.all(
      tags.map(tag => this.invalidateByTag(tag))
    );
    return results.reduce((sum, count) => sum + count, 0);
  }

  /**
   * Remove tags for a key
   */
  private removeKeyTags(key: string): void {
    const tags = this.cacheTags.get(key);
    if (tags) {
      for (const tag of tags) {
        const keys = this.tagKeys.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagKeys.delete(tag);
          }
        }
      }
      this.cacheTags.delete(key);
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    logger.info('Warming cache', { entries: entries.length });
    
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }

    logger.info('Cache warmed', { entries: entries.length });
  }
}

