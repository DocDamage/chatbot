/**
 * RAG Service - Main service that orchestrates all RAG components
 * Research: Latest RAG papers, Stanford CS224N, MIT NLP Group
 */

import { HybridRetriever } from './HybridRetriever';
import { ReRanker } from './ReRanker';
import { QueryExpander } from './QueryExpander';
import { ContextCompressor } from './ContextCompressor';
import { CitationTracker } from './CitationTracker';
import { DocumentChunk, Citation } from '../../types/rag';
import { LLMAdapter } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export interface RAGResult {
  response: string;
  citations: Citation[];
  retrievedChunks: DocumentChunk[];
  compressedContext: string;
  metadata: {
    retrievalMethod: string;
    compressionRatio: number;
    numChunksRetrieved: number;
  };
}

export class RAGService {
  private retriever: HybridRetriever;
  private reranker: ReRanker;
  private queryExpander: QueryExpander;
  private contextCompressor: ContextCompressor;
  private citationTracker: CitationTracker;
  private llmAdapter: LLMAdapter;

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
    this.retriever = new HybridRetriever();
    this.reranker = new ReRanker();
    this.queryExpander = new QueryExpander(llmAdapter);
    this.contextCompressor = new ContextCompressor(llmAdapter);
    this.citationTracker = new CitationTracker();
  }

  /**
   * Process a query through the full RAG pipeline
   */
  async processQuery(
    query: string,
    generateResponse: boolean = true
  ): Promise<RAGResult> {
    logger.info('RAG query processing started', { query: query.substring(0, 100) });

    // 1. Query expansion
    const expansion = await this.queryExpander.expandQuery(query);
    logger.debug('Query expanded', {
      original: expansion.originalQuery,
      expansions: expansion.expandedQueries.length
    });

    // 2. Hybrid retrieval (use expanded queries)
    const allResults: Array<{ chunk: DocumentChunk; score: number; retrievalMethod: string }> = [];
    
    for (const expandedQuery of expansion.expandedQueries) {
      const results = await this.retriever.retrieve(expandedQuery, 10);
      allResults.push(...results.map(r => ({
        chunk: r.chunk,
        score: r.score,
        retrievalMethod: r.retrievalMethod
      })));
    }

    // Deduplicate and merge scores
    const chunkMap = new Map<string, { chunk: DocumentChunk; score: number; methods: Set<string> }>();
    for (const result of allResults) {
      const existing = chunkMap.get(result.chunk.id);
      if (existing) {
        existing.score = Math.max(existing.score, result.score);
        existing.methods.add(result.retrievalMethod);
      } else {
        chunkMap.set(result.chunk.id, {
          chunk: result.chunk,
          score: result.score,
          methods: new Set([result.retrievalMethod])
        });
      }
    }

    const retrievedChunks = Array.from(chunkMap.values())
      .map(v => ({ chunk: v.chunk, score: v.score, retrievalMethod: Array.from(v.methods).join('+') }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    logger.debug('Retrieval completed', {
      chunksRetrieved: retrievedChunks.length,
      topScore: retrievedChunks[0]?.score
    });

    // 3. Re-ranking
    const reranked = await this.reranker.rerank(
      query,
      retrievedChunks.map(r => ({
        chunk: r.chunk,
        score: r.score,
        retrievalMethod: r.retrievalMethod as any
      })),
      5
    );

    logger.debug('Re-ranking completed', {
      rerankedCount: reranked.length
    });

    // 4. Context compression
    const compressed = await this.contextCompressor.compress(
      reranked.map(r => r.chunk),
      query
    );

    logger.debug('Context compression completed', {
      compressionRatio: compressed.compressionRatio.toFixed(2)
    });

    // 5. Generate response (if requested)
    let response = '';
    if (generateResponse) {
      const prompt = `Based on the following context, answer the question. If the context doesn't contain enough information, say so.

Context:
${compressed.compressedContent}

Question: ${query}

Answer:`;

      const llmResponse = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a helpful assistant that answers questions based on provided context. Always cite sources when possible.',
        maxTokens: 1000,
        temperature: 0.7
      });

      response = llmResponse.content;
    } else {
      response = compressed.compressedContent;
    }

    // 6. Extract citations
    const citations = this.citationTracker.extractCitations(response, reranked.map(r => r.chunk));

    logger.info('RAG query processing completed', {
      responseLength: response.length,
      citationsCount: citations.length
    });

    return {
      response,
      citations,
      retrievedChunks: reranked.map(r => r.chunk),
      compressedContext: compressed.compressedContent,
      metadata: {
        retrievalMethod: 'hybrid',
        compressionRatio: compressed.compressionRatio,
        numChunksRetrieved: retrievedChunks.length
      }
    };
  }

  /**
   * Add documents to knowledge base
   */
  addDocuments(chunks: DocumentChunk[]): void {
    this.retriever.addDocuments(chunks);
    logger.info('Documents added to RAG knowledge base', { count: chunks.length });
  }

  /**
   * Get retriever (for direct access if needed)
   */
  getRetriever(): HybridRetriever {
    return this.retriever;
  }
}

