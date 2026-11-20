import { isWellFormedUnicode } from '../common/Unicode';

/**
 * targetId is an exact reusable knowledge-compatibility profile, not a physical
 * project/profile digest. Exclude owner IDs, project paths and mutable source hashes.
 * This module never parses a semver range, infers compatibility, or supplies a default target.
 */
export interface EvidenceCandidate {
  readonly chunkId: string;
  readonly corpusId?: string;
  readonly snapshotId?: string;
  readonly targetId?: string;
  /** A retained old snapshot can remain ready while no longer being the default. */
  readonly state?: 'staging' | 'validated' | 'ready' | 'failed' | 'retired';
  readonly retrievalApproved?: boolean;
}

export interface CompatibilityApproval {
  readonly approvalId: string;
  readonly requestedTargetId: string;
  readonly evidenceTargetId: string;
  readonly snapshotId: string;
}

export interface EligibilityConfig {
  readonly corpusId: string;
  readonly targetId: string;
  readonly exactSnapshotIds: readonly string[];
  /** Already authorized, unexpired, unrevoked records loaded for this request. */
  readonly compatibilityApprovals?: readonly CompatibilityApproval[];
}

export type EligibilityDecision =
  | Readonly<{ eligible: true; match: 'exact' }>
  | Readonly<{ eligible: true; match: 'approved-compatibility'; approvalId: string }>
  | Readonly<{ eligible: false; reason: 'unknown-metadata' | 'corpus-mismatch' | 'not-ready' | 'not-approved' | 'target-or-snapshot-mismatch' }>;

export interface EligibilityPolicy {
  evaluate(candidate: unknown): EligibilityDecision;
}

function isExactId(value: unknown): value is string {
  return typeof value === 'string' && isWellFormedUnicode(value) && value.length > 0 && value.length <= 4096
    && value === value.trim() && !/[\u0000-\u001f\u007f*]/.test(value)
    && !/(?:^|[:@/|])(?:unknown|unspecified|latest|stable|any|null|undefined)(?:$|[:@/|])/i.test(value);
}

function demandId(value: unknown, label: string): asserts value is string {
  if (!isExactId(value)) throw new TypeError(`${label} must be an explicit canonical ID`);
}

function snapshotId(value: unknown): value is string {
  return typeof value === 'string' && /^snapshot:[a-f0-9]{64}$/.test(value);
}

function key(targetId: string, id: string): string {
  return JSON.stringify([targetId, id]);
}

export function compileEligibilityPolicy(config: EligibilityConfig): EligibilityPolicy {
  demandId(config.corpusId, 'corpusId');
  demandId(config.targetId, 'targetId');
  if (!Array.isArray(config.exactSnapshotIds)) throw new TypeError('exactSnapshotIds must be an array');
  if (config.compatibilityApprovals !== undefined && !Array.isArray(config.compatibilityApprovals)) {
    throw new TypeError('compatibilityApprovals must be an array');
  }
  if (config.exactSnapshotIds.length > 512 || (config.compatibilityApprovals?.length ?? 0) > 512) {
    throw new RangeError('Selection exceeds the 512-entry snapshot/compatibility budget');
  }
  const corpusId = config.corpusId;
  const targetId = config.targetId;
  // Copy into private sets/maps: later caller mutation cannot widen the policy.
  const exact = new Set<string>();
  for (const id of config.exactSnapshotIds) {
    if (!snapshotId(id)) throw new TypeError('Invalid exact snapshot ID');
    exact.add(id);
  }
  const approved = new Map<string, string>();
  const approvalIds = new Set<string>();
  for (const approval of config.compatibilityApprovals ?? []) {
    if (!approval) throw new TypeError('Missing compatibility approval');
    demandId(approval.approvalId, 'approvalId');
    demandId(approval.requestedTargetId, 'requestedTargetId');
    demandId(approval.evidenceTargetId, 'evidenceTargetId');
    if (!snapshotId(approval.snapshotId)) throw new TypeError('Invalid compatible snapshot ID');
    if (approval.requestedTargetId !== targetId) throw new TypeError('Approval is for another requested target');
    const tuple = key(approval.evidenceTargetId, approval.snapshotId);
    if (approved.has(tuple) || approvalIds.has(approval.approvalId)) throw new TypeError('Duplicate compatibility approval');
    approved.set(tuple, approval.approvalId);
    approvalIds.add(approval.approvalId);
  }
  return Object.freeze({
    evaluate(candidate: unknown): EligibilityDecision {
      if (!candidate || typeof candidate !== 'object') return { eligible: false, reason: 'unknown-metadata' };
      const c = candidate as Partial<EvidenceCandidate>;
      if (!isExactId(c.chunkId) || !isExactId(c.corpusId) || !isExactId(c.targetId)
          || !snapshotId(c.snapshotId) || typeof c.retrievalApproved !== 'boolean'
          || !['staging', 'validated', 'ready', 'failed', 'retired'].includes(c.state ?? '')) {
        return { eligible: false, reason: 'unknown-metadata' };
      }
      if (c.corpusId !== corpusId) return { eligible: false, reason: 'corpus-mismatch' };
      if (c.state !== 'ready') return { eligible: false, reason: 'not-ready' };
      if (c.retrievalApproved !== true) return { eligible: false, reason: 'not-approved' };
      if (c.targetId === targetId && exact.has(c.snapshotId)) return { eligible: true, match: 'exact' };
      const approvalId = approved.get(key(c.targetId, c.snapshotId));
      return approvalId
        ? { eligible: true, match: 'approved-compatibility', approvalId }
        : { eligible: false, reason: 'target-or-snapshot-mismatch' };
    },
  });
}
