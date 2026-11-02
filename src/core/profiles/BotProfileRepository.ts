/**
 * Bot Profile Repository & Versioned Persistence (CRK-P02-T02)
 *
 * Provides auditable persistence for BotProfiles and their historical versions.
 * Tracks author, timestamps, changed fields diffs, and rollout state (§918-928).
 */

import {
  BotProfile,
  BotProfileInput,
  BotProfileVersion,
  botProfileSchema,
  botProfileVersionSchema,
} from '../../types/bot-profile';

export interface IBotProfileDatabase {
  getProfile?: (id: string) => Promise<BotProfile | undefined>;
  saveProfile?: (profile: BotProfile) => Promise<void>;
  listProfiles?: () => Promise<BotProfile[]>;
  saveVersion?: (version: BotProfileVersion) => Promise<void>;
  getVersions?: (profileId: string) => Promise<BotProfileVersion[]>;
}

export class BotProfileRepository {
  private readonly profiles = new Map<string, BotProfile>();
  private readonly versions = new Map<string, BotProfileVersion[]>();

  constructor(private readonly db?: IBotProfileDatabase) {}

  public async saveProfile(
    profileData: Omit<BotProfileInput, 'version' | 'createdAt' | 'updatedAt'> & { version?: number; createdAt?: string; updatedAt?: string },
    author: string = 'system'
  ): Promise<BotProfile> {
    const existing = await this.getProfile(profileData.id);
    const now = new Date().toISOString();

    let newVersionNumber = 1;
    let previousVersion: number | undefined;
    let changedFields: string[] = ['*'];

    if (existing) {
      newVersionNumber = existing.version + 1;
      previousVersion = existing.version;
      changedFields = this.computeChangedFields(existing, profileData);
    }

    const fullProfile: BotProfile = botProfileSchema.parse({
      ...profileData,
      version: newVersionNumber,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    });

    const versionRecord: BotProfileVersion = botProfileVersionSchema.parse({
      profileId: fullProfile.id,
      version: fullProfile.version,
      previousVersion,
      changedFields,
      author,
      timestamp: now,
      activationState: fullProfile.enabled ? 'active' : 'archived',
      rolloutPercentage: 100,
      snapshot: fullProfile,
    });

    // In-memory update
    this.profiles.set(fullProfile.id, fullProfile);
    const history = this.versions.get(fullProfile.id) || [];
    history.push(versionRecord);
    this.versions.set(fullProfile.id, history);

    // Database adapter update (if configured)
    if (this.db?.saveProfile) {
      await this.db.saveProfile(fullProfile);
    }
    if (this.db?.saveVersion) {
      await this.db.saveVersion(versionRecord);
    }

    return fullProfile;
  }

  public async getProfile(id: string): Promise<BotProfile | undefined> {
    if (this.db?.getProfile) {
      const fromDb = await this.db.getProfile(id);
      if (fromDb) return fromDb;
    }
    return this.profiles.get(id);
  }

  public async listProfiles(): Promise<BotProfile[]> {
    if (this.db?.listProfiles) {
      const fromDb = await this.db.listProfiles();
      if (fromDb && fromDb.length > 0) return fromDb;
    }
    return Array.from(this.profiles.values());
  }

  public async getVersionHistory(profileId: string): Promise<BotProfileVersion[]> {
    if (this.db?.getVersions) {
      const fromDb = await this.db.getVersions(profileId);
      if (fromDb && fromDb.length > 0) return fromDb;
    }
    return this.versions.get(profileId) || [];
  }

  public async rollbackToVersion(
    profileId: string,
    targetVersion: number,
    author: string = 'admin'
  ): Promise<BotProfile> {
    const history = await this.getVersionHistory(profileId);
    const targetRecord = history.find(v => v.version === targetVersion);

    if (!targetRecord) {
      throw new Error(`Profile ${profileId} version ${targetVersion} not found for rollback`);
    }

    const { id, name, description, systemPolicyId, systemPromptAssetId, responseStyle, knowledgePolicyId, modelPolicyId, memoryPolicyId, toolPolicyId, citationPolicy, enabled, isDefault } = targetRecord.snapshot;

    return this.saveProfile(
      {
        id,
        name,
        description: description ? `${description} (Rollback to v${targetVersion})` : `Rollback to v${targetVersion}`,
        systemPolicyId,
        systemPromptAssetId,
        responseStyle,
        knowledgePolicyId,
        modelPolicyId,
        memoryPolicyId,
        toolPolicyId,
        citationPolicy,
        enabled,
        isDefault,
      },
      `${author} (rollback)`
    );
  }

  private computeChangedFields(
    oldProfile: BotProfile,
    newProfile: Record<string, unknown>
  ): string[] {
    const changed: string[] = [];
    const keysToCheck = [
      'name',
      'description',
      'systemPolicyId',
      'systemPromptAssetId',
      'responseStyle',
      'knowledgePolicyId',
      'modelPolicyId',
      'memoryPolicyId',
      'toolPolicyId',
      'citationPolicy',
      'enabled',
      'isDefault',
    ];

    for (const key of keysToCheck) {
      if (newProfile[key] !== undefined && newProfile[key] !== (oldProfile as any)[key]) {
        changed.push(key);
      }
    }
    return changed;
  }
}
