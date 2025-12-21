/**
 * Hybrid Retriever - Combines BM25 + Dense Vector Search + Sparse Retrieval
 * Research: Latest RAG papers, Stanford CS224N, MIT NLP Group
 */

import { DocumentChunk, RetrievalResult } from '../../types/rag';
import { logger } from '../observability/logger';
import natural from 'natural';

export class HybridRetriever {
  private documents: DocumentChunk[] = [];
  private bm25Index: natural.TfIdf | null = null;
  private embeddings: Map<string, number[]> = new Map();
  private tokenizer = new natural.WordTokenizer();

  /**
   * Add documents to the knowledge base
   */
  addDocuments(chunks: DocumentChunk[]): void {
    this.documents.push(...chunks);
    this.rebuildIndexes();
    logger.info(`Added ${chunks.length} documents to knowledge base`, {
      totalDocuments: this.documents.length
    });
  }

  /**
   * Retrieve relevant chunks using hybrid approach
   */
  async retrieve(
    query: string,
    topK: number = 10,
    weights: { bm25: number; dense: number; sparse: number } = { bm25: 0.4, dense: 0.4, sparse: 0.2 }
  ): Promise<RetrievalResult[]> {
    const results: Map<string, RetrievalResult> = new Map();

    // BM25 retrieval
    const bm25Results = await this.retrieveBM25(query, topK * 2);
    for (const result of bm25Results) {
      const existing = results.get(result.chunk.id);
      if (existing) {
        existing.score = existing.score * 0.5 + result.score * weights.bm25;
      } else {
        results.set(result.chunk.id, {
          ...result,
          score: result.score * weights.bm25,
          retrievalMethod: 'bm25'
        });
      }
    }

    // Dense vector retrieval (if embeddings available)
    const denseResults = await this.retrieveDense(query, topK * 2);
    for (const result of denseResults) {
      const existing = results.get(result.chunk.id);
      if (existing) {
        existing.score = existing.score + result.score * weights.dense;
      } else {
        results.set(result.chunk.id, {
          ...result,
          score: result.score * weights.dense,
          retrievalMethod: 'dense'
        });
      }
    }

    // Sparse retrieval (keyword-based)
    const sparseResults = await this.retrieveSparse(query, topK * 2);
    for (const result of sparseResults) {
      const existing = results.get(result.chunk.id);
      if (existing) {
        existing.score = existing.score + result.score * weights.sparse;
      } else {
        results.set(result.chunk.id, {
          ...result,
          score: result.score * weights.sparse,
          retrievalMethod: 'sparse'
        });
      }
    }

    // Normalize scores and sort
    const finalResults = Array.from(results.values())
      .map(result => ({
        ...result,
        score: result.score / 3 // Normalize
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.debug('Hybrid retrieval completed', {
      query,
      resultsCount: finalResults.length,
      topScore: finalResults[0]?.score
    });

    return finalResults;
  }

  /**
   * BM25 retrieval
   */
  private async retrieveBM25(query: string, topK: number): Promise<RetrievalResult[]> {
    if (!this.bm25Index || this.documents.length === 0) {
      return [];
    }

    const queryTokens = this.tokenizer.tokenize(query.toLowerCase()) || [];
    const scores = new Map<string, number>();

    for (const doc of this.documents) {
      const docTokens = this.tokenizer.tokenize(doc.content.toLowerCase()) || [];
      let score = 0;

      for (const token of queryTokens) {
        const tf = docTokens.filter(t => t === token).length;
        const idf = this.bm25Index.idf(token, this.documents.length);
        score += tf * idf;
      }

      if (score > 0) {
        scores.set(doc.id, score);
      }
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({
        chunk: this.documents.find(d => d.id === id)!,
        score,
        retrievalMethod: 'bm25' as const
      }))
      .filter(r => r.chunk)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Dense vector retrieval (cosine similarity)
   */
  private async retrieveDense(query: string, topK: number): Promise<RetrievalResult[]> {
    // For now, return empty if no embeddings
    // In production, this would use an embedding model
    const queryEmbedding = await this.getQueryEmbedding(query);
    if (!queryEmbedding) {
      return [];
    }

    const scores: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const doc of this.documents) {
      const docEmbedding = doc.embedding || this.embeddings.get(doc.id);
      if (docEmbedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
        scores.push({ chunk: doc, score: similarity });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => ({
        ...r,
        retrievalMethod: 'dense' as const
      }));
  }

  /**
   * Sparse retrieval (keyword matching)
   */
  private async retrieveSparse(query: string, topK: number): Promise<RetrievalResult[]> {
    const queryTokens = new Set(
      this.tokenizer.tokenize(query.toLowerCase()) || []
    );
    const scores: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const doc of this.documents) {
      const docTokens = new Set(
        this.tokenizer.tokenize(doc.content.toLowerCase()) || []
      );
      const intersection = new Set([...queryTokens].filter(x => docTokens.has(x)));
      const union = new Set([...queryTokens, ...docTokens]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;

      if (jaccard > 0) {
        scores.push({ chunk: doc, score: jaccard });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => ({
        ...r,
        retrievalMethod: 'sparse' as const
      }));
  }

  /**
   * Rebuild indexes after adding documents
   */
  private rebuildIndexes(): void {
    // Rebuild BM25 index
    this.bm25Index = new natural.TfIdf();
    for (const doc of this.documents) {
      this.bm25Index.addDocument(doc.content);
    }
  }

  /**
   * Get query embedding (placeholder - would use embedding model)
   */
  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    // Placeholder - in production, use @xenova/transformers or OpenAI embeddings
    return null;
  }

  /**
   * Set embeddings for documents
   */
  setEmbeddings(embeddings: Map<string, number[]>): void {
    this.embeddings = embeddings;
  }

  /**
   * Cosine similarity
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
}

