/**
 * Document Manager - High-level API for managing RAG knowledge base
 */

import { RAGService } from './RAGService';
import { DocumentIngester } from './DocumentIngester';
import { DocumentChunk } from '../../types/rag';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';

export class DocumentManager {
  private ragService: RAGService;
  private ingester: DocumentIngester;
  private embeddingService?: EmbeddingService;

  constructor(
    ragService: RAGService,
    embeddingService?: EmbeddingService
  ) {
    this.ragService = ragService;
    this.embeddingService = embeddingService;
    this.ingester = new DocumentIngester(embeddingService);
  }

  /**
   * Add a file to the knowledge base
   */
  async addFile(
    filePath: string,
    options: {
      generateEmbeddings?: boolean;
      chunkSize?: number;
    } = {}
  ): Promise<DocumentChunk[]> {
    const chunks = await this.ingester.ingestFile(filePath, {
      generateEmbeddings: options.generateEmbeddings ?? true,
      chunkSize: options.chunkSize
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
    options: {
      generateEmbeddings?: boolean;
      chunkSize?: number;
    } = {}
  ): Promise<DocumentChunk[]> {
    const chunks = await this.ingester.ingestText(text, metadata, {
      generateEmbeddings: options.generateEmbeddings ?? true,
      chunkSize: options.chunkSize
    });

    this.ragService.addDocuments(chunks);

    return chunks;
  }

  /**
   * Add multiple files from a directory
   */
  async addDirectory(
    directoryPath: string,
    options: {
      generateEmbeddings?: boolean;
      chunkSize?: number;
    } = {}
  ): Promise<DocumentChunk[]> {
    const chunks = await this.ingester.ingestDirectory(directoryPath, {
      generateEmbeddings: options.generateEmbeddings ?? true,
      chunkSize: options.chunkSize
    });

    this.ragService.addDocuments(chunks);

    logger.info('Directory added to knowledge base', {
      directoryPath,
      chunksCount: chunks.length
    });

    return chunks;
  }

  /**
   * Get knowledge base statistics
   */
  getStats() {
    const retriever = this.ragService.getRetriever();
    // Would need to expose document count from retriever
    return {
      hasEmbeddings: !!this.embeddingService,
      embeddingProvider: this.embeddingService ? 'configured' : 'none'
    };
  }
}

