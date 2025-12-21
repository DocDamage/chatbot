/**
 * Redis Cache - L2 cache implementation
 */

import Redis from 'ioredis';
import { logger } from '../observability/logger';

export class RedisCache {
  private client: Redis | null = null;
  private enabled: boolean = false;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.initialize(redisUrl);
    }
  }

  /**
   * Initialize Redis connection
   */
  async initialize(redisUrl: string = 'redis://localhost:6379'): Promise<void> {
    try {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3
      });

      this.client.on('error', (error) => {
        logger.warn('Redis connection error', { error: error.message });
        this.enabled = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected', { url: redisUrl });
        this.enabled = true;
      });

      // Test connection
      await this.client.ping();
      this.enabled = true;
    } catch (error: any) {
      logger.warn('Redis initialization failed', { error: error.message });
      this.enabled = false;
    }
  }

  /**
   * Get value from Redis
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled || !this.client) {
      return undefined;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return undefined;
    } catch (error: any) {
      logger.warn('Redis get failed', { key, error: error.message });
      return undefined;
    }
  }

  /**
   * Set value in Redis
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error: any) {
      logger.warn('Redis set failed', { key, error: error.message });
    }
  }

  /**
   * Delete key from Redis
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error: any) {
      logger.warn('Redis delete failed', { key, error: error.message });
    }
  }

  /**
   * Check if Redis is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.enabled = false;
    }
  }
}

