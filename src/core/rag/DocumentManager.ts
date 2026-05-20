/**
 * Document Manager - High-level API for managing RAG knowledge base
 */

import { RAGService } from './RAGService';
import { DocumentIngester, IngestOptions } from './DocumentIngester';
import { DocumentChunk } from '../../types/rag';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';
import { RAGDocumentStore } from './RAGDocumentStore';
import { randomUUID } from 'crypto';
import { EntityLinkingService } from '../entity/EntityLinkingService';

export type DocumentManagerIngestOptions = IngestOptions;

export class DocumentManager {
  private ragService: RAGService;
  private ingester: DocumentIngester;
  private embeddingService?: EmbeddingService;
  private documentStore?: RAGDocumentStore;
  private entityLinkingService?: EntityLinkingService;

  constructor(
    ragService: RAGService,
    embeddingService?: EmbeddingService,
    documentStore?: RAGDocumentStore,
    entityLinkingService?: EntityLinkingService
  ) {
    this.ragService = ragService;
    this.embeddingService = embeddingService;
    this.documentStore = documentStore;
    this.entityLinkingService = entityLinkingService;
    this.ingester = new DocumentIngester(embeddingService);
  }

  /**
   * Add a file to the knowledge base
   */
  async addFile(
    filePath: string,
    options: DocumentManagerIngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const chunks = await this.ingester.ingestFile(filePath, {
      ...options,
      generateEmbeddings: options.generateEmbeddings ?? true
    });

    await this.persistChunks(chunks, {
      sourceType: chunks[0]?.metadata.type || 'file',
      embeddingProvider: options.embeddingProvider
    });
    this.ragService.addDocuments(chunks);

    logger.info('File added to knowledge base', {
      filePath,
      chunksCount: chunks.length
    });

    return chunks;
  }

  /**
   * Add text to the knowledge base
   */
  async addText(
    text: string,
    metadata: Record<string, any> = {},
    options: DocumentManagerIngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const enrichedMetadata: Record<string, any> = {
      ...metadata,
      source: metadata.source || `manual-${Date.now()}-${randomUUID()}`
    };

    const chunks = await this.ingester.ingestText(text, enrichedMetadata, {
      ...options,
      generateEmbeddings: options.generateEmbeddings ?? true
    });

    await this.persistChunks(chunks, {
      sourceType: enrichedMetadata.type || 'text',
      embeddingProvider: options.embeddingProvider
    });
    this.ragService.addDocuments(chunks);

    return chunks;
  }

  /**
   * Add multiple files from a directory
   */
  async addDirectory(
    directoryPath: string,
    options: DocumentManagerIngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const chunks = await this.ingester.ingestDirectory(directoryPath, {
      ...options,
      generateEmbeddings: options.generateEmbeddings ?? true
    });

    await this.persistChunks(chunks, {
      sourceType: 'directory',
      embeddingProvider: options.embeddingProvider
    });
    this.ragService.addDocuments(chunks);

    logger.info('Directory added to knowledge base', {
      directoryPath,
      chunksCount: chunks.length
    });

    return chunks;
  }

  /**
   * Return the file extensions this manager can route into RAG ingestion.
   */
  getSupportedExtensions(): string[] {
    return this.ingester.getSupportedExtensions();
  }

  /**
   * Get knowledge base statistics
   */
  async getStats() {
    const persistence = this.documentStore
      ? await this.documentStore.getStats()
      : undefined;

    return {
      hasEmbeddings: !!this.embeddingService,
      embeddingProvider: this.embeddingService ? 'configured' : 'none',
      persistentStore: !!this.documentStore,
      persistence,
      supportedExtensions: this.getSupportedExtensions()
    };
  }

  private async persistChunks(chunks: DocumentChunk[], options: {
    sourceType?: string;
    embeddingProvider?: string;
  }): Promise<void> {
    if (!this.documentStore) {
      return;
    }

    await this.documentStore.saveChunks(chunks, options);
    await this.persistEntityLinks(chunks);
  }

  private async persistEntityLinks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.entityLinkingService) {
      return;
    }

    for (const chunk of chunks) {
      await this.entityLinkingService.linkAndPersist([
        chunk.metadata.source,
        chunk.metadata.title,
        chunk.content
      ].filter(Boolean).join('\n'));
    }
  }
}
