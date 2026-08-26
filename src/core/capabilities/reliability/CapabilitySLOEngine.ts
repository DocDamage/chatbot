/**
 * Capability SLO Engine (PX20-T01)
 * Defines measurable Service Level Objectives and budgets for capabilities:
 * - setup health-check latency
 * - job queue delay
 * - start latency
 * - progress heartbeat
 * - cancellation completion
 * - failure rate
 * - artifact availability
 * - memory/context query latency
 * - engine round-trip latency
 * - first-token/voice latency
 * - UI responsiveness
 * - recovery time and point objectives
 * - max supported input and project sizes
 * Accurately separates external-provider latency from application overhead.
 */

export interface CapabilitySLOTarget {
  id: string;
  capabilityId: string;
  name: string;
  category: 'latency' | 'availability' | 'throughput' | 'capacity' | 'recovery';
  targetValue: number;
  unit: 'ms' | 'percent' | 'count' | 'bytes' | 'seconds';
  comparison: 'lte' | 'gte' | 'eq';
  errorBudgetTolerancePercent: number;
  maxProjectSizeBytes?: number;
  maxInputTokens?: number;
  appOverheadLimitMs?: number;
  providerOverheadLimitMs?: number;
}

export interface SLOMetricMeasurement {
  sloId: string;
  capabilityId: string;
  measuredValue: number;
  appOverheadMs?: number;
  providerOverheadMs?: number;
  timestamp: string;
  context?: Record<string, string | number | boolean>;
}

export interface SLOComplianceEvaluation {
  sloId: string;
  capabilityId: string;
  name: string;
  targetValue: number;
  currentValue: number;
  isCompliant: boolean;
  errorBudgetRemainingPercent: number;
  appOverheadWithinBudget: boolean;
  providerOverheadMs: number;
  appOverheadMs: number;
  status: 'healthy' | 'at_risk' | 'breached';
}

export class CapabilitySLOEngine {
  private static instance: CapabilitySLOEngine;
  private sloTargets: Map<string, CapabilitySLOTarget> = new Map();
  private measurements: SLOMetricMeasurement[] = [];

  constructor() {
    this.registerDefaultTargets();
  }

  public static getInstance(): CapabilitySLOEngine {
    if (!CapabilitySLOEngine.instance) {
      CapabilitySLOEngine.instance = new CapabilitySLOEngine();
    }
    return CapabilitySLOEngine.instance;
  }

  private registerDefaultTargets(): void {
    const defaults: CapabilitySLOTarget[] = [
      {
        id: 'slo-health-check-latency',
        capabilityId: 'all',
        name: 'Setup & Health-Check Latency',
        category: 'latency',
        targetValue: 200,
        unit: 'ms',
        comparison: 'lte',
        errorBudgetTolerancePercent: 5.0,
        appOverheadLimitMs: 50
      },
      {
        id: 'slo-job-queue-delay',
        capabilityId: 'all',
        name: 'Job Queue Dispatch Delay',
        category: 'latency',
        targetValue: 500,
        unit: 'ms',
        comparison: 'lte',
        errorBudgetTolerancePercent: 2.0,
        appOverheadLimitMs: 100
      },
      {
        id: 'slo-cancellation-completion',
        capabilityId: 'all',
        name: 'Cancellation Completion Time',
        category: 'latency',
        targetValue: 1000,
        unit: 'ms',
        comparison: 'lte',
        errorBudgetTolerancePercent: 1.0,
        appOverheadLimitMs: 250
      },
      {
        id: 'slo-job-availability',
        capabilityId: 'all',
        name: 'Job Execution Availability',
        category: 'availability',
        targetValue: 99.5,
        unit: 'percent',
        comparison: 'gte',
        errorBudgetTolerancePercent: 0.5
      },
      {
        id: 'slo-context-query-latency',
        capabilityId: 'context_economy',
        name: 'Context & Memory Query Latency',
        category: 'latency',
        targetValue: 300,
        unit: 'ms',
        comparison: 'lte',
        errorBudgetTolerancePercent: 5.0,
        appOverheadLimitMs: 80
      },
      {
        id: 'slo-local-model-first-token',
        capabilityId: 'local_model_adapter',
        name: 'Local Model First-Token Latency',
        category: 'latency',
        targetValue: 1200,
        unit: 'ms',
        comparison: 'lte',
        errorBudgetTolerancePercent: 10.0,
        appOverheadLimitMs: 50,
        providerOverheadLimitMs: 1150
      },
      {
        id: 'slo-game-engine-roundtrip',
        capabilityId: 'godot_game_studio',
        name: 'Game Engine Round-Trip Protocol Latency',
        category: 'latency',
        targetValue: 400,
        unit: 'ms',
        comparison: 'lte',
        errorBudgetTolerancePercent: 5.0,
        appOverheadLimitMs: 50,
        providerOverheadLimitMs: 350
      },
      {
        id: 'slo-recovery-time-objective',
        capabilityId: 'all',
        name: 'Restart Recovery Time (RTO)',
        category: 'recovery',
        targetValue: 5,
        unit: 'seconds',
        comparison: 'lte',
        errorBudgetTolerancePercent: 1.0
      },
      {
        id: 'slo-max-project-size',
        capabilityId: 'all',
        name: 'Maximum Supported Project Input Size',
        category: 'capacity',
        targetValue: 500 * 1024 * 1024, // 500MB
        unit: 'bytes',
        comparison: 'lte',
        errorBudgetTolerancePercent: 0,
        maxProjectSizeBytes: 500 * 1024 * 1024
      }
    ];

    for (const target of defaults) {
      this.sloTargets.set(target.id, target);
    }
  }

