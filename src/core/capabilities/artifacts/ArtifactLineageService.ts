import * as crypto from 'crypto';

export interface ArtifactLineageRecord {
  id: string;
  projectId: string;
  ownerId: string;
  capabilityId: string;
  packId: string;
  name: string;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
  createdAt: string;
  parentArtifactIds: string[];
  generationParameters: Record<string, unknown>;
  rightsAndNotices: string[];
  retentionExpiresAt?: string;
  previewAvailable: boolean;
  downloadPath: string;
  status: 'active' | 'archived' | 'deleted';
}

export class ArtifactLineageService {
  private artifacts = new Map<string, ArtifactLineageRecord>();

  public registerArtifact(params: {
    projectId: string;
    ownerId: string;
    capabilityId: string;
    packId: string;
    name: string;
    mimeType: string;
    contentBufferOrString: Buffer | string;
    parentArtifactIds?: string[];
    generationParameters?: Record<string, unknown>;
    rightsAndNotices?: string[];
    retentionDays?: number;
  }): ArtifactLineageRecord {
    const id = `art-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const buffer = Buffer.isBuffer(params.contentBufferOrString)
      ? params.contentBufferOrString
      : Buffer.from(params.contentBufferOrString, 'utf-8');

    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const retentionExpiresAt = params.retentionDays
      ? new Date(Date.now() + params.retentionDays * 86400000).toISOString()
      : undefined;

    const record: ArtifactLineageRecord = {
      id,
      projectId: params.projectId,
      ownerId: params.ownerId,
      capabilityId: params.capabilityId,
      packId: params.packId,
      name: params.name,
      mimeType: params.mimeType,
      byteSize: buffer.length,
      sha256Hash,
      createdAt: new Date().toISOString(),
      parentArtifactIds: params.parentArtifactIds || [],
      generationParameters: params.generationParameters || {},
      rightsAndNotices: params.rightsAndNotices || ['All rights reserved to project owner; derived artifact.'],
      retentionExpiresAt,
      previewAvailable: ['text/plain', 'application/json', 'image/png', 'image/jpeg', 'text/markdown'].includes(
        params.mimeType
      ),
      downloadPath: `/api/capabilities/artifacts/${id}/download`,
      status: 'active'
    };

    this.artifacts.set(id, record);
    return record;
  }

  public getArtifact(artifactId: string): ArtifactLineageRecord | undefined {
    return this.artifacts.get(artifactId);
  }

  public getLineageTree(artifactId: string): {
    current: ArtifactLineageRecord;
    parents: ArtifactLineageRecord[];
  } {
    const current = this.artifacts.get(artifactId);
    if (!current) throw new Error(`Artifact not found: ${artifactId}`);

    const parents: ArtifactLineageRecord[] = [];
    for (const parentId of current.parentArtifactIds) {
      const parent = this.artifacts.get(parentId);
      if (parent) parents.push(parent);
    }

    return { current, parents };
  }

  public listArtifacts(filter?: {
    projectId?: string;
    ownerId?: string;
    capabilityId?: string;
    mimeType?: string;
  }): ArtifactLineageRecord[] {
    let list = Array.from(this.artifacts.values()).filter(a => a.status === 'active');
    if (filter?.projectId) list = list.filter(a => a.projectId === filter.projectId);
    if (filter?.ownerId) list = list.filter(a => a.ownerId === filter.ownerId);
    if (filter?.capabilityId) list = list.filter(a => a.capabilityId === filter.capabilityId);
    if (filter?.mimeType) list = list.filter(a => a.mimeType === filter.mimeType);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public deleteArtifact(artifactId: string): boolean {
    const item = this.artifacts.get(artifactId);
    if (!item) return false;
    item.status = 'deleted';
    return true;
  }
}
