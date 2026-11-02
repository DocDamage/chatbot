/**
 * Quarterly Operational Drills Coordinator (PX22-T08)
 * Coordinates and logs regular reliability and incident response drills:
 * 1. Database & artifact full restore drill
 * 2. Failed capability pack update & rollback drill
 * 3. Adapter outage & fallback degradation drill
 * 4. Model incompatibility & format rejection drill
 * 5. Stuck worker & process tree cleanup drill
 * 6. Compromised secret & credential rotation drill
 * 7. Suspicious agent / engine action mitigation drill
 * 8. Desktop companion uninstall / rollback drill
 * 9. Storage quota & low-disk recovery drill
 */

import { createHash } from 'crypto';

export type DrillType =
  | 'database_restore'
  | 'pack_rollback'
  | 'adapter_outage'
  | 'model_incompatibility'
  | 'stuck_process_cleanup'
  | 'compromised_secret_rotation'
  | 'suspicious_agent_action'
  | 'companion_rollback'
  | 'storage_quota_recovery';

export interface OperationalDrillRecord {
  drillId: string;
  drillType: DrillType;
  executedAt: string;
  quarter: string; // e.g. "2026-Q3"
  passed: boolean;
  durationMs: number;
  drillSummary: string;
  remediationItems: string[];
  evidenceReference: string;
  sha256Digest: string;
}

export class OperationalDrillsCoordinator {
  private static instance: OperationalDrillsCoordinator;
  private drillHistory: OperationalDrillRecord[] = [];

  public static getInstance(): OperationalDrillsCoordinator {
    if (!OperationalDrillsCoordinator.instance) {
      OperationalDrillsCoordinator.instance = new OperationalDrillsCoordinator();
    }
    return OperationalDrillsCoordinator.instance;
  }

  public executeDrill(
    type: DrillType,
    quarter: string = '2026-Q3',
    evidenceReference: string = ''
  ): OperationalDrillRecord {
    const executedAt = new Date().toISOString();
    const drillId = `drill-${type}-${Date.now()}`;

    const normalizedEvidence = evidenceReference.trim();
    const passed = normalizedEvidence.length > 0;
    const drillSummary = passed
      ? `Operational drill for '${type}' completed with external evidence.`
      : `Operational drill for '${type}' was not run; no evidence was supplied.`;
    const payload = {
      drillId,
      drillType: type,
      executedAt,
      quarter,
      passed,
      durationMs: 0,
      drillSummary,
      remediationItems: passed ? [] : ['Run the drill and attach an immutable evidence reference.'],
      evidenceReference: normalizedEvidence || 'NOT_RUN'
    };

    const sha256Digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const record: OperationalDrillRecord = { ...payload, sha256Digest };

    this.drillHistory.push(record);
    return record;
  }

  public runAllQuarterlyDrills(
    quarter: string = '2026-Q3',
    evidence: Partial<Record<DrillType, string>> = {}
  ): OperationalDrillRecord[] {
    const drillTypes: DrillType[] = [
      'database_restore',
      'pack_rollback',
      'adapter_outage',
      'model_incompatibility',
      'stuck_process_cleanup',
      'compromised_secret_rotation',
      'suspicious_agent_action',
      'companion_rollback',
      'storage_quota_recovery'
    ];

    return drillTypes.map(t => this.executeDrill(t, quarter, evidence[t]));
  }

  public getDrillHistory(): OperationalDrillRecord[] {
    return [...this.drillHistory];
  }
}
