/**
 * Retry utility with exponential backoff
 */

import { logger } from '../core/observability/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
}

/**
 * Default retryable error checker
 */
function isRetryableError(error: any): boolean {
  // Network errors, timeouts, 5xx errors are retryable
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    return true;
  }

  if (error.response) {
    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors and rate limits
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryableErrors = isRetryableError,
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
      };
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!retryableErrors(error)) {
        logger.debug('Error not retryable', { error: error.message, attempt });
        return {
          success: false,
          error,
          attempts: attempt,
        };
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        logger.warn('Max retry attempts reached', { 
          attempts: attempt, 
          error: error.message 
        });
        break;
      }

      // Wait before retrying
      logger.debug('Retrying after delay', { 
        attempt, 
        delay, 
        error: error.message 
      });
      await sleep(delay);

      // Exponential backoff with max delay
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts,
  };
}

/**
 * Retry with custom retry condition
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  shouldRetry: (result: T, attempt: number) => boolean,
  options: Omit<RetryOptions, 'retryableErrors'> = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
  } = options;

  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (!shouldRetry(result, attempt)) {
        return {
          success: true,
          result,
          attempts: attempt,
        };
      }

      // Result indicates retry needed
      if (attempt === maxAttempts) {
        return {
          success: false,
          result,
          attempts: attempt,
        };
      }

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    } catch (error: any) {
      // On error, use standard retry logic
      return retry(fn, { ...options, retryableErrors: isRetryableError });
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retry policy
 */
export function createRetryPolicy(options: RetryOptions) {
  return <T>(fn: () => Promise<T>) => retry(fn, options);
}

