/**
 * Capability Observability & Telemetry Service (CF-10)
 * Records privacy-preserving telemetry, aggregates SLO/SLI performance metrics,
 * monitors error budgets, tracks degradation/rollback triggers, and generates
 * scrubbed support diagnostics.
 */

import { createHash } from 'crypto';
import { logger } from '../../observability/logger';
import { CapabilityEvaluationSuite } from '../evaluation/CapabilityEvaluationSuite';

export interface CapabilityTelemetryEvent {
  id: string;
  timestamp: string;
  capabilityId: string;
  operation: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  userRole?: string;
  resourceUsage?: {
    cpuPercent?: number;
    memoryMb?: number;
    vramMb?: number;
  };
  costEstimateUsd?: number;
  privacyMode: 'strict_local' | 'prefer_local' | 'cloud' | 'local_disabled';
  auditCorrelationId: string;
  sanitizedMetadata?: Record<string, string | number | boolean>;
}

export interface ServiceLevelObjective {
  id: string;
  name: string;
  targetPercent: number; // e.g. 99.9
  currentPercent: number;
  errorBudgetTotal: number;
  errorBudgetRemaining: number; // e.g. 100% down to 0%
  status: 'healthy' | 'at_risk' | 'breached';
  escalationOwner: string;
  rollbackTriggerThreshold: number; // e.g. 95.0%
}

export interface ObservabilityDashboardSummary {
  timestamp: string;
  hasTelemetry: boolean;
  totalInvocations: number;
  successRate: number;
  latencyPercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  totalEstimatedCostUsd: number;
  slos: ServiceLevelObjective[];
  activeRollbackTriggers: Array<{
    capabilityId: string;
    reason: string;
    triggeredAt: string;
    severity: 'critical' | 'warning';
  }>;
  recentAlerts: Array<{
    id: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    owner: string;
  }>;
}

export interface DiagnosticSupportBundle {
  bundleId: string;
  generatedAt: string;
  systemEnvironment: {
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
    deploymentMode: string;
  };
  sanitizedLogs: string[];
  metricsSummary: ObservabilityDashboardSummary;
  sha256Digest: string;
}

export class CapabilityObservabilityService {
  private static instance: CapabilityObservabilityService;
  private telemetryEvents: CapabilityTelemetryEvent[] = [];
  private readonly MAX_EVENTS = 5000;
  private evalSuite = CapabilityEvaluationSuite.getInstance();

  private slos: Map<string, ServiceLevelObjective> = new Map([
    [
      'availability',
      {
        id: 'availability',
        name: 'Capability Execution Availability',
        targetPercent: 99.5,
        currentPercent: 100.0,
        errorBudgetTotal: 100,
        errorBudgetRemaining: 100,
        status: 'healthy',
        escalationOwner: 'Capability Fusion Core Team (@core-ops)',
        rollbackTriggerThreshold: 98.0
      }
    ],
    [
      'latency_p95',
      {
        id: 'latency_p95',
        name: 'P95 Latency Compliance (<500ms)',
        targetPercent: 95.0,
        currentPercent: 98.5,
        errorBudgetTotal: 100,
        errorBudgetRemaining: 90,
        status: 'healthy',
        escalationOwner: 'Model Optimization Team (@model-ops)',
        rollbackTriggerThreshold: 90.0
      }
    ],
    [
      'privacy_safety',
      {
        id: 'privacy_safety',
        name: 'Zero Privacy & Boundary Violations',
        targetPercent: 100.0,
        currentPercent: 100.0,
        errorBudgetTotal: 100,
        errorBudgetRemaining: 100,
        status: 'healthy',
        escalationOwner: 'Security & Privacy Gatekeeper (@sec-ops)',
        rollbackTriggerThreshold: 99.99
      }
    ]
  ]);

  public static getInstance(): CapabilityObservabilityService {
    if (!CapabilityObservabilityService.instance) {
      CapabilityObservabilityService.instance = new CapabilityObservabilityService();
    }
    return CapabilityObservabilityService.instance;
  }

  /**
   * Records a sanitized telemetry event from a capability invocation.
   */
  public recordTelemetry(event: Omit<CapabilityTelemetryEvent, 'id' | 'timestamp'>): CapabilityTelemetryEvent {
    const fullEvent: CapabilityTelemetryEvent = {
      id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
      sanitizedMetadata: this.sanitizeMetadata(event.sanitizedMetadata)
    };

    this.telemetryEvents.push(fullEvent);
    if (this.telemetryEvents.length > this.MAX_EVENTS) {
      this.telemetryEvents.shift();
    }

    // Persist event to disk
    try {
      const { CapabilityPersistenceStore } = require('../persistence/CapabilityPersistenceStore');
      CapabilityPersistenceStore.getInstance().appendTelemetry(fullEvent);
    } catch {
      // Non-blocking persistence
    }

    this.updateSLOs(fullEvent);

    // If event failed, evaluate alert trigger
    if (!fullEvent.success) {
      try {
        const { AlertNotificationDispatcher } = require('./AlertNotificationDispatcher');
        AlertNotificationDispatcher.getInstance().dispatchAlert({
          id: `alert-${fullEvent.id}`,
          timestamp: fullEvent.timestamp,
          severity: 'warning',
          capabilityId: fullEvent.capabilityId,
          title: `Capability Execution Failure (${fullEvent.capabilityId})`,
          message: `Operation '${fullEvent.operation}' failed with error: ${fullEvent.errorCode || 'UNKNOWN_ERROR'}`,
          owner: 'Capability Fusion Operations',
          metadata: { durationMs: fullEvent.durationMs, correlationId: fullEvent.auditCorrelationId }
        });
      } catch {
        // Non-blocking alert
      }
    }

    logger.info(`Telemetry: [${fullEvent.capabilityId}] ${fullEvent.operation}`, {
      durationMs: fullEvent.durationMs,
      success: fullEvent.success,
      correlationId: fullEvent.auditCorrelationId
    });

    return fullEvent;
  }

