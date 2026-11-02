/**
 * Cross-Capability Promotion Ledger (PX21-T12)
 * Records and tracks authoritative promotion decisions across all capabilities:
 * - Current maturity state (DISABLED | LOCAL_ONLY_EXPERIMENTAL | PRODUCTION_PREVIEW | PRODUCTION_SUPPORTED)
 * - Exact source commit & evaluation run ID
 * - Supporting certification evidence
 * - Explicitly documented known limitations
 * - Supported runtime platforms and deployment profiles
 * - Rollback trigger conditions
 * - Designated capability owner & next scheduled review date
 */

import { createHash } from 'crypto';
import { CapabilityMaturity } from '../CapabilityRegistry';

export interface AuthoritativePromotionRecord {
  recordId: string;
  capabilityId: string;
  capabilityName: string;
  maturity: CapabilityMaturity;
  previousMaturity?: CapabilityMaturity;
  sourceCommit: string;
  evaluationRunId: string;
  supportedProfiles: Array<'local' | 'hosted'>;
  supportedPlatforms: Array<'win32' | 'linux' | 'darwin'>;
  knownLimitations: string[];
  rollbackCondition: string;
  owner: string;
  reviewDate: string;
  nextScheduledReview: string;
  sha256Digest: string;
}

export class CrossCapabilityPromotionLedger {
  private static instance: CrossCapabilityPromotionLedger;
  private records: Map<string, AuthoritativePromotionRecord> = new Map();

  constructor() {
    // Promotion records are evidence-bearing release decisions and must be
    // loaded or recorded explicitly. Never seed synthetic baseline decisions.
  }

  public static getInstance(): CrossCapabilityPromotionLedger {
    if (!CrossCapabilityPromotionLedger.instance) {
      CrossCapabilityPromotionLedger.instance = new CrossCapabilityPromotionLedger();
    }
    return CrossCapabilityPromotionLedger.instance;
  }

  public recordDecision(record: Omit<AuthoritativePromotionRecord, 'sha256Digest'>): AuthoritativePromotionRecord {
    if (!/^[a-f0-9]{40}$/i.test(record.sourceCommit)) {
      throw new Error('Promotion sourceCommit must be an exact 40-character Git commit SHA.');
    }
    if (!record.evaluationRunId.trim() || !record.rollbackCondition.trim() || !record.owner.trim()) {
      throw new Error('Promotion requires evaluation evidence, rollback conditions, and an owner.');
    }
    const sha256Digest = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    const full: AuthoritativePromotionRecord = { ...record, sha256Digest };
    this.records.set(record.capabilityId, full);
    return full;
  }

  public getDecision(capabilityId: string): AuthoritativePromotionRecord | undefined {
    return this.records.get(capabilityId);
  }

  public listDecisions(): AuthoritativePromotionRecord[] {
    return Array.from(this.records.values());
  }
}
