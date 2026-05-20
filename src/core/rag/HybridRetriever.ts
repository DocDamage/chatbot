/**
 * Hybrid Retriever - Combines BM25 + Dense Vector Search + Sparse Retrieval
 * Research: Latest RAG papers, Stanford CS224N, MIT NLP Group
 */

import { DocumentChunk, RetrievalResult } from '../../types/rag';
import { logger } from '../observability/logger';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { RAGDocumentStore } from './RAGDocumentStore';
import natural from 'natural';

export type RetrievalMode = 'memory' | 'database' | 'hybrid';

export class HybridRetriever {
  private documents: DocumentChunk[] = [];
  private bm25Index: natural.TfIdf | null = null;
  private embeddings: Map<string, number[]> = new Map();
  private tokenizer = new natural.WordTokenizer();
  private embeddingService?: EmbeddingService;
  private documentStore?: RAGDocumentStore;
  private retrievalMode: RetrievalMode;

  constructor(
    embeddingService?: EmbeddingService,
    documentStore?: RAGDocumentStore,
    retrievalMode: RetrievalMode = 'memory'
  ) {
    this.embeddingService = embeddingService;
    this.documentStore = documentStore;
    this.retrievalMode = documentStore ? retrievalMode : 'memory';
  }

  /**
   * Add documents to the knowledge base
   */
  addDocuments(chunks: DocumentChunk[]): void {
    const existingIds = new Set(this.documents.map(doc => doc.id));
    const newChunks = chunks.filter(chunk => !existingIds.has(chunk.id));

    this.documents.push(...newChunks);
    
    // Store embeddings if available
    for (const chunk of newChunks) {
      if (chunk.embedding) {
        this.embeddings.set(chunk.id, chunk.embedding);
      }
    }
    
    this.rebuildIndexes();
    logger.info(`Added ${newChunks.length} documents to knowledge base`, {
      totalDocuments: this.documents.length,
      withEmbeddings: newChunks.filter(c => c.embedding).length
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
    if (this.retrievalMode === 'database' && this.documentStore) {
      const queryEmbedding = await this.getQueryEmbedding(query);
      return this.documentStore.hybridSearch(query, queryEmbedding || undefined, topK);
    }

    if (this.retrievalMode === 'hybrid' && this.documentStore) {
      const [memoryResults, queryEmbedding] = await Promise.all([
        this.retrieveFromMemory(query, topK, weights),
        this.getQueryEmbedding(query)
      ]);
      const databaseResults = await this.documentStore.hybridSearch(query, queryEmbedding || undefined, topK);
      return this.mergeResults([...memoryResults, ...databaseResults], topK);
    }

    return this.retrieveFromMemory(query, topK, weights);
  }

  private async retrieveFromMemory(
    query: string,
    topK: number,
    weights: { bm25: number; dense: number; sparse: number }
  ): Promise<RetrievalResult[]> {
    const results: Map<string, RetrievalResult> = new Map();

    // PARALLELIZE all retrieval methods
    const [bm25Results, denseResults, sparseResults] = await Promise.all([
      this.retrieveBM25(query, topK * 2),
      this.retrieveDense(query, topK * 2),
      this.retrieveSparse(query, topK * 2)
    ]);

    // Merge BM25 results
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

    // Merge dense vector results
    for (const result of denseResults) {
      const existing = results.get(result.chunk.id);
      if (existing) {
        existing.score = existing.score + result.score * weights.dense;
        existing.retrievalMethod = existing.retrievalMethod.includes('dense') 
          ? existing.retrievalMethod 
          : `${existing.retrievalMethod}+dense`;
      } else {
        results.set(result.chunk.id, {
          ...result,
          score: result.score * weights.dense,
          retrievalMethod: 'dense'
        });
      }
    }

    // Merge sparse results
    for (const result of sparseResults) {
      const existing = results.get(result.chunk.id);
      if (existing) {
        existing.score = existing.score + result.score * weights.sparse;
        existing.retrievalMethod = existing.retrievalMethod.includes('sparse')
          ? existing.retrievalMethod
          : `${existing.retrievalMethod}+sparse`;
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

  private mergeResults(results: RetrievalResult[], topK: number): RetrievalResult[] {
    const merged = new Map<string, RetrievalResult>();

    for (const result of results) {
      const existing = merged.get(result.chunk.id);
      if (existing) {
        existing.score = Math.max(existing.score, result.score);
        const methods = new Set(`${existing.retrievalMethod}+${result.retrievalMethod}`.split('+'));
        existing.retrievalMethod = Array.from(methods).join('+');
      } else {
        merged.set(result.chunk.id, { ...result });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
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
        const idf = this.bm25Index.idf(token, false);
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
   * Dense vector retrieval (cosine similarity) - OPTIMIZED
   */
  private async retrieveDense(query: string, topK: number): Promise<RetrievalResult[]> {
    const queryEmbedding = await this.getQueryEmbedding(query);
    if (!queryEmbedding) {
      return [];
    }

    // Pre-compute query norm once
    const queryNorm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
    if (queryNorm === 0) return [];

    const scores: Array<{ chunk: DocumentChunk; score: number }> = [];

    // Optimize: filter documents with embeddings first, then compute similarity
    for (const doc of this.documents) {
      const docEmbedding = doc.embedding || this.embeddings.get(doc.id);
      if (docEmbedding) {
        // Optimized cosine similarity with pre-computed query norm
        const similarity = this.cosineSimilarityOptimized(queryEmbedding, docEmbedding, queryNorm);
        if (similarity > 0) { // Only add positive similarities
          scores.push({ chunk: doc, score: similarity });
        }
      }
    }

    // Use partial sort for better performance on large arrays
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
   * Get query embedding using embedding service
   */
  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    if (!this.embeddingService) {
      return null;
    }

    try {
      return await this.embeddingService.embed(query);
    } catch (error: any) {
      logger.warn('Query embedding failed', { error: error.message });
      return null;
    }
  }

  /**
   * Set embeddings for documents
   */
  setEmbeddings(embeddings: Map<string, number[]>): void {
    this.embeddings = embeddings;
  }

  /**
   * Cosine similarity - OPTIMIZED
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

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Optimized cosine similarity with pre-computed query norm
   */
  private cosineSimilarityOptimized(query: number[], doc: number[], queryNorm: number): number {
    if (query.length !== doc.length || queryNorm === 0) return 0;
    
    let dotProduct = 0;
    let docNorm = 0;

    for (let i = 0; i < query.length; i++) {
      dotProduct += query[i] * doc[i];
      docNorm += doc[i] * doc[i];
    }

    const docNormSqrt = Math.sqrt(docNorm);
    return docNormSqrt > 0 ? dotProduct / (queryNorm * docNormSqrt) : 0;
  }
}

