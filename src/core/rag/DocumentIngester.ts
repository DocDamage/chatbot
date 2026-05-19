/**
 * Document Ingester - Parse and chunk documents for RAG
 * Supports: Text, Markdown, JSON, PDF, DOCX/DOC conversion hooks, and OCR-based image/GIF ingestion.
 */

import { DocumentChunk } from '../../types/rag';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';
import { FileExtractionOptions } from './ingestion/ExtractedDocument';
import { FileTypeRouter } from './ingestion/FileTypeRouter';

export interface IngestOptions extends FileExtractionOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  embeddingProvider?: 'openai' | 'xenova' | 'ollama';
}

export class DocumentIngester {
  private embeddingService?: EmbeddingService;
  private fileTypeRouter: FileTypeRouter;
  private defaultChunkSize: number = 500;
  private defaultChunkOverlap: number = 50;

  constructor(embeddingService?: EmbeddingService, fileTypeRouter: FileTypeRouter = new FileTypeRouter()) {
    this.embeddingService = embeddingService;
    this.fileTypeRouter = fileTypeRouter;
  }

  /**
   * Ingest a file and return chunks
   */
  async ingestFile(
    filePath: string,
    options: IngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const content = await this.fileTypeRouter.extract(filePath, options);

    const chunks = this.chunkText(
      content.text,
      {
        ...content.metadata,
        extractionWarnings: content.warnings,
        supportedExtensions: this.fileTypeRouter.getSupportedExtensions()
      },
      options.chunkSize || this.defaultChunkSize,
      options.chunkOverlap || this.defaultChunkOverlap
    );

    // Generate embeddings if requested
    if (options.generateEmbeddings && this.embeddingService && chunks.length > 0) {
      await this.generateEmbeddings(chunks, options.embeddingProvider);
    }

    logger.info('File ingested', {
      filePath,
      chunksCount: chunks.length,
      hasEmbeddings: chunks[0]?.embedding !== undefined,
      warnings: content.warnings?.length || 0,
      type: content.metadata.type
    });

    return chunks;
  }

  /**
   * Ingest text directly
   */
  async ingestText(
    text: string,
    metadata: Record<string, any> = {},
    options: IngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const chunks = this.chunkText(
      text,
      metadata,
      options.chunkSize || this.defaultChunkSize,
      options.chunkOverlap || this.defaultChunkOverlap
    );

    if (options.generateEmbeddings && this.embeddingService && chunks.length > 0) {
      await this.generateEmbeddings(chunks, options.embeddingProvider);
    }

    return chunks;
  }

  /**
   * Ingest multiple files
   */
  async ingestDirectory(
    directoryPath: string,
    options: IngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        try {
          const chunks = await this.ingestFile(filePath, options);
          allChunks.push(...chunks);
        } catch (error: any) {
          logger.warn('Failed to ingest file', { filePath, error: error.message });
        }
      }
    }

    logger.info('Directory ingested', {
      directoryPath,
      filesCount: files.length,
      chunksCount: allChunks.length
    });

    return allChunks;
  }

  /**
   * Return supported extensions exposed by the file type router.
   */
  getSupportedExtensions(): string[] {
    return this.fileTypeRouter.getSupportedExtensions();
  }

  /**
   * Chunk text into smaller pieces
   */
  private chunkText(
    text: string,
    metadata: Record<string, any>,
    chunkSize: number,
    chunkOverlap: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const words = text.split(/\s+/).filter(word => word.trim().length > 0);
    let currentChunk: string[] = [];
    let currentLength = 0;
    let chunkIndex = 0;

    if (words.length === 0) {
      const diagnostic = metadata.error || (metadata.extractionWarnings || []).join('; ');
      if (!diagnostic) {
        return [];
      }

      return [{
        id: `${metadata.source || 'doc'}-chunk-0`,
        content: `Extraction warning for ${metadata.source || 'unknown source'}: ${diagnostic}`,
        metadata: {
          ...metadata,
          chunkIndex: 0,
          startChar: 0,
          endChar: 0,
          emptyExtraction: true
        }
      }];
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordLength = word.length + 1; // +1 for space

      if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        const chunkText = currentChunk.join(' ');
        chunks.push({
          id: `${metadata.source || 'doc'}-chunk-${chunkIndex}`,
          content: chunkText,
          metadata: {
            ...metadata,
            chunkIndex,
            startChar: i - currentChunk.length,
            endChar: i
          }
        });
        chunkIndex++;

        // Start new chunk with overlap
        const overlapWords = Math.max(0, Math.floor(chunkOverlap / 10)); // Rough estimate
        currentChunk = overlapWords > 0 ? currentChunk.slice(-overlapWords) : [];
        currentLength = currentChunk.join(' ').length;
      }

      currentChunk.push(word);
      currentLength += wordLength;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        id: `${metadata.source || 'doc'}-chunk-${chunkIndex}`,
        content: currentChunk.join(' '),
        metadata: {
          ...metadata,
          chunkIndex,
          startChar: words.length - currentChunk.length,
          endChar: words.length
        }
      });
    }

    return chunks;
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(
    chunks: DocumentChunk[],
    provider?: 'openai' | 'xenova' | 'ollama'
  ): Promise<void> {
    if (!this.embeddingService) {
      logger.warn('Embedding service not available, skipping embeddings');
      return;
    }

    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await this.embeddingService.embedBatch(texts, { provider });

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }

    logger.debug('Embeddings generated', { chunksCount: chunks.length });
  }
}
