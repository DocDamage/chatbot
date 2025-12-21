/**
 * Circuit Breaker - Fault tolerance
 * Research: Microservices Best Practices, Circuit Breaker Pattern
 */

import { logger } from '../core/observability/logger';

export enum CircuitState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Open circuit after N failures
  successThreshold: number; // Close circuit after N successes (half-open)
  timeout: number; // Time to wait before trying again (ms)
  errorThreshold?: number; // Error rate percentage to open circuit
  monitoringWindow?: number; // Time window for error rate calculation (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  openedAt?: Date;
  errorRate?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private openedAt?: number;
  private recentFailures: number[] = []; // Timestamps of recent failures
  private recentSuccesses: number[] = []; // Timestamps of recent successes
  private config: Required<Omit<CircuitBreakerConfig, 'errorThreshold' | 'monitoringWindow'>> & {
    errorThreshold?: number;
    monitoringWindow?: number;
  };

  constructor(config: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000 // 1 minute
  }) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000,
      errorThreshold: config.errorThreshold,
      monitoringWindow: config.monitoringWindow || 60000,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        logger.info('Circuit breaker: Moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.recentSuccesses.push(Date.now());
    this.totalRequests++;

    // Clean old successes
    this.cleanOldEvents(this.recentSuccesses);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        logger.info('Circuit breaker: Moving to CLOSED state - service recovered');
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.recentFailures.push(Date.now());
    this.totalRequests++;

    // Clean old failures
    this.cleanOldEvents(this.recentFailures);

    // Check error rate threshold
    if (this.config.errorThreshold) {
      const errorRate = this.calculateErrorRate();
      if (errorRate >= this.config.errorThreshold) {
        this.state = CircuitState.OPEN;
        this.openedAt = Date.now();
        logger.warn('Circuit breaker: Moving to OPEN state - error rate threshold exceeded', {
          errorRate: errorRate.toFixed(2) + '%',
          threshold: this.config.errorThreshold + '%'
        });
        return;
      }
    }

    // Check failure count threshold
    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
      logger.warn('Circuit breaker: Moving to OPEN state - service failing', {
        failures: this.failures
      });
    }
  }

  /**
   * Calculate error rate in monitoring window
   */
  private calculateErrorRate(): number {
    if (!this.config.monitoringWindow) return 0;

    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    const failuresInWindow = this.recentFailures.filter(t => t >= windowStart).length;
    const successesInWindow = this.recentSuccesses.filter(t => t >= windowStart).length;
    const totalInWindow = failuresInWindow + successesInWindow;

    if (totalInWindow === 0) return 0;

    return (failuresInWindow / totalInWindow) * 100;
  }

  /**
   * Clean old events outside monitoring window
   */
  private cleanOldEvents(events: number[]): void {
    if (!this.config.monitoringWindow) return;

    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    while (events.length > 0 && events[0] < windowStart) {
      events.shift();
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.recentFailures = [];
    this.recentSuccesses = [];
    this.openedAt = undefined;
    logger.info('Circuit breaker reset');
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : undefined,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime) : undefined,
      openedAt: this.openedAt ? new Date(this.openedAt) : undefined,
      errorRate: this.calculateErrorRate(),
    };
  }
}

