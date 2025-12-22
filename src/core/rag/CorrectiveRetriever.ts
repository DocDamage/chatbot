/**
 * Corrective RAG - Self-correcting retrieval augmented generation
 * Implements CRAG pattern for improved accuracy through query rewriting
 * Reference: arxiv.org/abs/2401.15884
 */

import { logger } from '../observability/logger';
import { HybridRetriever } from './HybridRetriever';
import { ReRanker } from './ReRanker';

export interface CRAGDocument {
    id: string;
    content: string;
    score: number;
    source?: string;
    metadata?: Record<string, any>;
}

export interface CRAGResult {
    documents: CRAGDocument[];
    confidence: number;
    corrections: string[];
    iterations: number;
    originalQuery: string;
    finalQuery: string;
}

export interface CRAGConfig {
    confidenceThreshold: number;
    maxIterations: number;
    minDocuments: number;
    enableWebSearch: boolean;
}

const DEFAULT_CONFIG: CRAGConfig = {
    confidenceThreshold: 0.7,
    maxIterations: 3,
    minDocuments: 3,
    enableWebSearch: true
};

export class CorrectiveRetriever {
    private retriever: HybridRetriever | null = null;
    private reranker: ReRanker | null = null;
    private config: CRAGConfig;
    private llmAdapter: any = null; // Will be injected

