/**
 * Rate Limiting Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../utils/errors';
import { logger } from '../core/observability/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private getKey(req: Request): string {
    // Use IP address or session ID
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
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
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();

      // Get or create rate limit entry
      let entry = this.store[key];
      
      if (!entry || entry.resetTime < now) {
        entry = {
          count: 0,
          resetTime: now + this.windowMs
        };
        this.store[key] = entry;
      }

      entry.count++;

      // Set rate limit headers
      const remaining = Math.max(0, this.maxRequests - entry.count);
      const resetTime = Math.ceil(entry.resetTime / 1000);
      
      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toString());

      if (entry.count > this.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        logger.warn('Rate limit exceeded', { key, count: entry.count, retryAfter });
        throw new RateLimitError('Too many requests', retryAfter);
      }

      next();
    };
  }
}

export const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60')
);

