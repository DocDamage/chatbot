/**
 * Study Collection Model (PX15-T01)
 *
 * Manages study collections, source versioning, stale dependency propagation,
 * and collection package import/export.
 */

import * as crypto from 'crypto';
import { StudyCollection, StudySource, TargetLevel } from './StudyTypes';

export class StudyCollectionModel {
  private collections: Map<string, StudyCollection> = new Map();

  /**
   * Computes SHA-256 digest of text or buffer.
   */
  public static computeDigest(content: string | Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Creates a new study collection.
   */
  public createCollection(params: {
    ownerId: string;
    title: string;
    subject: string;
    targetLevel?: TargetLevel;
    learningGoals?: string[];
    scheduleDeadline?: string;
  }): StudyCollection {
    const id = `col-${crypto.randomUUID()}`;
    const collection: StudyCollection = {
      id,
      ownerId: params.ownerId,
      title: params.title,
      subject: params.subject,
      targetLevel: params.targetLevel || 'intermediate',
      learningGoals: params.learningGoals || [],
      scheduleDeadline: params.scheduleDeadline,
      sources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    this.collections.set(id, collection);
    return collection;
  }

  /**
   * Adds an authorized source document to a collection.
   */
  public addSource(
    collectionId: string,
    params: {
      title: string;
      content: string;
      format?: 'markdown' | 'text' | 'pdf' | 'url';
      author?: string;
      originalUrl?: string;
    }
  ): StudySource {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    const sha256Digest = StudyCollectionModel.computeDigest(params.content);
    const source: StudySource = {
      id: `src-${crypto.randomUUID()}`,
      title: params.title,
      author: params.author,
      content: params.content,
      format: params.format || 'markdown',
      originalUrl: params.originalUrl,
      sha256Digest,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      byteSize: Buffer.byteLength(params.content, 'utf8'),
      isStale: false
    };

    collection.sources.push(source);
    collection.updatedAt = new Date().toISOString();
    return source;
  }

  /**
   * Updates existing source content and returns whether the checksum changed.
   */
  public updateSourceContent(
    collectionId: string,
    sourceId: string,
    newContent: string
  ): { source: StudySource; hasChanged: boolean } {
    const collection = this.collections.get(collectionId);
    if (!collection) throw new Error(`Collection ${collectionId} not found`);

    const source = collection.sources.find((s) => s.id === sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found in collection`);

    const newDigest = StudyCollectionModel.computeDigest(newContent);
    const hasChanged = newDigest !== source.sha256Digest;

    source.content = newContent;
    source.sha256Digest = newDigest;
    source.updatedAt = new Date().toISOString();
    source.byteSize = Buffer.byteLength(newContent, 'utf8');
    source.isStale = false;

    collection.updatedAt = new Date().toISOString();

    return { source, hasChanged };
  }

  /**
   * Gets a study collection by ID.
   */
  public getCollection(collectionId: string): StudyCollection | undefined {
    return this.collections.get(collectionId);
  }

  /**
   * Exports a study collection to a portable JSON bundle.
   */
  public exportCollectionBundle(collectionId: string): string {
    const collection = this.collections.get(collectionId);
    if (!collection) throw new Error(`Collection ${collectionId} not found`);

    return JSON.stringify(
      {
        manifestVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        collection
      },
      null,
      2
    );
  }

  /**
   * Imports a study collection from a portable bundle.
   */
  public importCollectionBundle(bundleJson: string): StudyCollection {
    const parsed = JSON.parse(bundleJson);
    if (!parsed.collection || !parsed.collection.id) {
      throw new Error('Invalid study collection bundle format');
    }

    const imported = parsed.collection as StudyCollection;
    this.collections.set(imported.id, imported);
    return imported;
  }
}
