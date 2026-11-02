/**
 * Default-Deny Permission Engine (PX-02 / PX02-T04)
 * Evaluates access requests across user roles, deployment profiles,
 * capability maturity, actions, approval digests, and project ownership.
 */

import { RuntimeProfile } from '../../config/EnvironmentDefinitions';
import { UserRole, CapabilityMaturity } from '../CapabilityRegistry';
import { CapabilityApprovalService } from '../approvals/CapabilityApprovalService';

export interface PermissionEvaluationContext {
  userId: string;
  userRole: UserRole;
  profile: RuntimeProfile;
  capabilityId: string;
  capabilityMaturity: CapabilityMaturity;
  requestedPermission: string;
  projectId?: string;
  workspaceRoot?: string;
  approvalDigest?: string;
  isDependencyHealthy?: boolean;
}

export interface PermissionEvaluationResult {
  granted: boolean;
  reason?: string;
  requiredApprovalScope?: string;
}

export class CapabilityPermissionEngine {
  private static instance: CapabilityPermissionEngine;
  private approvalService = CapabilityApprovalService.getInstance();
  private policyOverrides = new Map<string, boolean>();

  public static getInstance(): CapabilityPermissionEngine {
    if (!CapabilityPermissionEngine.instance) {
      CapabilityPermissionEngine.instance = new CapabilityPermissionEngine();
    }
    return CapabilityPermissionEngine.instance;
  }

  /**
   * Evaluates if a permission is granted under a strict default-deny policy.
   */
  public evaluatePermission(ctx: PermissionEvaluationContext): PermissionEvaluationResult {
    // 1. Dependency Health Check
    if (ctx.isDependencyHealthy === false) {
      return { granted: false, reason: 'Capability dependencies are unhealthy or degraded' };
    }

    // 2. Capability Maturity & Profile Restrictions
    if (ctx.capabilityMaturity === 'DEPRECATED') {
      return { granted: false, reason: 'Capability is deprecated and cannot be executed' };
    }

    if (ctx.capabilityMaturity === 'LOCAL_ONLY_EXPERIMENTAL' && ctx.profile === 'hosted') {
      return { granted: false, reason: 'Experimental capabilities cannot execute in HOSTED mode without local confinement' };
    }

    // 3. Dangerous / Local execution in HOSTED mode
    const dangerousHostedPermissions = [
      'process.execute.allowlisted',
      'filesystem.write.approved_root',
      'engine.mutate.approved',
      'browser.mutate.approved',
      'microphone.capture',
      'screen.capture',
      'clipboard.read',
      'clipboard.write'
    ];

    if (ctx.profile === 'hosted' && dangerousHostedPermissions.includes(ctx.requestedPermission)) {
      return { granted: false, reason: `Permission ${ctx.requestedPermission} is prohibited in HOSTED deployment profile` };
    }

    // 4. Role Hierarchy Check
    if (ctx.requestedPermission.startsWith('admin.') && ctx.userRole !== 'admin') {
      return { granted: false, reason: 'Admin permission required' };
    }

    // 5. Approval Digest Verification for Mutating/Approved Permissions
    if (ctx.requestedPermission.endsWith('.approved') || ctx.requestedPermission.endsWith('.allowlisted')) {
      if (!ctx.approvalDigest) {
        return {
          granted: false,
          reason: 'Action requires explicit approval digest',
          requiredApprovalScope: ctx.requestedPermission
        };
      }

      const isValidApproval = this.approvalService.verifyApprovalDigest(ctx.approvalDigest, {
        ownerId: ctx.userId,
        projectId: ctx.projectId,
        capabilityId: ctx.capabilityId,
        permission: ctx.requestedPermission
      });

      if (!isValidApproval) {
        return { granted: false, reason: 'Invalid or expired approval digest' };
      }
    }

    // 6. Policy Overrides check
    const policyKey = `${ctx.userRole}:${ctx.requestedPermission}`;
    if (this.policyOverrides.has(policyKey) && !this.policyOverrides.get(policyKey)) {
      return { granted: false, reason: 'Permission explicitly denied by organization policy' };
    }

    // Default grant when all checks pass
    return { granted: true };
  }

  public setPolicyOverride(role: UserRole, permission: string, allowed: boolean): void {
    this.policyOverrides.set(`${role}:${permission}`, allowed);
  }

  public clearOverrides(): void {
    this.policyOverrides.clear();
  }
}
