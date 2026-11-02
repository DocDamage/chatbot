/**
 * Phase PX-17: Mock Chaos Simulator & Deterministic Fault Injection
 * PX17-T03
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ChaosSimulationConfig,
  ScenarioPreset,
  RequestAuditRecord
} from './DeveloperTypes';

export interface ChaosEvaluationResult {
  shouldInjectError: boolean;
  statusCode: number;
  errorMessage?: string;
  injectedLatencyMs: number;
  rateLimited: boolean;
}

export class MockChaosSimulator {
  private config: ChaosSimulationConfig;
  private requestHistory: RequestAuditRecord[] = [];
  private requestTimestamps: number[] = []; // for rate limiting window
  private readonly maxAuditRecords = 200;

  constructor(initialConfig?: Partial<ChaosSimulationConfig>) {
    this.config = {
      enabled: initialConfig?.enabled ?? false,
      latencyMs: initialConfig?.latencyMs ?? { min: 0, max: 0 },
      errorRate: initialConfig?.errorRate ?? 0,
      errorStatusCodes: initialConfig?.errorStatusCodes ?? [500],
      rateLimit: initialConfig?.rateLimit ?? {
        enabled: false,
        maxRequestsPerWindow: 60,
        windowMs: 60000
      }
    };
  }

  public getConfig(): ChaosSimulationConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public setConfig(updates: Partial<ChaosSimulationConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      latencyMs: { ...this.config.latencyMs, ...updates.latencyMs },
      rateLimit: { ...this.config.rateLimit, ...updates.rateLimit }
    };
  }

  public applyPreset(preset: ScenarioPreset): void {
    switch (preset) {
      case 'HAPPY_PATH':
        this.config = {
          enabled: false,
          latencyMs: { min: 0, max: 0 },
          errorRate: 0,
          errorStatusCodes: [],
          rateLimit: { enabled: false, maxRequestsPerWindow: 100, windowMs: 60000 }
        };
        break;

      case 'SLOW_3G':
        this.config = {
          enabled: true,
          latencyMs: { min: 1500, max: 3000 },
          errorRate: 0.05,
          errorStatusCodes: [504],
          rateLimit: { enabled: false, maxRequestsPerWindow: 100, windowMs: 60000 }
        };
        break;

      case 'INTERMITTENT_503':
        this.config = {
          enabled: true,
          latencyMs: { min: 50, max: 200 },
          errorRate: 0.33,
          errorStatusCodes: [503],
          rateLimit: { enabled: false, maxRequestsPerWindow: 100, windowMs: 60000 }
        };
        break;

      case 'RATE_LIMITED':
        this.config = {
          enabled: true,
          latencyMs: { min: 10, max: 50 },
          errorRate: 0,
          errorStatusCodes: [429],
          rateLimit: { enabled: true, maxRequestsPerWindow: 5, windowMs: 10000 }
        };
        break;

      case 'CHAOS_MONKEY':
        this.config = {
          enabled: true,
          latencyMs: { min: 200, max: 1200 },
          errorRate: 0.5,
          errorStatusCodes: [500, 502, 503, 504],
          rateLimit: { enabled: true, maxRequestsPerWindow: 10, windowMs: 30000 }
        };
        break;
    }
  }

  public evaluateRequest(method: string, path: string, seed?: number): ChaosEvaluationResult {
    const now = Date.now();

    if (!this.config.enabled) {
      this.recordAudit(method, path, 200, 0, false);
      return {
        shouldInjectError: false,
        statusCode: 200,
        injectedLatencyMs: 0,
        rateLimited: false
      };
    }

    // Check rate limit
    if (this.config.rateLimit.enabled) {
      const windowStart = now - this.config.rateLimit.windowMs;
      this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
      this.requestTimestamps.push(now);

      if (this.requestTimestamps.length > this.config.rateLimit.maxRequestsPerWindow) {
        this.recordAudit(method, path, 429, 0, true);
        return {
          shouldInjectError: true,
          statusCode: 429,
          errorMessage: 'Too Many Requests (Chaos Rate Limit Simulation)',
          injectedLatencyMs: 0,
          rateLimited: true
        };
      }
    }

    // Latency
    const minLat = this.config.latencyMs.min;
    const maxLat = this.config.latencyMs.max;
    const prngVal = seed !== undefined ? this.seededPrng(seed) : Math.random();
    const latency = minLat < maxLat ? Math.round(minLat + prngVal * (maxLat - minLat)) : minLat;

    // Error injection
    if (this.config.errorRate > 0 && prngVal < this.config.errorRate) {
      const codes = this.config.errorStatusCodes.length > 0 ? this.config.errorStatusCodes : [500];
      const codeIdx = Math.floor(prngVal * codes.length);
      const statusCode = codes[codeIdx];

      this.recordAudit(method, path, statusCode, latency, true);
      return {
        shouldInjectError: true,
        statusCode,
        errorMessage: `Injected Chaos Fault (${statusCode})`,
        injectedLatencyMs: latency,
        rateLimited: false
      };
    }

    this.recordAudit(method, path, 200, latency, false);
    return {
      shouldInjectError: false,
      statusCode: 200,
      injectedLatencyMs: latency,
      rateLimited: false
    };
  }

  public getAuditHistory(): RequestAuditRecord[] {
    return [...this.requestHistory];
  }

  public clearHistory(): void {
    this.requestHistory = [];
    this.requestTimestamps = [];
  }

  private recordAudit(method: string, path: string, statusCode: number, latencyMs: number, errorInjected: boolean): void {
    // Redact any query param keys that might look sensitive
    const sanitizedPath = path.replace(/([?&](token|key|secret|password|auth)=)[^&]+/gi, '$1[REDACTED]');

    const record: RequestAuditRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      method: method.toUpperCase(),
      path: sanitizedPath,
      statusCode,
      latencyMs,
      errorInjected
    };

    this.requestHistory.unshift(record);
    if (this.requestHistory.length > this.maxAuditRecords) {
      this.requestHistory.pop();
    }
  }

  private seededPrng(seed: number): number {
    let s = (seed * 9301 + 49297) % 233280;
    return s / 233280;
  }
}
