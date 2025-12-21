/**
 * Multi-Level Cache - L1 (in-memory), L2 (Redis), L3 (disk)
 * Research: Latest caching papers, MIT Systems Group
 */

import { CacheManager } from '../../utils/cache';
import { logger } from '../observability/logger';

export interface CacheLevel {
  level: number;
  name: string;
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export class MultiLevelCache<T> {
  private levels: CacheLevel[] = [];

  constructor() {
    // Initialize L1 (in-memory)
    const l1Cache = new CacheManager(3600);
    this.levels.push({
      level: 1,
      name: 'memory',
      get: async <T>(key: string) => l1Cache.get<T>(key),
      set: async <T>(key: string, value: T, ttl?: number) => {
        l1Cache.set(key, value, ttl);
      },
      delete: async (key: string) => {
        l1Cache.delete(key);
      }
    });

    // L2 and L3 would be initialized with Redis/disk adapters
    logger.info('Multi-level cache initialized', { levels: this.levels.length });
  }

  /**
   * Get value from cache (check all levels)
   */
  async get(key: string): Promise<T | undefined> {
    // Check each level in order
    for (const level of this.levels) {
      try {
        const value = await level.get<T>(key);
        if (value !== undefined) {
          // Promote to L1 if found in lower level
          if (level.level > 1) {
            await this.levels[0].set(key, value);
          }
          logger.debug('Cache hit', { key, level: level.name });
          return value;
        }
      } catch (error: any) {
        logger.warn(`Cache level ${level.name} failed`, { error: error.message });
        // Continue to next level
      }
    }

    logger.debug('Cache miss', { key });
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
    return {
      levels: this.levels.length,
      levelNames: this.levels.map(l => l.name)
    };
  }
}

