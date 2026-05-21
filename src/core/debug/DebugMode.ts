/**
 * Debug Mode - Detailed request/response logging and debugging
 */

import { logger } from '../observability/logger';

export interface DebugInfo {
  requestId: string;
  timestamp: Date;
  request: {
    message: string;
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, any>;
  };
  processing: {
    intent?: string;
    intentConfidence?: number;
    model?: string;
    taskType?: string;
    usedRAG?: boolean;
    ragChunks?: number;
    usedCache?: boolean;
    cacheHit?: boolean;
    safetyChecks?: any;
    validationResult?: any;
  };
  response: {
    content: string;
    latency: number;
    tokensUsed?: number;
    cost?: number;
    warnings?: string[];
  };
  performance: {
    ragTime?: number;
    llmTime?: number;
    safetyTime?: number;
    totalTime: number;
  };
  errors?: Array<{
    stage: string;
    error: string;
    timestamp: Date;
  }>;
}

export class DebugMode {
  private enabled: boolean = false;
  private debugLogs: Map<string, DebugInfo> = new Map();
  private maxLogs: number = 1000;

  /**
   * Enable debug mode
   */
  enable(): void {
    this.enabled = true;
    logger.info('Debug mode enabled');
  }

  /**
   * Disable debug mode
   */
  disable(): void {
    this.enabled = false;
    logger.info('Debug mode disabled');
  }

  /**
   * Check if debug mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled || process.env.DEBUG_MODE === 'true';
  }

  /**
   * Log debug information
   */
  log(debugInfo: DebugInfo): void {
    if (!this.isEnabled()) return;

    this.debugLogs.set(debugInfo.requestId, debugInfo);

    // Maintain max logs
    if (this.debugLogs.size > this.maxLogs) {
      const firstKey = this.debugLogs.keys().next().value;
      if (firstKey) {
        this.debugLogs.delete(firstKey);
      }
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Debug info', {
        requestId: debugInfo.requestId,
        latency: debugInfo.response.latency,
        model: debugInfo.processing.model,
        usedRAG: debugInfo.processing.usedRAG,
        cacheHit: debugInfo.processing.cacheHit,
      });
    }
  }

  /**
   * Get debug info for a request
   */
  getDebugInfo(requestId: string): DebugInfo | undefined {
    return this.debugLogs.get(requestId);
  }

  /**
   * Get recent debug logs
   */
  getRecentLogs(limit: number = 50): DebugInfo[] {
    return Array.from(this.debugLogs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear debug logs
   */
  clear(): void {
    this.debugLogs.clear();
    logger.info('Debug logs cleared');
  }
}

