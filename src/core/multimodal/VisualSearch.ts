/**
 * Visual Search - Find similar images in knowledge base
 * Research: MIT Vision Group, Visual Similarity Search
 */

import { logger } from '../observability/logger';

export interface ImageEmbedding {
  imageId: string;
  embedding: number[];
  metadata?: {
    source: string;
    tags: string[];
    timestamp: Date;
  };
}

export interface VisualSearchResult {
  imageId: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export class VisualSearch {
  private embeddings: Map<string, ImageEmbedding> = new Map();

  /**
   * Add image embedding to search index
   */
  addImage(embedding: ImageEmbedding): void {
    this.embeddings.set(embedding.imageId, embedding);
    logger.debug('Image added to visual search index', { imageId: embedding.imageId });
  }

  /**
   * Search for similar images
   */
  async search(
    queryEmbedding: number[],
    topK: number = 10,
    threshold: number = 0.7
  ): Promise<VisualSearchResult[]> {
    const results: VisualSearchResult[] = [];

    for (const [imageId, embedding] of this.embeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding.embedding);
      
      if (similarity >= threshold) {
        results.push({
          imageId,
          similarity,
          metadata: embedding.metadata
        });
      }
    }

    // Sort by similarity and return top K
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Remove image from index
   */
  removeImage(imageId: string): void {
    this.embeddings.delete(imageId);
    logger.debug('Image removed from visual search index', { imageId });
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalImages: this.embeddings.size
    };
  }
}

