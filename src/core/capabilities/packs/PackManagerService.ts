import * as crypto from 'crypto';

export interface InstalledCapabilityPack {
  packId: string;
  displayName: string;
  version: string;
  description: string;
  source: {
    repository?: string;
    revision?: string;
    license: string;
    integration: 'native' | 'external_service' | 'clean_room';
    notices: string[];
  };
  maturity: 'disabled' | 'experimental' | 'preview' | 'supported';
  profiles: Array<'HOSTED' | 'LOCAL_TRUSTED'>;
  permissions: string[];
  capabilities: string[];
  installedAt: string;
  updatedAt: string;
  status: 'active' | 'quarantined' | 'disabled';
  manifestDigest: string;
  previousVersion?: string;
}

export interface PackComparison {
  packId: string;
  currentVersion: string;
  targetVersion: string;
  permissionDiff: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  capabilityDiff: {
    added: string[];
    removed: string[];
  };
  breakingChangesDetected: boolean;
}

export class PackManagerService {
  private packs = new Map<string, InstalledCapabilityPack>();

  public installPack(manifest: {
    packId: string;
    displayName: string;
    version: string;
    description: string;
    source: {
      repository?: string;
      revision?: string;
      license: string;
      integration: 'native' | 'external_service' | 'clean_room';
      notices: string[];
    };
    maturity: 'disabled' | 'experimental' | 'preview' | 'supported';
    profiles: Array<'HOSTED' | 'LOCAL_TRUSTED'>;
    permissions: string[];
    capabilities: string[];
  }): InstalledCapabilityPack {
    const manifestJson = JSON.stringify(manifest);
    const digest = crypto.createHash('sha256').update(manifestJson).digest('hex');

    const pack: InstalledCapabilityPack = {
      ...manifest,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'disabled', // default-disabled
      manifestDigest: digest
    };

    this.packs.set(pack.packId, pack);
    return pack;
  }

  public compareVersions(
    packId: string,
    newManifest: {
      version: string;
      permissions: string[];
      capabilities: string[];
    }
  ): PackComparison {
    const existing = this.packs.get(packId);
    if (!existing) throw new Error(`Pack not found: ${packId}`);

    const existingPerms = new Set(existing.permissions);
    const newPerms = new Set(newManifest.permissions);

    const addedPerms = newManifest.permissions.filter(p => !existingPerms.has(p));
    const removedPerms = existing.permissions.filter(p => !newPerms.has(p));
    const unchangedPerms = existing.permissions.filter(p => newPerms.has(p));

    const existingCaps = new Set(existing.capabilities);
    const newCaps = new Set(newManifest.capabilities);

    const addedCaps = newManifest.capabilities.filter(c => !existingCaps.has(c));
    const removedCaps = existing.capabilities.filter(c => !newCaps.has(c));

    return {
      packId,
      currentVersion: existing.version,
      targetVersion: newManifest.version,
      permissionDiff: {
        added: addedPerms,
        removed: removedPerms,
        unchanged: unchangedPerms
      },
      capabilityDiff: {
        added: addedCaps,
        removed: removedCaps
      },
      breakingChangesDetected: addedPerms.length > 0 || removedCaps.length > 0
    };
  }

  public updatePack(
    packId: string,
    updatedManifest: {
      version: string;
      permissions: string[];
      capabilities: string[];
      description?: string;
    }
  ): InstalledCapabilityPack {
    const existing = this.packs.get(packId);
    if (!existing) throw new Error(`Pack not found: ${packId}`);

    existing.previousVersion = existing.version;
    existing.version = updatedManifest.version;
    existing.permissions = updatedManifest.permissions;
    existing.capabilities = updatedManifest.capabilities;
    if (updatedManifest.description) existing.description = updatedManifest.description;
    existing.updatedAt = new Date().toISOString();

    const manifestJson = JSON.stringify(existing);
    existing.manifestDigest = crypto.createHash('sha256').update(manifestJson).digest('hex');

    return existing;
  }

  public rollbackPack(packId: string): InstalledCapabilityPack {
    const existing = this.packs.get(packId);
    if (!existing) throw new Error(`Pack not found: ${packId}`);
    if (!existing.previousVersion) throw new Error(`No previous version recorded for rollback: ${packId}`);

    existing.version = existing.previousVersion;
    existing.previousVersion = undefined;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  public setPackStatus(packId: string, status: 'active' | 'quarantined' | 'disabled'): InstalledCapabilityPack {
    const existing = this.packs.get(packId);
    if (!existing) throw new Error(`Pack not found: ${packId}`);
    existing.status = status;
    return existing;
  }

  public listPacks(): InstalledCapabilityPack[] {
    return Array.from(this.packs.values());
  }

  public getPack(packId: string): InstalledCapabilityPack | undefined {
    return this.packs.get(packId);
  }
}