    constructor(config: Partial<CRAGConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Set the hybrid retriever instance
     */
    setRetriever(retriever: HybridRetriever): void {
        this.retriever = retriever;
    }

    /**
     * Set the reranker instance
     */
    setReRanker(reranker: ReRanker): void {
        this.reranker = reranker;
    }

    /**
     * Set the LLM adapter for query rewriting
     */
    setLLMAdapter(adapter: any): void {
        this.llmAdapter = adapter;
    }

    /**
     * Main CRAG retrieval method
     */
    async retrieve(query: string, topK: number = 5): Promise<CRAGResult> {
        const corrections: string[] = [];
        let currentQuery = query;
        let iteration = 0;
        let bestResult: CRAGResult | null = null;

        logger.info('Starting CRAG retrieval', { query: query.substring(0, 50), topK });

        while (iteration < this.config.maxIterations) {
            iteration++;

            // Step 1: Retrieve documents
            const documents = await this.retrieveDocuments(currentQuery, topK * 2);

            // Step 2: Grade document relevance
            const gradedDocs = await this.gradeRelevance(documents, currentQuery);

            // Step 3: Calculate confidence
            const confidence = this.calculateConfidence(gradedDocs, currentQuery);

            const result: CRAGResult = {
                documents: gradedDocs.slice(0, topK),
                confidence,
                corrections: [...corrections],
                iterations: iteration,
                originalQuery: query,
                finalQuery: currentQuery
            };

            // Track best result
            if (!bestResult || confidence > bestResult.confidence) {
                bestResult = result;
            }

            logger.info('CRAG iteration complete', {
                iteration,
                confidence,
                documentCount: gradedDocs.length
            });

            // Step 4: Check if confident enough
            if (confidence >= this.config.confidenceThreshold) {
                return result;
            }

            // Step 5: Determine correction strategy
            const strategy = this.determineStrategy(gradedDocs, confidence);

            if (strategy === 'accept') {
                return result;
            }

            if (strategy === 'rewrite') {
                // Rewrite query and retry
                const rewritten = await this.rewriteQuery(currentQuery, gradedDocs);
                if (rewritten && rewritten !== currentQuery) {
                    corrections.push(`Rewrote: "${currentQuery}" → "${rewritten}"`);
                    currentQuery = rewritten;
                } else {
                    // Can't improve, return best result
                    return bestResult;
                }
            }

            if (strategy === 'web_search' && this.config.enableWebSearch) {
                // Augment with web search
                corrections.push('Augmented with web search');
                const webDocs = await this.webSearch(currentQuery);
                if (webDocs.length > 0) {
                    gradedDocs.push(...webDocs);
                    bestResult = {
                        documents: gradedDocs.slice(0, topK),
                        confidence: this.calculateConfidence(gradedDocs, currentQuery),
                        corrections: [...corrections],
                        iterations: iteration,
                        originalQuery: query,
                        finalQuery: currentQuery
                    };
                }
                return bestResult;
            }
        }

        return bestResult || {
            documents: [],
            confidence: 0,
            corrections,
            iterations: iteration,
            originalQuery: query,
            finalQuery: currentQuery
        };
    }

    /**
     * Retrieve documents using hybrid retriever
     */
    private async retrieveDocuments(query: string, k: number): Promise<CRAGDocument[]> {
        if (!this.retriever) {
            logger.warn('No retriever configured for CRAG');
            return [];
        }

        try {
            const results = await this.retriever.retrieve(query, {
                maxResults: k,
                hybridWeight: 0.6
            });

            return results.map((r: any, i: number) => ({
                id: r.id || `doc-${i}`,
                content: r.content || r.text || '',
                score: r.score || 0,
                source: r.source || r.metadata?.source,
                metadata: r.metadata
            }));
        } catch (error: any) {
            logger.error('Document retrieval failed', { error: error.message });
            return [];
        }
    }

    /**
     * Grade document relevance to query
     */
    private async gradeRelevance(
        documents: CRAGDocument[],
        query: string
    ): Promise<CRAGDocument[]> {
        if (documents.length === 0) {
            return [];
        }

        // Use reranker if available
        if (this.reranker) {
            try {
                const reranked = await this.reranker.rerank(
                    query,
                    documents.map(d => ({ text: d.content, metadata: d.metadata }))
                );

                return reranked.map((r: any, i: number) => ({
                    ...documents[i],
                    score: r.score
                })).sort((a, b) => b.score - a.score);
            } catch (error: any) {
                logger.warn('Reranking failed', { error: error.message });
            }
        }

        // Fallback: simple keyword-based grading
        return documents.map(doc => ({
            ...doc,
            score: this.simpleRelevanceScore(doc.content, query)
        })).sort((a, b) => b.score - a.score);
    }

    /**
     * Simple relevance scoring based on keyword overlap
     */
    private simpleRelevanceScore(content: string, query: string): number {
        const contentLower = content.toLowerCase();
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        if (queryWords.length === 0) return 0;

        let matches = 0;
        for (const word of queryWords) {
            if (contentLower.includes(word)) {
                matches++;
            }
        }

        // Base score from keyword matching
        const keywordScore = matches / queryWords.length;

        // Bonus for exact phrase match
        const phraseBonus = contentLower.includes(query.toLowerCase()) ? 0.2 : 0;

        // Penalty for very short content
        const lengthPenalty = content.length < 50 ? -0.2 : 0;

        return Math.max(0, Math.min(1, keywordScore + phraseBonus + lengthPenalty));
    }

    /**
     * Calculate overall confidence in retrieval results
     */
    private calculateConfidence(documents: CRAGDocument[], query: string): number {
        if (documents.length === 0) {
            return 0;
        }

        // Factor 1: Average relevance score of top documents
        const topDocs = documents.slice(0, this.config.minDocuments);
        const avgScore = topDocs.reduce((sum, d) => sum + d.score, 0) / topDocs.length;

        // Factor 2: Score consistency (lower variance = higher confidence)
        const scores = topDocs.map(d => d.score);
        const variance = this.calculateVariance(scores);
        const consistencyScore = Math.max(0, 1 - variance * 2);

        // Factor 3: Document count
        const countScore = Math.min(1, documents.length / this.config.minDocuments);

        // Factor 4: Score gap between top 1 and rest (clear winner = higher confidence)
        const scoreGap = documents.length > 1
            ? documents[0].score - documents[1].score
            : 0.3;
        const clarityScore = Math.min(1, scoreGap * 2 + 0.5);

        // Weighted combination
        const confidence = (
            avgScore * 0.4 +
            consistencyScore * 0.2 +
            countScore * 0.2 +
            clarityScore * 0.2
        );

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Calculate variance of an array of numbers
     */
    private calculateVariance(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    }

    /**
     * Determine correction strategy based on results
     */
    private determineStrategy(
        documents: CRAGDocument[],
        confidence: number
    ): 'accept' | 'rewrite' | 'web_search' {
        // No documents at all - try web search
        if (documents.length === 0) {
            return this.config.enableWebSearch ? 'web_search' : 'accept';
        }

        // Very low confidence - try web search
        if (confidence < 0.3) {
            return this.config.enableWebSearch ? 'web_search' : 'rewrite';
        }

        // Medium confidence - try query rewriting
        if (confidence < this.config.confidenceThreshold) {
            return 'rewrite';
        }

        return 'accept';
    }

    /**
     * Rewrite query for better retrieval
     */
    private async rewriteQuery(
        query: string,
        documents: CRAGDocument[]
    ): Promise<string> {
        if (!this.llmAdapter) {
            // Fallback: expand with synonyms/related terms
            return this.expandQuerySimple(query);
        }

        try {
            const prompt = `Given the search query and some retrieved documents that may not be relevant enough, 
rewrite the query to be more specific and likely to retrieve better results.

Original query: "${query}"

Sample of retrieved content:
${documents.slice(0, 3).map(d => `- ${d.content.substring(0, 100)}...`).join('\n')}

Provide ONLY the rewritten query, nothing else:`;

            const response = await this.llmAdapter.process({
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 100,
                temperature: 0.3
            });

            const rewritten = response.content?.trim();

            if (rewritten && rewritten.length > 5 && rewritten.length < 500) {
                return rewritten;
            }
        } catch (error: any) {
            logger.warn('LLM query rewriting failed', { error: error.message });
        }

        return this.expandQuerySimple(query);
    }

    /**
     * Simple query expansion without LLM
     */
    private expandQuerySimple(query: string): string {
        // Add common query expansions
        const expansions: Record<string, string[]> = {
            'how': ['guide', 'tutorial', 'steps'],
            'what': ['definition', 'meaning', 'explanation'],
            'why': ['reason', 'cause', 'purpose'],
            'when': ['date', 'time', 'timeline'],
            'best': ['top', 'recommended', 'popular']
        };

        const words = query.toLowerCase().split(/\s+/);

        for (const [key, additions] of Object.entries(expansions)) {
            if (words.includes(key)) {
                return `${query} ${additions[0]}`;
            }
        }

        return query;
    }

    /**
     * Web search fallback
     */
    private async webSearch(query: string): Promise<CRAGDocument[]> {
        try {
            const { WebSearcher } = await import('../tools/WebSearcher');
            const searcher = WebSearcher.fromEnv();
            const result = await searcher.search(query, 5);

            if (result.success && result.data?.results) {
                return result.data.results.map((r: any, i: number) => ({
                    id: `web-${i}`,
                    content: `${r.title}\n${r.snippet}`,
                    score: 0.7 - i * 0.1, // Decreasing score by rank
                    source: r.url,
                    metadata: { type: 'web_search', url: r.url }
                }));
            }
        } catch (error: any) {
            logger.warn('Web search fallback failed', { error: error.message });
        }

        return [];
    }

    /**
     * Check if documents need correction
     */
    async needsCorrection(
        documents: CRAGDocument[],
        query: string
    ): Promise<boolean> {
        const confidence = this.calculateConfidence(documents, query);
        return confidence < this.config.confidenceThreshold;
    }

    /**
     * Get retrieval statistics
     */
    getStats(): { configuredThreshold: number; minDocs: number; maxIter: number } {
        return {
            configuredThreshold: this.config.confidenceThreshold,
            minDocs: this.config.minDocuments,
            maxIter: this.config.maxIterations
        };
    }
}

export default CorrectiveRetriever;
