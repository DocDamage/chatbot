/**
 * Document Recovery & Version History Manager (PX14-T09)
 *
 * Implements autosave caching, crash recovery snapshots, atomic write integrity,
 * and document revision history with bounded retention.
 */

import * as crypto from 'crypto';
import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { CanonicalDocument, DocumentRevision } from './WritingTypes';

export interface RecoverySnapshot {
  documentId: string;
  rawText: string;
  savedAt: string;
  digest: string;
  sourceDigest: string;
}

export class DocumentRecoveryManager {
  private autosaveStore: Map<string, RecoverySnapshot> = new Map();
  private revisionHistory: Map<string, DocumentRevision[]> = new Map();
  private maxRevisionsPerDoc: number;

  constructor(maxRevisionsPerDoc: number = 50) {
    this.maxRevisionsPerDoc = maxRevisionsPerDoc;
  }

  /**
   * Saves an autosave snapshot in recovery storage separate from source file.
   */
  public saveAutosaveSnapshot(doc: CanonicalDocument): RecoverySnapshot {
    const rawBuffer = Buffer.from(doc.rawText, 'utf8');
    const digest = CanonicalDocumentModel.computeDigest(rawBuffer);

    const snapshot: RecoverySnapshot = {
      documentId: doc.id,
      rawText: doc.rawText,
      savedAt: new Date().toISOString(),
      digest,
      sourceDigest: doc.metadata.sha256Digest
    };

    this.autosaveStore.set(doc.id, snapshot);
    return snapshot;
  }

  /**
   * Retrieves any existing recovery snapshot for a document.
   */
  public getRecoverySnapshot(documentId: string): RecoverySnapshot | undefined {
    return this.autosaveStore.get(documentId);
  }

  /**
   * Clears autosave snapshot upon successful clean save.
   */
  public clearAutosaveSnapshot(documentId: string): void {
    this.autosaveStore.delete(documentId);
  }

  /**
   * Checks if an unsaved crash recovery snapshot exists and differs from last saved source.
   */
  public checkCrashRecoveryNeeded(doc: CanonicalDocument): {
    recoveryAvailable: boolean;
    snapshot?: RecoverySnapshot;
  } {
    const snapshot = this.autosaveStore.get(doc.id);
    if (!snapshot) return { recoveryAvailable: false };

    const hasDiverged = snapshot.digest !== doc.metadata.sha256Digest;
    return {
      recoveryAvailable: hasDiverged,
      snapshot: hasDiverged ? snapshot : undefined
    };
  }

  /**
   * Creates a formal revision snapshot in the document timeline.
   */
  public createRevision(
    doc: CanonicalDocument,
    author: string = 'User',
    commitMessage: string = 'Manual save'
  ): DocumentRevision {
    const revisions = this.revisionHistory.get(doc.id) || [];
    const rawBuffer = Buffer.from(doc.rawText, 'utf8');
    const digest = CanonicalDocumentModel.computeDigest(rawBuffer);

    const revision: DocumentRevision = {
      revisionId: `rev-${crypto.randomUUID()}`,
      documentId: doc.id,
      timestamp: new Date().toISOString(),
      author,
      commitMessage,
      rawText: doc.rawText,
      sha256Digest: digest,
      byteSize: rawBuffer.length
    };

    revisions.push(revision);

    // Apply bounded retention
    if (revisions.length > this.maxRevisionsPerDoc) {
      revisions.splice(0, revisions.length - this.maxRevisionsPerDoc);
    }

    this.revisionHistory.set(doc.id, revisions);
    return revision;
  }

  /**
   * Retrieves all revisions for a document.
   */
  public getRevisions(documentId: string): DocumentRevision[] {
    return this.revisionHistory.get(documentId) || [];
  }

  /**
   * Restores a document to a specific historical revision.
   */
  public restoreRevision(
    currentDoc: CanonicalDocument,
    revisionId: string
  ): { restoredDocument: CanonicalDocument; previousDigest: string } {
    const revisions = this.revisionHistory.get(currentDoc.id) || [];
    const rev = revisions.find((r) => r.revisionId === revisionId);
    if (!rev) {
      throw new Error(`Revision ${revisionId} not found for document ${currentDoc.id}`);
    }

    const previousDigest = currentDoc.metadata.sha256Digest;
    const restoredDoc: CanonicalDocument = {
      ...currentDoc,
      rawText: rev.rawText,
      metadata: {
        ...currentDoc.metadata,
        updatedAt: new Date().toISOString(),
        byteSize: rev.byteSize,
        sha256Digest: rev.sha256Digest
      },
      isDirty: true
    };

    return { restoredDocument: restoredDoc, previousDigest };
  }
}
