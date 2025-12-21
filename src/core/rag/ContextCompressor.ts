/**
 * Context Compressor - Intelligently summarize retrieved chunks
 * Research: Latest RAG papers on contextual compression
 */

import { DocumentChunk, CompressedContext } from '../../types/rag';
import { logger } from '../observability/logger';
import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';

export class ContextCompressor {
  private llmAdapter?: LLMAdapter;
  private maxLength: number;

  constructor(llmAdapter?: LLMAdapter, maxLength: number = 2000) {
    this.llmAdapter = llmAdapter;
    this.maxLength = maxLength;
  }

  /**
   * Compress context from multiple chunks
   */
  async compress(
    chunks: DocumentChunk[],
    query: string
  ): Promise<CompressedContext> {
    if (chunks.length === 0) {
      return {
        originalChunks: [],
        compressedContent: '',
        compressionRatio: 1.0,
        preservedChunks: []
      };
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);

    // If already under limit, return as-is
    if (totalLength <= this.maxLength) {
      return {
        originalChunks: chunks,
        compressedContent: chunks.map(c => c.content).join('\n\n'),
        compressionRatio: 1.0,
        preservedChunks: chunks
      };
    }

    // Use LLM to compress if available
    if (this.llmAdapter) {
      return await this.llmCompress(chunks, query);
    }

    // Fallback to truncation
    return this.truncateCompress(chunks);
  }

  /**
   * Compress using LLM
   */
  private async llmCompress(
    chunks: DocumentChunk[],
    query: string
  ): Promise<CompressedContext> {
    try {
      const context = chunks.map((chunk, i) => 
        `[Document ${i + 1}]\n${chunk.content}`
      ).join('\n\n');

      const prompt = `Given the following query and retrieved documents, create a concise summary that preserves all relevant information.

Query: "${query}"

Documents:
${context}

Create a compressed summary that:
1. Preserves all information directly relevant to the query
2. Maintains key facts and details
3. Removes redundant information
4. Keeps the summary under ${this.maxLength} characters

Compressed summary:`;

      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a helpful assistant that compresses information while preserving relevance.',
        maxTokens: Math.floor(this.maxLength / 4), // Rough token estimate
        temperature: 0.3
      });

      const compressed = response.content.trim();
      const originalLength = context.length;
      const compressionRatio = compressed.length / originalLength;

      // Determine which chunks were preserved (heuristic: check if key terms appear)
      const preservedChunks = chunks.filter(chunk => {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const chunkLower = chunk.content.toLowerCase();
        return queryTerms.some(term => chunkLower.includes(term));
      });

      logger.debug('Context compression completed', {
        originalLength,
        compressedLength: compressed.length,
        compressionRatio: compressionRatio.toFixed(2)
      });

      return {
        originalChunks: chunks,
        compressedContent: compressed,
        compressionRatio,
        preservedChunks
      };
    } catch (error: any) {
      logger.warn('LLM compression failed, using truncation', { error: error.message });
      return this.truncateCompress(chunks);
    }
  }

  /**
   * Truncate compression (fallback)
   */
  private truncateCompress(chunks: DocumentChunk[]): CompressedContext {
    let compressed = '';
    const preserved: DocumentChunk[] = [];

    for (const chunk of chunks) {
      if (compressed.length + chunk.content.length <= this.maxLength) {
        compressed += (compressed ? '\n\n' : '') + chunk.content;
        preserved.push(chunk);
      } else {
        // Truncate last chunk
        const remaining = this.maxLength - compressed.length;
        if (remaining > 100) {
          const truncated = chunk.content.substring(0, remaining) + '...';
          compressed += '\n\n' + truncated;
          preserved.push(chunk);
        }
        break;
      }
    }

    const originalLength = chunks.reduce((sum, c) => sum + c.content.length, 0);
    const compressionRatio = compressed.length / originalLength;

    return {
      originalChunks: chunks,
      compressedContent: compressed,
      compressionRatio,
      preservedChunks: preserved
    };
  }
}

