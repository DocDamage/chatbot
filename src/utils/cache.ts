/**
 * Enhanced Caching Utilities
 */

import NodeCache from 'node-cache';
import { createHash } from 'crypto';

export class CacheManager {
  private cache: NodeCache;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0
  };

  constructor(ttlSeconds: number = 3600, checkPeriod: number = 600) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: checkPeriod,
      useClones: false
    });
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    this.stats.sets++;
    return this.cache.set(key, value, ttl || 0);
  }

  delete(key: string): number {
    return this.cache.del(key);
  }

  clear(): void {
    this.cache.flushAll();
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      size: this.cache.keys().length
    };
  }

  generateKey(...parts: (string | number)[]): string {
    const combined = parts.join(':');
    return createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }
}