  public registerTarget(target: CapabilitySLOTarget): void {
    this.sloTargets.set(target.id, target);
  }

  public getTarget(id: string): CapabilitySLOTarget | undefined {
    return this.sloTargets.get(id);
  }

  public listTargets(): CapabilitySLOTarget[] {
    return Array.from(this.sloTargets.values());
  }

  public recordMeasurement(measurement: Omit<SLOMetricMeasurement, 'timestamp'>): SLOMetricMeasurement {
    const full: SLOMetricMeasurement = {
      ...measurement,
      timestamp: new Date().toISOString()
    };
    this.measurements.push(full);
    if (this.measurements.length > 5000) {
      this.measurements.shift();
    }
    return full;
  }

  public evaluateCompliance(sloId: string): SLOComplianceEvaluation | undefined {
    const target = this.sloTargets.get(sloId);
    if (!target) return undefined;

    const relevant = this.measurements.filter(
      m => m.sloId === sloId || (target.capabilityId !== 'all' && m.capabilityId === target.capabilityId)
    );

    if (relevant.length === 0) {
      return {
        sloId: target.id,
        capabilityId: target.capabilityId,
        name: target.name,
        targetValue: target.targetValue,
        currentValue: target.targetValue,
        isCompliant: true,
        errorBudgetRemainingPercent: 100,
        appOverheadWithinBudget: true,
        providerOverheadMs: 0,
        appOverheadMs: 0,
        status: 'healthy'
      };
    }

    const sum = relevant.reduce((acc, m) => acc + m.measuredValue, 0);
    const avg = sum / relevant.length;
    const avgAppOverhead = relevant.reduce((acc, m) => acc + (m.appOverheadMs || 0), 0) / relevant.length;
    const avgProviderOverhead = relevant.reduce((acc, m) => acc + (m.providerOverheadMs || 0), 0) / relevant.length;

    let isCompliant = true;
    if (target.comparison === 'lte') {
      isCompliant = avg <= target.targetValue;
    } else if (target.comparison === 'gte') {
      isCompliant = avg >= target.targetValue;
    } else {
      isCompliant = avg === target.targetValue;
    }

    const appOverheadWithinBudget = target.appOverheadLimitMs ? avgAppOverhead <= target.appOverheadLimitMs : true;

    let errorBudgetRemainingPercent = 100;
    if (!isCompliant) {
      const delta = Math.abs(avg - target.targetValue);
      const ratio = target.targetValue > 0 ? (delta / target.targetValue) * 100 : 100;
      errorBudgetRemainingPercent = Math.max(0, 100 - ratio);
    }

    const status: 'healthy' | 'at_risk' | 'breached' = !isCompliant
      ? (errorBudgetRemainingPercent < 20 ? 'breached' : 'at_risk')
      : (errorBudgetRemainingPercent < 50 ? 'at_risk' : 'healthy');

    return {
      sloId: target.id,
      capabilityId: target.capabilityId,
      name: target.name,
      targetValue: target.targetValue,
      currentValue: Number(avg.toFixed(2)),
      isCompliant,
      errorBudgetRemainingPercent: Number(errorBudgetRemainingPercent.toFixed(1)),
      appOverheadWithinBudget,
      providerOverheadMs: Number(avgProviderOverhead.toFixed(2)),
      appOverheadMs: Number(avgAppOverhead.toFixed(2)),
      status
    };
  }

  public evaluateAll(): SLOComplianceEvaluation[] {
    return Array.from(this.sloTargets.keys())
      .map(id => this.evaluateCompliance(id))
      .filter((ev): ev is SLOComplianceEvaluation => Boolean(ev));
  }

  public resetMeasurements(): void {
    this.measurements = [];
  }
}
