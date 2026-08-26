/**
 * Cryptographic Capability Approval Service (PX-02 / PX02-T06)
 * Generates and validates tamper-proof approval records and digests
 * bound to exact inputs, paths, providers, resource budgets, and targets.
 */

import { createHash } from 'crypto';

export interface ResourceBudgetSummary {
  deadlineMs?: number;
  maxCpuConcurrency?: number;
  maxRamBytes?: number;
  maxOutputBytes?: number;
  maxNetworkBytes?: number;
  maxTokens?: number;
}

export interface DataEgressDeclaration {
  destinationType: 'local_only' | 'approved_egress' | 'external_provider';
  targetEndpoints: string[];
  transfersSensitiveData: boolean;
}

export interface ApprovalRequest {
  jobType: string;
  capabilityId: string;
  ownerId: string;
  projectId?: string;
  inputHashes: string[];
  targetPaths: string[];
  providerModel?: string;
  proposedActions: string[];
  resourceBudget: ResourceBudgetSummary;
  dataEgress: DataEgressDeclaration;
  ttlSeconds?: number;
}

export interface ApprovalRecord extends ApprovalRequest {
  approvalDigest: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export class CapabilityApprovalService {
  private static instance: CapabilityApprovalService;
  private approvals = new Map<string, ApprovalRecord>();

  public static getInstance(): CapabilityApprovalService {
    if (!CapabilityApprovalService.instance) {
      CapabilityApprovalService.instance = new CapabilityApprovalService();
    }
    return CapabilityApprovalService.instance;
  }

  /**
   * Generates a cryptographic digest of the exact approval scope.
   */
  public computeScopeDigest(req: ApprovalRequest): string {
    const payload = [
      req.jobType,
      req.capabilityId,
      req.ownerId,
      req.projectId || 'none',
      req.inputHashes.slice().sort().join(','),
      req.targetPaths.slice().sort().join(','),
      req.providerModel || 'default',
      req.proposedActions.slice().sort().join(','),
      JSON.stringify(req.resourceBudget),
      JSON.stringify(req.dataEgress)
    ].join('::');

    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Records an explicit approval for a scope digest.
   */
  public recordApproval(req: ApprovalRequest, approverId: string): ApprovalRecord {
    const scopeDigest = this.computeScopeDigest(req);
    const approvedAt = new Date().toISOString();
    const ttlSeconds = req.ttlSeconds || 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const record: ApprovalRecord = {
      ...req,
      approvalDigest: scopeDigest,
      approvedBy: approverId,
      approvedAt,
      expiresAt,
      revoked: false
    };

    this.approvals.set(scopeDigest, record);
    return record;
  }

  /**
   * Verifies an approval digest against current context.
   */
  public verifyApprovalDigest(digest: string, expected: { ownerId: string; projectId?: string; capabilityId: string; permission?: string }): boolean {
    const record = this.approvals.get(digest);
    if (!record) return false;
    if (record.revoked) return false;
    if (new Date(record.expiresAt).getTime() < Date.now()) return false;
    if (record.ownerId !== expected.ownerId) return false;
    if (expected.projectId && record.projectId !== expected.projectId) return false;
    if (record.capabilityId !== expected.capabilityId) return false;

    return true;
  }

  /**
   * Revokes an approval.
   */
  public revokeApproval(digest: string): boolean {
    const record = this.approvals.get(digest);
    if (!record) return false;
    record.revoked = true;
    return true;
  }

  public clear(): void {
    this.approvals.clear();
  }
}
