/**
 * Document Metadata Manager - Enhanced document management
 */

import { logger } from '../observability/logger';
import { Database } from '../database/Database';

export interface DocumentMetadata {
  id: string;
  source: string;
  title: string;
  description?: string;
  tags: string[];
  category?: string;
  version: number;
  chunkCount: number;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  metadata: Record<string, any>;
}

export interface DocumentSearchFilters {
  tags?: string[];
  category?: string;
  source?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  searchQuery?: string;
}

export class DocumentMetadataManager {
  private documents: Map<string, DocumentMetadata> = new Map();
  private db?: Database;

  constructor(db?: Database) {
    this.db = db;
  }

  /**
   * Create or update document metadata
   */
  async upsertMetadata(metadata: Omit<DocumentMetadata, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentMetadata> {
    // Check if document exists by source and hash
    const existing = Array.from(this.documents.values()).find(
      d => d.source === metadata.source && d.contentHash === metadata.contentHash
    );

    if (existing) {
      // Update existing
      const updated: DocumentMetadata = {
        ...existing,
        ...metadata,
        version: existing.version + 1,
        updatedAt: new Date(),
      };
      this.documents.set(existing.id, updated);
      return updated;
    }

    // Create new
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDoc: DocumentMetadata = {
      id,
      ...metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.documents.set(id, newDoc);

    // Persist to database
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO documents 
           (id, source, title, description, tags, category, version, chunk_count, content_hash, created_by, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            metadata.source,
            metadata.title,
            metadata.description || null,
            JSON.stringify(metadata.tags),
            metadata.category || null,
            metadata.version,
            metadata.chunkCount,
            metadata.contentHash,
            metadata.createdBy || null,
            JSON.stringify(metadata.metadata),
            newDoc.createdAt.toISOString(),
            newDoc.updatedAt.toISOString(),
          ]
        );
      } catch (error: any) {
        logger.warn('Failed to persist document metadata', { error: error.message });
      }
    }

    return newDoc;
  }

  /**
   * Get document metadata
   */
  getMetadata(documentId: string): DocumentMetadata | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Search documents
   */
  search(filters: DocumentSearchFilters, limit: number = 20): DocumentMetadata[] {
    let results = Array.from(this.documents.values());

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(doc =>
        filters.tags!.some(tag => doc.tags.includes(tag))
      );
    }

    // Filter by category
    if (filters.category) {
      results = results.filter(doc => doc.category === filters.category);
    }

    // Filter by source
    if (filters.source) {
      results = results.filter(doc => doc.source === filters.source);
    }

    // Filter by date range
    if (filters.createdAfter) {
      results = results.filter(doc => doc.createdAt >= filters.createdAfter!);
    }
    if (filters.createdBefore) {
      results = results.filter(doc => doc.createdAt <= filters.createdBefore!);
    }

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      results = results.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query) ||
        doc.source.toLowerCase().includes(query)
      );
    }

    return results
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get all tags
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const doc of this.documents.values()) {
      doc.tags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Get all categories
   */
  getAllCategories(): string[] {
    const categorySet = new Set<string>();
    for (const doc of this.documents.values()) {
      if (doc.category) {
        categorySet.add(doc.category);
      }
    }
    return Array.from(categorySet).sort();
  }
}