  /**
   * Aggregates telemetry into a live observability dashboard report.
   */
  public getDashboardSummary(): ObservabilityDashboardSummary {
    const totalInvocations = this.telemetryEvents.length;
    const successful = this.telemetryEvents.filter(e => e.success).length;
    const successRate = totalInvocations > 0 ? Number((successful / totalInvocations).toFixed(4)) : 1.0;

    const latencies = this.telemetryEvents.map(e => e.durationMs).sort((a, b) => a - b);
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.50)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;

    const totalEstimatedCostUsd = Number(
      this.telemetryEvents.reduce((sum, e) => sum + (e.costEstimateUsd || 0), 0).toFixed(6)
    );

    const activeRollbackTriggers: ObservabilityDashboardSummary['activeRollbackTriggers'] = [];
    const recentAlerts: ObservabilityDashboardSummary['recentAlerts'] = [];

    for (const slo of this.slos.values()) {
      if (slo.currentPercent < slo.rollbackTriggerThreshold) {
        activeRollbackTriggers.push({
          capabilityId: slo.id,
          reason: `SLO '${slo.name}' breached threshold: ${slo.currentPercent}% < ${slo.rollbackTriggerThreshold}%`,
          triggeredAt: new Date().toISOString(),
          severity: 'critical'
        });
        recentAlerts.push({
          id: `alert-${Date.now()}-${slo.id}`,
          timestamp: new Date().toISOString(),
          severity: 'critical',
          message: `CRITICAL: ${slo.name} error budget exhausted. Owner ${slo.escalationOwner} notified.`,
          owner: slo.escalationOwner
        });
      } else if (slo.status === 'at_risk') {
        recentAlerts.push({
          id: `alert-${Date.now()}-${slo.id}`,
          timestamp: new Date().toISOString(),
          severity: 'warning',
          message: `WARNING: ${slo.name} approaching error budget depletion (${slo.errorBudgetRemaining}% remaining).`,
          owner: slo.escalationOwner
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      hasTelemetry: totalInvocations > 0,
      totalInvocations,
      successRate,
      latencyPercentiles: { p50, p95, p99 },
      totalEstimatedCostUsd,
      slos: Array.from(this.slos.values()),
      activeRollbackTriggers,
      recentAlerts
    };
  }

  /**
   * Generates a scrubbed, privacy-preserving Diagnostic Support Bundle.
   */
  public generateSupportBundle(): DiagnosticSupportBundle {
    const summary = this.getDashboardSummary();
    const rawLogs = [
      `[INFO] System initialized in ${process.env.DEPLOYMENT_MODE || 'LOCAL_TRUSTED'} profile`,
      `[INFO] Telemetry events collected: ${this.telemetryEvents.length}`,
      `[AUDIT] Evaluated SLO compliance across ${this.slos.size} service objectives`
    ];

    const sanitizedLogs = rawLogs.map(l => this.evalSuite.scrubSensitiveData(l));
    const bundleId = `bundle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const generatedAt = new Date().toISOString();

    const payload = {
      bundleId,
      generatedAt,
      systemEnvironment: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        deploymentMode: process.env.DEPLOYMENT_MODE || 'LOCAL_TRUSTED'
      },
      sanitizedLogs,
      metricsSummary: summary
    };

    const sha256Digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    return {
      ...payload,
      sha256Digest
    };
  }

  private updateSLOs(event: CapabilityTelemetryEvent): void {
    const availSLO = this.slos.get('availability');
    if (availSLO) {
      if (!event.success) {
        availSLO.errorBudgetRemaining = Math.max(0, availSLO.errorBudgetRemaining - 5);
      }
      const total = this.telemetryEvents.length;
      const successCount = this.telemetryEvents.filter(e => e.success).length;
      availSLO.currentPercent = total > 0 ? Number(((successCount / total) * 100).toFixed(2)) : 100;
      availSLO.status = availSLO.currentPercent < availSLO.rollbackTriggerThreshold
        ? 'breached'
        : availSLO.errorBudgetRemaining < 30
          ? 'at_risk'
          : 'healthy';
    }

    const latencySLO = this.slos.get('latency_p95');
    if (latencySLO && event.durationMs > 500) {
      latencySLO.errorBudgetRemaining = Math.max(0, latencySLO.errorBudgetRemaining - 2);
      latencySLO.status = latencySLO.errorBudgetRemaining < 20 ? 'at_risk' : 'healthy';
    }
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, string | number | boolean> {
    if (!metadata) return {};
    const sanitized: Record<string, string | number | boolean> = {};

    for (const [key, val] of Object.entries(metadata)) {
      if (typeof val === 'string') {
        sanitized[key] = this.evalSuite.scrubSensitiveData(val);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        sanitized[key] = val;
      } else {
        sanitized[key] = '[COMPLEX_OBJECT]';
      }
    }

    return sanitized;
  }

  public resetTelemetry(): void {
    this.telemetryEvents = [];
    for (const slo of this.slos.values()) {
      slo.currentPercent = 100.0;
      slo.errorBudgetRemaining = 100;
      slo.status = 'healthy';
    }
  }
}
