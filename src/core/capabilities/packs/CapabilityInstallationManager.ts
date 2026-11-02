/**
 * Capability Pack Installation & Lifecycle Manager (PX-02 / PX02-T03)
 * Implements safe, auditable installation lifecycle for capability packs:
 * inspection, provenance validation, dry-run planning, disabled installation,
 * health verification, enablement, rollback, and audit retention.
 */

import { CapabilityPackManifest, validateCapabilityPackManifest } from './CapabilityPackManifest';
import { CapabilityHealthDiagnostics } from '../health/CapabilityHealthDiagnostics';
import { CapabilityConfigManager } from '../config/CapabilityConfigManager';

export interface InstallationPlan {
  packId: string;
  version: string;
  capabilitiesToAdd: string[];
  toolsToAdd: string[];
  permissionsRequested: string[];
  warnings: string[];
  requiresConfig: boolean;
}

export interface InstalledPackRecord {
  manifest: CapabilityPackManifest;
  installedAt: string;
  updatedAt: string;
  enabled: boolean;
  status: 'installed_disabled' | 'enabled' | 'degraded' | 'quarantined';
  installedBy: string;
  previousVersionManifest?: CapabilityPackManifest;
}

export interface InstallationAuditLog {
  packId: string;
  action: 'install' | 'enable' | 'disable' | 'update' | 'rollback' | 'remove';
  performedBy: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export class CapabilityInstallationManager {
  private static instance: CapabilityInstallationManager;
  private installedPacks = new Map<string, InstalledPackRecord>();
  private auditLogs: InstallationAuditLog[] = [];
  private healthDiagnostics = CapabilityHealthDiagnostics.getInstance();
  private configManager = CapabilityConfigManager.getInstance();

  public static getInstance(): CapabilityInstallationManager {
    if (!CapabilityInstallationManager.instance) {
      CapabilityInstallationManager.instance = new CapabilityInstallationManager();
    }
    return CapabilityInstallationManager.instance;
  }

  /**
   * Dry-run inspection of a manifest before installation.
   */
  public generateInstallationPlan(rawManifest: unknown): { success: boolean; plan?: InstallationPlan; errors?: string[] } {
    const validation = validateCapabilityPackManifest(rawManifest);
    if (!validation.success) {
      return { success: false, errors: validation.errors };
    }

    const manifest = validation.data;
    const warnings: string[] = [];

    if (manifest.source.integration === 'external_service') {
      warnings.push('Pack communicates with an external service; verify network policy');
    }

    const dangerousTools = manifest.tools?.filter(t => t.isDangerous).map(t => t.id) || [];
    if (dangerousTools.length > 0) {
      warnings.push(`Pack provides dangerous tools requiring explicit scope confirmation: ${dangerousTools.join(', ')}`);
    }

    const plan: InstallationPlan = {
      packId: manifest.id,
      version: manifest.version,
      capabilitiesToAdd: manifest.capabilities.map(c => c.id),
      toolsToAdd: manifest.tools?.map(t => t.id) || [],
      permissionsRequested: manifest.permissions.map(p => p.permission),
      warnings,
      requiresConfig: !!manifest.configurationSchema
    };

    return { success: true, plan };
  }

  /**
   * Installs a pack in disabled state by default.
   */
  public installPack(rawManifest: unknown, installerUserId: string): { success: boolean; record?: InstalledPackRecord; errors?: string[] } {
    const validation = validateCapabilityPackManifest(rawManifest);
    if (!validation.success) {
      return { success: false, errors: validation.errors };
    }

    const manifest = validation.data;
    const existing = this.installedPacks.get(manifest.id);

    const record: InstalledPackRecord = {
      manifest,
      installedAt: existing?.installedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: false, // Disabled by default
      status: 'installed_disabled',
      installedBy: installerUserId,
      previousVersionManifest: existing?.manifest
    };

    this.installedPacks.set(manifest.id, record);
    this.recordAudit(manifest.id, existing ? 'update' : 'install', installerUserId, { version: manifest.version });

    return { success: true, record };
  }

  /**
   * Enables a pack after verifying its health diagnostics.
   */
  public async enablePack(packId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const record = this.installedPacks.get(packId);
    if (!record) return { success: false, error: `Pack ${packId} is not installed` };

    // Run health diagnostics across declared capabilities
    for (const cap of record.manifest.capabilities) {
      const snapshot = await this.healthDiagnostics.runDiagnostics(cap.id);
      if (snapshot.status === 'unhealthy') {
        return { success: false, error: `Cannot enable pack: capability ${cap.id} is unhealthy (${snapshot.degradedReasons.join(', ')})` };
      }
    }

    record.enabled = true;
    record.status = 'enabled';
    this.recordAudit(packId, 'enable', userId);
    return { success: true };
  }

  /**
   * Disables a pack.
   */
  public disablePack(packId: string, userId: string): boolean {
    const record = this.installedPacks.get(packId);
    if (!record) return false;

    record.enabled = false;
    record.status = 'installed_disabled';
    this.recordAudit(packId, 'disable', userId);
    return true;
  }

  /**
   * Rolls back a pack to its previous version.
   */
  public rollbackPack(packId: string, userId: string): { success: boolean; error?: string } {
    const record = this.installedPacks.get(packId);
    if (!record) return { success: false, error: `Pack ${packId} is not installed` };
    if (!record.previousVersionManifest) {
      return { success: false, error: `No previous version available for rollback of pack ${packId}` };
    }

    if (!record.manifest.rollback.canRollback) {
      return { success: false, error: `Pack ${packId} manifest specifies rollback is not supported` };
    }

    record.manifest = record.previousVersionManifest;
    record.previousVersionManifest = undefined;
    record.updatedAt = new Date().toISOString();
    record.enabled = false;
    record.status = 'installed_disabled';

    this.recordAudit(packId, 'rollback', userId, { rolledBackTo: record.manifest.version });
    return { success: true };
  }

  /**
   * Uninstalls a pack while retaining audit history.
   */
  public removePack(packId: string, userId: string): boolean {
    const record = this.installedPacks.get(packId);
    if (!record) return false;

    this.installedPacks.delete(packId);
    this.recordAudit(packId, 'remove', userId, { removedVersion: record.manifest.version });
    return true;
  }

  public getInstalledPack(packId: string): InstalledPackRecord | undefined {
    return this.installedPacks.get(packId);
  }

  public listInstalledPacks(): InstalledPackRecord[] {
    return Array.from(this.installedPacks.values());
  }

  public getAuditHistory(packId?: string): InstallationAuditLog[] {
    if (packId) return this.auditLogs.filter(l => l.packId === packId);
    return [...this.auditLogs];
  }

  private recordAudit(packId: string, action: InstallationAuditLog['action'], performedBy: string, details?: Record<string, unknown>): void {
    this.auditLogs.push({
      packId,
      action,
      performedBy,
      timestamp: new Date().toISOString(),
      details
    });
  }

  public clear(): void {
    this.installedPacks.clear();
    this.auditLogs = [];
  }
}
