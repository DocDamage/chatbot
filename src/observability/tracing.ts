/**
 * Distributed Tracing - OpenTelemetry integration
 * Research: MIT Systems Group, Observability Best Practices
 */

import { logger } from '../core/observability/logger';

export interface TraceSpan {
  id: string;
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  children: TraceSpan[];
}

export class TracingService {
  private traces: Map<string, TraceSpan[]> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();

  /**
   * Start a new trace
   */
  startTrace(traceId: string, name: string, attributes?: Record<string, any>): TraceSpan {
    const span: TraceSpan = {
      id: this.generateId(),
      traceId,
      name,
      startTime: Date.now(),
      attributes: attributes || {},
      children: []
    };

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }

    this.activeSpans.set(span.id, span);
    logger.debug('Trace started', { traceId, spanId: span.id, name });

    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, attributes?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn('Span not found', { spanId });
      return;
    }

    span.endTime = Date.now();
    span.attributes = { ...span.attributes, ...attributes };

    this.activeSpans.delete(spanId);
    this.traces.get(span.traceId)?.push(span);

    logger.debug('Span ended', {
      traceId: span.traceId,
      spanId,
      duration: span.endTime - span.startTime
    });
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): TraceSpan[] {
    return this.traces.get(traceId) || [];
  }

  /**
   * Generate ID
   */
  private generateId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

