/**
 * Unified Capability SDK (PX-02 / PX02-T12)
 * High-level project-owned SDK for creating, registering, executing,
 * and observing capability packs, jobs, approvals, artifacts, and health checks.
 */

import { CapabilityRegistry } from '../CapabilityRegistry';
import { CapabilityPackManifest, validateCapabilityPackManifest } from '../packs/CapabilityPackManifest';
import { CapabilityInstallationManager, InstalledPackRecord, InstallationPlan } from '../packs/CapabilityInstallationManager';
import { CapabilityJobService, CapabilityJobRecord, JobStageExecution } from '../jobs/CapabilityJobService';
import { CapabilityApprovalService, ApprovalRequest, ApprovalRecord } from '../approvals/CapabilityApprovalService';
import { CapabilityArtifactStore, ArtifactMetadata } from '../artifacts/CapabilityArtifactStore';
import { CapabilityPermissionEngine, PermissionEvaluationContext, PermissionEvaluationResult } from '../permissions/CapabilityPermissionEngine';
import { CapabilityHealthDiagnostics, HealthCheckFn, CapabilityHealthSnapshot } from '../health/CapabilityHealthDiagnostics';
import { CapabilityConfigManager } from '../config/CapabilityConfigManager';
import { ResourceBudgetManager, ResourceBudget } from '../resources/ResourceBudgetManager';

export class CapabilitySDK {
  private static instance: CapabilitySDK;

  public readonly registry = CapabilityRegistry.getInstance();
  public readonly installer = CapabilityInstallationManager.getInstance();
  public readonly jobs = CapabilityJobService.getInstance();
  public readonly approvals = CapabilityApprovalService.getInstance();
  public readonly artifacts = CapabilityArtifactStore.getInstance();
  public readonly permissions = CapabilityPermissionEngine.getInstance();
  public readonly health = CapabilityHealthDiagnostics.getInstance();
  public readonly config = CapabilityConfigManager.getInstance();
  public readonly resources = ResourceBudgetManager.getInstance();

  public static getInstance(): CapabilitySDK {
    if (!CapabilitySDK.instance) {
      CapabilitySDK.instance = new CapabilitySDK();
    }
    return CapabilitySDK.instance;
  }

  /**
   * Registers a capability pack into the platform.
   */
  public registerPack(manifest: unknown, userId: string = 'system'): { success: boolean; record?: InstalledPackRecord; errors?: string[] } {
    return this.installer.installPack(manifest, userId);
  }

  /**
   * Plans installation for a manifest.
   */
  public planInstallation(manifest: unknown): { success: boolean; plan?: InstallationPlan; errors?: string[] } {
    return this.installer.generateInstallationPlan(manifest);
  }

  /**
   * Enables a pack.
   */
  public async enablePack(packId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    return this.installer.enablePack(packId, userId);
  }

  /**
   * Registers custom health check for a capability.
   */
  public registerHealthCheck(capabilityId: string, checkId: string, fn: HealthCheckFn): void {
    this.health.registerCheck(capabilityId, checkId, fn);
  }

  /**
   * Registers staged job execution handler.
   */
  public registerJobStages(capabilityId: string, stages: JobStageExecution[]): void {
    this.jobs.registerJobStages(capabilityId, stages);
  }

  /**
   * Creates and optionally executes a capability job.
   */
  public createJob(params: {
    capabilityId: string;
    packId: string;
    ownerId: string;
    projectId?: string;
    inputs: Record<string, unknown>;
    approvalDigest?: string;
    budget?: Partial<ResourceBudget>;
    profile?: 'HOSTED' | 'LOCAL_TRUSTED';
  }): CapabilityJobRecord {
    return this.jobs.createJob(params);
  }

  /**
   * Runs an enqueued job.
   */
  public async runJob(jobId: string): Promise<CapabilityJobRecord> {
    return this.jobs.runJob(jobId);
  }

  /**
   * Creates a tamper-proof cryptographic approval record.
   */
  public approveScope(request: ApprovalRequest, approverId: string): ApprovalRecord {
    return this.approvals.recordApproval(request, approverId);
  }

  /**
   * Stores an execution artifact with SHA-256 integrity.
   */
  public storeArtifact(params: {
    jobId: string;
    capabilityId: string;
    packVersion: string;
    ownerId: string;
    projectId?: string;
    filename: string;
    contentType: string;
    content: Buffer | string;
    summary?: string;
  }): ArtifactMetadata {
    return this.artifacts.storeArtifact(params);
  }

  /**
   * Evaluates permission against default-deny policy.
   */
  public checkPermission(ctx: PermissionEvaluationContext): PermissionEvaluationResult {
    return this.permissions.evaluatePermission(ctx);
  }
}
