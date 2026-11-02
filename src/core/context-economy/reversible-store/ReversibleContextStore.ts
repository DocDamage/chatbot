/**
 * Reversible Context Store & Retrieval Engine (PX-03 / PX03-T04)
 * Stores full original context objects with SHA-256 integrity digests,
 * tenant/access scoping, expiration TTLs, omitted range records, and
 * on-demand verbatim retrieval capabilities.
 */

import { createHash } from 'crypto';

export interface SourceAnchor {
  filePath?: string;
  startLine?: number;
  endLine?: number;
  symbolName?: string;
  contentHash: string;
}

export interface ReversibleContextRecord {
  contextKey: string;
  ownerId: string;
  projectId?: string;
  contentType: string;
  originalContent: string;
  originalByteSize: number;
  compressedContent: string;
  compressedByteSize: number;
  compressionMethod: string;
  compressionRatio: number;
  sourceAnchor?: SourceAnchor;
  omittedRanges?: Array<{ start: number; end: number; summary: string }>;
  createdAt: string;
  expiresAt: string;
  accessScope: 'user_only' | 'project_shared' | 'global';
}

export class ReversibleContextStore {
  private static instance: ReversibleContextStore;
  private records = new Map<string, ReversibleContextRecord>();

  public static getInstance(): ReversibleContextStore {
    if (!ReversibleContextStore.instance) {
      ReversibleContextStore.instance = new ReversibleContextStore();
    }
    return ReversibleContextStore.instance;
  }

  /**
   * Stores an uncompressed piece of content alongside its compressed version,
   * returning a cryptographically verifiable contextKey.
   */
  public store(params: {
    ownerId: string;
    projectId?: string;
    contentType: string;
    originalContent: string;
    compressedContent: string;
    compressionMethod: string;
    sourceAnchor?: SourceAnchor;
    omittedRanges?: Array<{ start: number; end: number; summary: string }>;
    ttlSeconds?: number;
    accessScope?: 'user_only' | 'project_shared' | 'global';
  }): ReversibleContextRecord {
    const originalBuffer = Buffer.from(params.originalContent, 'utf8');
    const compressedBuffer = Buffer.from(params.compressedContent, 'utf8');

    const contentHash = createHash('sha256').update(originalBuffer).digest('hex');
    const contextKey = `ctx_${contentHash.substring(0, 16)}_${Date.now()}`;
    const ttl = params.ttlSeconds || 86400; // 24 hours default
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const record: ReversibleContextRecord = {
      contextKey,
      ownerId: params.ownerId,
      projectId: params.projectId,
      contentType: params.contentType,
      originalContent: params.originalContent,
      originalByteSize: originalBuffer.length,
      compressedContent: params.compressedContent,
      compressedByteSize: compressedBuffer.length,
      compressionMethod: params.compressionMethod,
      compressionRatio: originalBuffer.length > 0 ? compressedBuffer.length / originalBuffer.length : 1,
      sourceAnchor: params.sourceAnchor,
      omittedRanges: params.omittedRanges,
      createdAt: new Date().toISOString(),
      expiresAt,
      accessScope: params.accessScope || 'user_only'
    };

    this.records.set(contextKey, record);
    return record;
  }

  /**
   * Verbatim retrieval of original content under access control check.
   */
  public retrieve(contextKey: string, requester: { userId: string; projectId?: string; isAdmin?: boolean }): { success: boolean; content?: string; record?: ReversibleContextRecord; reason?: string } {
    const record = this.records.get(contextKey);
    if (!record) {
      return { success: false, reason: `Context key '${contextKey}' not found in reversible store` };
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return { success: false, reason: `Context key '${contextKey}' has expired` };
    }

    // Access control check (tenant isolation)
    if (!requester.isAdmin) {
      if (record.accessScope === 'user_only' && record.ownerId !== requester.userId) {
        return { success: false, reason: 'Access denied: caller does not own this context' };
      }
      if (record.accessScope === 'project_shared' && (!requester.projectId || record.projectId !== requester.projectId)) {
        if (record.ownerId !== requester.userId) {
          return { success: false, reason: 'Access denied: caller does not belong to project scope' };
        }
      }
    }

    return {
      success: true,
      content: record.originalContent,
      record
    };
  }

  public clear(): void {
    this.records.clear();
  }
}
