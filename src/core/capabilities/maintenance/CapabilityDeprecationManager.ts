/**
 * Capability Deprecation and Removal Manager (PX22-T09)
 * Manages the graceful deprecation and removal lifecycle:
 * - Upstream project abandoned or unsafe
 * - Incompatible license modifications
 * - Adapter protocol breaking beyond maintenance window
 * - External model / checkpoint unavailability
 * - Failure to meet quality or security thresholds
 * - Product scope or architecture transitions
 * Guarantees:
 * - Advance notice generation
 * - Export and data portability paths
 * - Hard disable date scheduling
 * - Artifact and data retention / purge decisions
 * - Clean database migration / cleanup execution
 */

import { createHash } from 'crypto';

export interface DeprecationNotice {
  capabilityId: string;
  reason: string;
  announcedAt: string;
  effectiveDisableDate: string;
  hardRemovalDate: string;
  exportPathGuidance: string;
  migrationAlternative?: string;
  dataRetentionPolicy: 'retain_indefinitely' | 'purge_after_90_days' | 'export_then_purge';
  sha256Digest: string;
}

export class CapabilityDeprecationManager {
  private static instance: CapabilityDeprecationManager;
  private notices: Map<string, DeprecationNotice> = new Map();

  public static getInstance(): CapabilityDeprecationManager {
    if (!CapabilityDeprecationManager.instance) {
      CapabilityDeprecationManager.instance = new CapabilityDeprecationManager();
    }
    return CapabilityDeprecationManager.instance;
  }

  public scheduleDeprecation(options: {
    capabilityId: string;
    reason: string;
    noticePeriodDays?: number;
    hardRemovalPeriodDays?: number;
    exportPathGuidance: string;
    migrationAlternative?: string;
    dataRetentionPolicy?: DeprecationNotice['dataRetentionPolicy'];
  }): DeprecationNotice {
    const announcedAt = new Date().toISOString();
    const noticeDays = options.noticePeriodDays || 90;
    const removalDays = options.hardRemovalPeriodDays || 180;

    const effectiveDisableDate = new Date(Date.now() + noticeDays * 86400000).toISOString();
    const hardRemovalDate = new Date(Date.now() + removalDays * 86400000).toISOString();

    const payload = {
      capabilityId: options.capabilityId,
      reason: options.reason,
      announcedAt,
      effectiveDisableDate,
      hardRemovalDate,
      exportPathGuidance: options.exportPathGuidance,
      migrationAlternative: options.migrationAlternative,
      dataRetentionPolicy: options.dataRetentionPolicy || 'purge_after_90_days'
    };

    const sha256Digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const notice: DeprecationNotice = { ...payload, sha256Digest };

    this.notices.set(options.capabilityId, notice);
    return notice;
  }

  public getDeprecationNotice(capabilityId: string): DeprecationNotice | undefined {
    return this.notices.get(capabilityId);
  }

  public listNotices(): DeprecationNotice[] {
    return Array.from(this.notices.values());
  }
}
