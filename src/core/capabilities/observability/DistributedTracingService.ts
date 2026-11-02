/**
 * Distributed Tracing & Correlation Service (PX20-T03)
 * Tracks distributed trace spans across:
 * - Request receipt
 * - Policy & permission evaluation
 * - Job creation & approval gates
 * - Queue dispatch & scheduling
 * - Worker / adapter stage execution
 * - Model provider calls
 * - Artifact store writes
 * - Memory & context reads/writes
 * - Final response construction
 * Excludes or scrubs raw secret payloads; companion uses local correlation without forced egress.
 */

import { createHash } from 'crypto';

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  stage:
    | 'request'
    | 'policy_check'
    | 'job_creation'
    | 'approval_wait'
    | 'queue_dispatch'
    | 'worker_execution'
    | 'provider_call'
    | 'artifact_write'
    | 'memory_access'
    | 'response_construction';
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  status: 'ok' | 'error' | 'in_progress';
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestampMs: number; data?: Record<string, any> }>;
}

export interface TraceRecord {
  traceId: string;
  rootSpanId: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  spans: TraceSpan[];
  hasErrors: boolean;
  sha256Digest?: string;
}

export class DistributedTracingService {
  private static instance: DistributedTracingService;
  private activeTraces: Map<string, TraceRecord> = new Map();
  private completedTraces: TraceRecord[] = [];
  private readonly MAX_HISTORY = 1000;

  public static getInstance(): DistributedTracingService {
    if (!DistributedTracingService.instance) {
      DistributedTracingService.instance = new DistributedTracingService();
    }
    return DistributedTracingService.instance;
  }

  public startTrace(operationName: string, correlationId?: string): { traceId: string; rootSpan: TraceSpan } {
    const traceId = correlationId || `trc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const rootSpanId = `spn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const rootSpan: TraceSpan = {
      spanId: rootSpanId,
      traceId,
      name: operationName,
      stage: 'request',
      startTimeMs: now,
      status: 'in_progress',
      attributes: { operation: operationName },
      events: [{ name: 'trace_started', timestampMs: now }]
    };

    const trace: TraceRecord = {
      traceId,
      rootSpanId,
      startedAt: new Date(now).toISOString(),
      spans: [rootSpan],
      hasErrors: false
    };

    this.activeTraces.set(traceId, trace);
    return { traceId, rootSpan };
  }

  public startSpan(
    traceId: string,
    name: string,
    stage: TraceSpan['stage'],
    parentSpanId?: string,
    attributes: Record<string, string | number | boolean> = {}
  ): TraceSpan {
    const trace = this.activeTraces.get(traceId);
    const spanId = `spn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId: parentSpanId || trace?.rootSpanId,
      name,
      stage,
      startTimeMs: now,
      status: 'in_progress',
      attributes: this.sanitizeAttributes(attributes),
      events: []
    };

    if (trace) {
      trace.spans.push(span);
    }

    return span;
  }

  public endSpan(
    traceId: string,
    spanId: string,
    status: 'ok' | 'error' = 'ok',
    extraAttributes: Record<string, string | number | boolean> = {}
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    const now = Date.now();
    span.endTimeMs = now;
    span.durationMs = now - span.startTimeMs;
    span.status = status;
    Object.assign(span.attributes, this.sanitizeAttributes(extraAttributes));

    if (status === 'error') {
      trace.hasErrors = true;
    }
  }

  public endTrace(traceId: string, status: 'ok' | 'error' = 'ok'): TraceRecord | undefined {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return undefined;

    const now = Date.now();
    trace.completedAt = new Date(now).toISOString();

    const rootSpan = trace.spans.find(s => s.spanId === trace.rootSpanId);
    if (rootSpan) {
      rootSpan.endTimeMs = now;
      rootSpan.durationMs = now - rootSpan.startTimeMs;
      rootSpan.status = status;
      trace.durationMs = rootSpan.durationMs;
    }

    if (status === 'error') {
      trace.hasErrors = true;
    }

    trace.sha256Digest = createHash('sha256')
      .update(JSON.stringify(trace.spans))
      .digest('hex');

    this.activeTraces.delete(traceId);
    this.completedTraces.push(trace);
    if (this.completedTraces.length > this.MAX_HISTORY) {
      this.completedTraces.shift();
    }

    return trace;
  }

  public getTrace(traceId: string): TraceRecord | undefined {
    return this.activeTraces.get(traceId) || this.completedTraces.find(t => t.traceId === traceId);
  }

  public getRecentTraces(limit: number = 50): TraceRecord[] {
    return this.completedTraces.slice(-limit);
  }

  private sanitizeAttributes(attrs: Record<string, any>): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, val] of Object.entries(attrs)) {
      if (typeof val === 'string') {
        // Redact API keys, tokens, or emails
        clean[key] = val
          .replace(/(sk-[a-zA-Z0-9_-]{8,})/g, '[REDACTED_KEY]')
          .replace(/(bearer\s+[a-zA-Z0-9_.-]{8,})/gi, 'Bearer [REDACTED_TOKEN]')
          .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[REDACTED_EMAIL]');
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        clean[key] = val;
      } else {
        clean[key] = '[OBJECT]';
      }
    }
    return clean;
  }

  public clear(): void {
    this.activeTraces.clear();
    this.completedTraces = [];
  }
}
