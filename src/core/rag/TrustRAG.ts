/**
 * Trustworthy RAG (TrustRAG)
 * RAG with confidence scoring and validation before answering
 */

import { logger } from '../observability/logger';

export interface TrustConfig {
    minConfidence: number;
    minSources: number;
    enableWebFallback: boolean;
    validateSources: boolean;
    maxRetries: number;
}

export interface RetrievalResult {
    content: string;
    source: string;
    score: number;
    metadata?: Record<string, any>;
}

export interface TrustScore {
    overall: number;
    sourceQuality: number;
    consistency: number;
    recency: number;
    relevance: number;
}

export interface TrustRAGResult {
    answer: string;
    confidence: number;
    trustScore: TrustScore;
    sources: RetrievalResult[];
    warnings: string[];
    fallbackUsed: boolean;
}

export class TrustRAG {
    private config: TrustConfig;
    private retriever: any;
    private llmHandler: (prompt: string) => Promise<string>;
    private webSearcher?: (query: string) => Promise<RetrievalResult[]>;

    constructor(
        retriever: any,
        llmHandler: (prompt: string) => Promise<string>,
        webSearcher?: (query: string) => Promise<RetrievalResult[]>,
        config?: Partial<TrustConfig>
    ) {
        this.retriever = retriever;
        this.llmHandler = llmHandler;
        this.webSearcher = webSearcher;
        this.config = {
            minConfidence: 0.7,
            minSources: 2,
            enableWebFallback: true,
            validateSources: true,
            maxRetries: 2,
            ...config
        };
    }

    /**
     * Query with trust validation
     */
    async query(question: string): Promise<TrustRAGResult> {
        logger.info('TrustRAG query', { question: question.substring(0, 100) });

        // Initial retrieval
        let sources = await this.retrieve(question);
        let fallbackUsed = false;
        const warnings: string[] = [];

        // Calculate initial trust score
        let trustScore = this.calculateTrustScore(sources, question);

        // If insufficient, try web fallback
        if (trustScore.overall < this.config.minConfidence && this.config.enableWebFallback) {
            logger.info('Low confidence, attempting web fallback');

            const webSources = await this.webFallback(question);
            if (webSources.length > 0) {
                sources = [...sources, ...webSources];
                fallbackUsed = true;
                trustScore = this.calculateTrustScore(sources, question);
            }
        }

        // Validate sources if enabled
        if (this.config.validateSources) {
            const validation = await this.validateSources(sources, question);
            if (validation.invalidCount > 0) {
                warnings.push(`${validation.invalidCount} sources failed validation`);
                sources = sources.filter((_, i) => validation.valid[i]);
                trustScore = this.calculateTrustScore(sources, question);
            }
        }

        // Generate answer with confidence context
        const answer = await this.generateAnswer(question, sources, trustScore);

        // Final confidence check
        if (trustScore.overall < this.config.minConfidence) {
            warnings.push('Answer may be unreliable due to low source confidence');
        }

        if (sources.length < this.config.minSources) {
            warnings.push(`Only ${sources.length} sources found (recommended: ${this.config.minSources}+)`);
        }

        return {
            answer,
            confidence: trustScore.overall,
            trustScore,
            sources,
            warnings,
            fallbackUsed
        };
    }

    /**
     * Retrieve relevant documents
     */
    private async retrieve(query: string): Promise<RetrievalResult[]> {
        try {
            const results = await this.retriever.search(query, { limit: 10 });
            return results.map((r: any) => ({
                content: r.content || r.text || '',
                source: r.source || r.metadata?.source || 'unknown',
                score: r.score || 0.5,
                metadata: r.metadata
            }));
        } catch (error) {
            logger.error('Retrieval failed', { error });
            return [];
        }
    }

    /**
     * Web search fallback
     */
    private async webFallback(query: string): Promise<RetrievalResult[]> {
        if (!this.webSearcher) return [];

        try {
            return await this.webSearcher(query);
        } catch (error) {
            logger.warn('Web fallback failed', { error });
            return [];
        }
    }

    /**
     * Calculate trust score for sources
     */
    private calculateTrustScore(sources: RetrievalResult[], query: string): TrustScore {
        if (sources.length === 0) {
            return { overall: 0, sourceQuality: 0, consistency: 0, recency: 0, relevance: 0 };
        }

        // Source quality: average retrieval score
        const sourceQuality = sources.reduce((sum, s) => sum + s.score, 0) / sources.length;

        // Consistency: how much sources agree
        const consistency = this.calculateConsistency(sources);

        // Recency: based on metadata if available
        const recency = this.calculateRecency(sources);

        // Relevance: keyword overlap with query
        const relevance = this.calculateRelevance(sources, query);

        // Overall weighted score
        const overall = (
            sourceQuality * 0.3 +
            consistency * 0.25 +
            recency * 0.15 +
            relevance * 0.3
        );

        return { overall, sourceQuality, consistency, recency, relevance };
    }

