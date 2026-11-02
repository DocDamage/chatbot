/**
 * Reviewer Bundle & Conflict Detection (CF-05)
 * Assembles task envelopes, mutations, verification evidence, peer review,
 * and security review signoffs into an immutable mergeable bundle.
 * Prevents integration supervisor bypass of review protections.
 */

import * as crypto from 'crypto';
import { TaskEnvelope } from './TaskEnvelope';

export class SupervisorBypassError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupervisorBypassError';
  }
}

export interface TeamReviewFinding {
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  path: string;
  line?: number;
  message: string;
}

export interface ReviewSignoff {
  reviewerRole: 'reviewer' | 'security_reviewer';
  reviewerId: string;
  approved: boolean;
  comments: string[];
  findings: TeamReviewFinding[];
  timestamp: string;
  signature: string;
}

export interface MutationEntry {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  content?: string;
  hash: string;
}

export interface PatchCandidate {
  taskId: string;
  workerId: string;
  mutations: MutationEntry[];
}

export interface ConflictRecord {
  path: string;
  conflictingTaskIds: string[];
  reason: string;
}

export interface VerificationEvidenceItem {
  step: string;
  passed: boolean;
  details?: string;
}

export interface ReviewerBundle {
  readonly bundleId: string;
  readonly envelopes: TaskEnvelope[];
  readonly patches: PatchCandidate[];
  readonly verificationEvidence: VerificationEvidenceItem[];
  peerReview: ReviewSignoff | null;
  securityReview: ReviewSignoff | null;
  hasConflicts: boolean;
  conflicts: ConflictRecord[];
  supervisorApproved: boolean;
  canMerge: boolean;
  status: 'pending_review' | 'rejected' | 'ready_to_merge' | 'merged';
  mergedAt?: string;
}

/**
 * Sign a review record cryptographically
 */
export function createReviewSignoff(data: {
  reviewerRole: 'reviewer' | 'security_reviewer';
  reviewerId: string;
  approved: boolean;
  comments?: string[];
  findings?: TeamReviewFinding[];
}): ReviewSignoff {
  const timestamp = new Date().toISOString();
  const comments = data.comments || [];
  const findings = data.findings || [];

  const raw = {
    reviewerRole: data.reviewerRole,
    reviewerId: data.reviewerId,
    approved: data.approved,
    comments,
    findings,
    timestamp
  };

  const signature = crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex');

  return {
    reviewerRole: data.reviewerRole,
    reviewerId: data.reviewerId,
    approved: data.approved,
    comments,
    findings,
    timestamp,
    signature
  };
}

/**
 * Verify cryptographic validity of a review signoff
 */
export function verifyReviewSignoff(signoff: ReviewSignoff): boolean {
  const raw = {
    reviewerRole: signoff.reviewerRole,
    reviewerId: signoff.reviewerId,
    approved: signoff.approved,
    comments: signoff.comments,
    findings: signoff.findings,
    timestamp: signoff.timestamp
  };

  const expected = crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex');
  return expected === signoff.signature;
}

/**
 * Detect conflicts between mutations from parallel workers
 */
export function detectMutationsConflicts(patches: PatchCandidate[]): ConflictRecord[] {
  const pathUsage = new Map<string, Array<{ taskId: string; mutation: MutationEntry }>>();

  for (const patch of patches) {
    for (const mutation of patch.mutations) {
      const normalizedPath = mutation.path.replace(/\\/g, '/');
      if (!pathUsage.has(normalizedPath)) {
        pathUsage.set(normalizedPath, []);
      }
      pathUsage.get(normalizedPath)!.push({ taskId: patch.taskId, mutation });
    }
  }

  const conflicts: ConflictRecord[] = [];

  for (const [filePath, usages] of pathUsage.entries()) {
    if (usages.length > 1) {
      // Check if all mutations are identical
      const firstHash = usages[0].mutation.hash;
      const allIdentical = usages.every(u => u.mutation.hash === firstHash && u.mutation.operation === usages[0].mutation.operation);

      if (!allIdentical) {
        conflicts.push({
          path: filePath,
          conflictingTaskIds: usages.map(u => u.taskId),
          reason: `Parallel mutation conflict: file '${filePath}' was modified with differing content across tasks [${usages.map(u => u.taskId).join(', ')}]`
        });
      }
    }
  }

  return conflicts;
}

/**
 * Assemble a complete reviewer bundle
 */
export function assembleReviewerBundle(options: {
  bundleId?: string;
  envelopes: TaskEnvelope[];
  patches: PatchCandidate[];
  verificationEvidence?: VerificationEvidenceItem[];
  peerReview?: ReviewSignoff | null;
  securityReview?: ReviewSignoff | null;
}): ReviewerBundle {
  const bundleId = options.bundleId || `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const conflicts = detectMutationsConflicts(options.patches);
  const hasConflicts = conflicts.length > 0;
  const verificationEvidence = options.verificationEvidence || [];

  const peerReview = options.peerReview || null;
  const securityReview = options.securityReview || null;

  const verificationPassed = verificationEvidence.length === 0 || verificationEvidence.every(v => v.passed);
  const peerApproved = Boolean(peerReview && peerReview.approved && verifyReviewSignoff(peerReview));
  const securityApproved = Boolean(securityReview && securityReview.approved && verifyReviewSignoff(securityReview));

  const canMerge = !hasConflicts && verificationPassed && peerApproved && securityApproved;

  let status: ReviewerBundle['status'] = 'pending_review';
  if (hasConflicts || (peerReview && !peerReview.approved) || (securityReview && !securityReview.approved)) {
    status = 'rejected';
  } else if (canMerge) {
    status = 'ready_to_merge';
  }

  return {
    bundleId,
    envelopes: options.envelopes,
    patches: options.patches,
    verificationEvidence,
    peerReview,
    securityReview,
    hasConflicts,
    conflicts,
    supervisorApproved: false,
    canMerge,
    status
  };
}

/**
 * Authorize supervisor merge of bundle.
 * Throws SupervisorBypassError if review approvals or verification gates are missing.
 */
export function supervisorApproveMerge(bundle: ReviewerBundle, supervisorId: string): ReviewerBundle {
  if (bundle.hasConflicts) {
    throw new SupervisorBypassError(
      `Cannot merge bundle '${bundle.bundleId}': Unresolved conflicts detected in files [${bundle.conflicts.map(c => c.path).join(', ')}]`
    );
  }

  if (!bundle.peerReview || !bundle.peerReview.approved || !verifyReviewSignoff(bundle.peerReview)) {
    throw new SupervisorBypassError(
      `Supervisor '${supervisorId}' cannot bypass peer review: missing or unapproved peer review signoff`
    );
  }

  if (!bundle.securityReview || !bundle.securityReview.approved || !verifyReviewSignoff(bundle.securityReview)) {
    throw new SupervisorBypassError(
      `Supervisor '${supervisorId}' cannot bypass security review: missing or unapproved security signoff`
    );
  }

  const verificationPassed = bundle.verificationEvidence.length === 0 || bundle.verificationEvidence.every(v => v.passed);
  if (!verificationPassed) {
    throw new SupervisorBypassError(
      `Cannot merge bundle '${bundle.bundleId}': One or more verification steps failed`
    );
  }

  bundle.supervisorApproved = true;
  bundle.canMerge = true;
  bundle.status = 'merged';
  bundle.mergedAt = new Date().toISOString();

  return bundle;
}
