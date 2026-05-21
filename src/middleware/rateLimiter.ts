/**
 * Rate Limiting Middleware
 * Supports IP-based, user-based, and API key-based rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitError, ServiceUnavailableError } from '../utils/errors';
import { logger } from '../core/observability/logger';
import Redis from 'ioredis';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  failOpen?: boolean;
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;
  private redisClient?: Redis;
  private useRedis: boolean;
  private keyGenerator: (req: Request) => string;
  private failOpen: boolean;

  constructor(
    windowMs: number = 60000,
    maxRequests: number = 60,
    redisUrl?: string,
    keyGenerator?: (req: Request) => string,
    failOpen: boolean = process.env.RATE_LIMIT_FAIL_OPEN
      ? process.env.RATE_LIMIT_FAIL_OPEN === 'true'
      : process.env.NODE_ENV !== 'production'
  ) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyGenerator = keyGenerator || this.defaultKeyGenerator;
    this.failOpen = failOpen;
    this.useRedis = !!redisUrl;

    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          lazyConnect: true
        });
        this.redisClient.on('error', (err) => {
          logger.warn('Redis connection error, falling back to memory', { error: err.message });
          this.useRedis = false;
        });
        logger.info('Rate limiter using Redis');
      } catch (error) {
        logger.warn('Failed to connect to Redis, using memory store', { error });
        this.useRedis = false;
      }
    }
    
    // Clean up old entries every minute
    const cleanupTimer = setInterval(() => this.cleanup(), 60000);
    cleanupTimer.unref?.();
  }

  private defaultKeyGenerator(req: Request): string {
    // Priority: userId > apiKey > sessionId > IP
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    if (req.apiKey?.id) {
      return `apikey:${req.apiKey.id}`;
    }
    if (req.body?.sessionId) {
      return `session:${req.body.sessionId}`;
    }
    return `ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
  }

  private getKey(req: Request): string {
    return this.keyGenerator(req);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();

      try {
        let count: number;
        let resetTime: number;

        if (this.useRedis && this.redisClient) {
          // Use Redis for distributed rate limiting
          const redisKey = `ratelimit:${key}`;
          const current = await this.redisClient.incr(redisKey);
          
          if (current === 1) {
            // First request in window, set expiry
            await this.redisClient.pexpire(redisKey, this.windowMs);
            resetTime = now + this.windowMs;
          } else {
            const ttl = await this.redisClient.pttl(redisKey);
            resetTime = now + ttl;
          }

          count = current;
        } else {
          // Use in-memory store
          let entry = this.store[key];
          
          if (!entry || entry.resetTime < now) {
            entry = {
              count: 0,
              resetTime: now + this.windowMs
            };
            this.store[key] = entry;
          }

          entry.count++;
          count = entry.count;
          resetTime = entry.resetTime;
        }

        // Check API key rate limit if present
        if (req.apiKey?.rateLimit) {
          const apiKeyLimit = req.apiKey.rateLimit;
          if (count > apiKeyLimit) {
            const retryAfter = Math.ceil((resetTime - now) / 1000);
            logger.warn('API key rate limit exceeded', { 
              key, 
              count, 
              limit: apiKeyLimit,
              retryAfter 
            });
            throw new RateLimitError('API key rate limit exceeded', retryAfter);
          }
        }

        // Set rate limit headers
        const remaining = Math.max(0, this.maxRequests - count);
        const resetTimeSeconds = Math.ceil(resetTime / 1000);
        
        res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', resetTimeSeconds.toString());

        if (count > this.maxRequests) {
          const retryAfter = Math.ceil((resetTime - now) / 1000);
          logger.warn('Rate limit exceeded', { key, count, retryAfter });
          throw new RateLimitError('Too many requests', retryAfter);
        }

        next();
      } catch (error) {
        if (error instanceof RateLimitError) {
          next(error);
          return;
        }
        logger.error('Rate limit check failed', {
          error,
          failOpen: this.failOpen
        });
        if (this.failOpen) {
          next();
          return;
        }
        next(new ServiceUnavailableError('rate-limiter', 'Rate limiter unavailable'));
      }
    };
  }

  /**
   * Create rate limiter with custom config
   */
  static create(config: RateLimitConfig, redisUrl?: string): RateLimiter {
    return new RateLimiter(
      config.windowMs,
      config.maxRequests,
      redisUrl,
      config.keyGenerator,
      config.failOpen
    );
  }
}

export const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),
  process.env.REDIS_URL
);

