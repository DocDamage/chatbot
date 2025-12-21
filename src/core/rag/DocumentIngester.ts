/**
 * Document Ingester - Parse and chunk documents for RAG
 * Supports: Text, PDF, Markdown, JSON
 */

import { DocumentChunk } from '../../types/rag';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface IngestOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  embeddingProvider?: 'openai' | 'xenova' | 'ollama';
}

export class DocumentIngester {
  private embeddingService?: EmbeddingService;
  private defaultChunkSize: number = 500;
  private defaultChunkOverlap: number = 50;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Ingest a file and return chunks
   */
  async ingestFile(
    filePath: string,
    options: IngestOptions = {}
  ): Promise<DocumentChunk[]> {
    const ext = path.extname(filePath).toLowerCase();
    const content = await this.readFile(filePath, ext);

    const chunks = this.chunkText(
      content.text,
      content.metadata,
      options.chunkSize || this.defaultChunkSize,
      options.chunkOverlap || this.defaultChunkOverlap
    );

    // Generate embeddings if requested
    if (options.generateEmbeddings && this.embeddingService) {
      await this.generateEmbeddings(chunks, options.embeddingProvider);
    }

    logger.info('File ingested', {
      filePath,
      chunksCount: chunks.length,
      hasEmbeddings: chunks[0]?.embedding !== undefined
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

    if (options.generateEmbeddings && this.embeddingService) {
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
   * Read file based on extension
   */
  private async readFile(filePath: string, ext: string): Promise<{
    text: string;
    metadata: Record<string, any>;
  }> {
    switch (ext) {
      case '.txt':
      case '.md':
        return {
          text: fs.readFileSync(filePath, 'utf-8'),
          metadata: {
            source: filePath,
            title: path.basename(filePath),
            type: ext === '.md' ? 'markdown' : 'text'
          }
        };

      case '.json':
        const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
          text: typeof json === 'string' ? json : JSON.stringify(json, null, 2),
          metadata: {
            source: filePath,
            title: path.basename(filePath),
            type: 'json'
          }
        };

      case '.pdf':
        try {
          const pdfParse = require('pdf-parse');
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          return {
            text: pdfData.text,
            metadata: {
              source: filePath,
              title: pdfData.info?.Title || path.basename(filePath),
              type: 'pdf',
              pages: pdfData.numpages
            }
          };
        } catch (error: any) {
          logger.warn('PDF parsing failed', { filePath, error: error.message });
          return {
            text: '',
            metadata: {
              source: filePath,
              title: path.basename(filePath),
              type: 'pdf',
              error: 'Failed to parse PDF'
            }
          };
        }

      default:
        // Try to read as text
        return {
          text: fs.readFileSync(filePath, 'utf-8'),
          metadata: {
            source: filePath,
            title: path.basename(filePath),
            type: 'text'
          }
        };
    }
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
    const words = text.split(/\s+/);
    let currentChunk: string[] = [];
    let currentLength = 0;
    let chunkIndex = 0;

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
        const overlapWords = Math.floor(chunkOverlap / 10); // Rough estimate
        currentChunk = currentChunk.slice(-overlapWords);
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