    /**
     * Calculate consistency between sources
     */
    private calculateConsistency(sources: RetrievalResult[]): number {
        if (sources.length < 2) return 0.7; // Single source gets moderate consistency

        // Simple keyword overlap between sources
        const allWords: Set<string>[] = sources.map(s =>
            new Set(s.content.toLowerCase().split(/\s+/).filter(w => w.length > 3))
        );

        let totalOverlap = 0;
        let comparisons = 0;

        for (let i = 0; i < allWords.length; i++) {
            for (let j = i + 1; j < allWords.length; j++) {
                const intersection = new Set([...allWords[i]].filter(w => allWords[j].has(w)));
                const union = new Set([...allWords[i], ...allWords[j]]);
                totalOverlap += intersection.size / union.size;
                comparisons++;
            }
        }

        return comparisons > 0 ? totalOverlap / comparisons : 0.5;
    }

    /**
     * Calculate recency score
     */
    private calculateRecency(sources: RetrievalResult[]): number {
        const now = Date.now();
        let totalScore = 0;
        let count = 0;

        for (const source of sources) {
            const date = source.metadata?.date || source.metadata?.created_at;
            if (date) {
                const age = now - new Date(date).getTime();
                const daysOld = age / (1000 * 60 * 60 * 24);

                // Score decreases with age (1.0 for today, 0.5 for 1 year old)
                const score = Math.exp(-daysOld / 365);
                totalScore += score;
                count++;
            }
        }

        return count > 0 ? totalScore / count : 0.7; // Default to 0.7 if no dates
    }

    /**
     * Calculate relevance to query
     */
    private calculateRelevance(sources: RetrievalResult[], query: string): number {
        const queryWords = new Set(
            query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        );

        let totalRelevance = 0;

        for (const source of sources) {
            const contentWords = new Set(
                source.content.toLowerCase().split(/\s+/)
            );

            let matches = 0;
            for (const word of queryWords) {
                if (contentWords.has(word)) matches++;
            }

            totalRelevance += matches / queryWords.size;
        }

        return sources.length > 0 ? totalRelevance / sources.length : 0;
    }

    /**
     * Validate sources for accuracy
     */
    private async validateSources(
        sources: RetrievalResult[],
        query: string
    ): Promise<{ valid: boolean[]; invalidCount: number }> {
        const valid: boolean[] = new Array(sources.length).fill(true);
        let invalidCount = 0;

        // Use LLM to check if sources are relevant and factual
        const prompt = `Analyze these sources for a question and identify any that are:
1. Irrelevant to the question
2. Potentially outdated
3. From unreliable sources

Question: ${query}

Sources:
${sources.map((s, i) => `[${i + 1}] ${s.source}: ${s.content.substring(0, 200)}...`).join('\n')}

List any source numbers that should be excluded (or "none" if all are valid):`;

        try {
            const response = await this.llmHandler(prompt);

            // Parse response for invalid source numbers
            const matches = response.match(/\d+/g);
            if (matches) {
                for (const match of matches) {
                    const index = parseInt(match) - 1;
                    if (index >= 0 && index < valid.length) {
                        valid[index] = false;
                        invalidCount++;
                    }
                }
            }
        } catch (error) {
            logger.warn('Source validation failed', { error });
        }

        return { valid, invalidCount };
    }

    /**
     * Generate answer with trust context
     */
    private async generateAnswer(
        question: string,
        sources: RetrievalResult[],
        trustScore: TrustScore
    ): Promise<string> {
        if (sources.length === 0) {
            return "I don't have enough reliable information to answer this question.";
        }

        const confidenceNote = trustScore.overall < this.config.minConfidence
            ? '\n\nNote: Express appropriate uncertainty in your answer.'
            : '';

        const context = sources
            .slice(0, 5)
            .map((s, i) => `[${i + 1}] ${s.content}`)
            .join('\n\n');

        const prompt = `Based on the following sources, answer the question accurately.

Question: ${question}

Sources:
${context}

Cite sources using [1], [2], etc. when making claims.${confidenceNote}`;

        return await this.llmHandler(prompt);
    }

    /**
     * Get explanation of trust score
     */
    explainTrustScore(trustScore: TrustScore): string {
        const parts: string[] = [];

        parts.push(`Overall Confidence: ${(trustScore.overall * 100).toFixed(0)}%`);

        if (trustScore.sourceQuality > 0.7) {
            parts.push('✓ High-quality sources retrieved');
        } else if (trustScore.sourceQuality < 0.5) {
            parts.push('⚠ Source quality is low');
        }

        if (trustScore.consistency > 0.7) {
            parts.push('✓ Sources are consistent');
        } else if (trustScore.consistency < 0.5) {
            parts.push('⚠ Sources show conflicting information');
        }

        if (trustScore.relevance > 0.7) {
            parts.push('✓ Sources are highly relevant');
        } else if (trustScore.relevance < 0.5) {
            parts.push('⚠ Sources may not be directly relevant');
        }

        return parts.join('\n');
    }
}
