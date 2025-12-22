/**
 * TOON Serializer - Token-Oriented Object Notation for LLM cost optimization
 * Reduces token usage by 21-40% for structured data sent to LLMs
 * Reference: https://github.com/toon-format/toon
 */

import { logger } from '../observability/logger';

// Dynamic import for toon format
let toon: any = null;
let toonLoaded = false;

async function loadToon(): Promise<boolean> {
    if (toon !== null) return toonLoaded;

    try {
        toon = require('@toon-format/toon');
        toonLoaded = true;
        logger.info('TOON format loaded successfully');
        return true;
    } catch (error) {
        logger.warn('TOON format not available - using JSON fallback');
        toonLoaded = false;
        return false;
    }
}

export interface TokenStats {
    originalTokens: number;
    optimizedTokens: number;
    savings: number;
    savingsPercent: number;
}

export interface SerializationResult {
    content: string;
    format: 'toon' | 'json';
    stats?: TokenStats;
}

/**
 * Estimate token count using GPT-style tokenization heuristic
 * More accurate than character count / 4
 */
function estimateTokens(text: string): number {
    // GPT tokenizer typically uses ~4 chars per token for English
    // But punctuation, numbers, and special chars count more
    const words = text.split(/\s+/).filter(w => w.length > 0);
    let tokens = 0;

    for (const word of words) {
        // Special characters and punctuation typically use more tokens
        const specialChars = (word.match(/[^a-zA-Z0-9]/g) || []).length;
        const normalChars = word.length - specialChars;

        tokens += Math.ceil(normalChars / 4) + specialChars;
    }

    // Account for whitespace tokens
    tokens += Math.floor(words.length / 2);

    return Math.max(tokens, 1);
}

export class ToonSerializer {
    private useEstimation: boolean;

    constructor(useEstimation: boolean = true) {
        this.useEstimation = useEstimation;
    }

    /**
     * Serialize data to TOON format for LLM consumption
     * Falls back to compact JSON if TOON is not available
     */
    async serialize(data: any): Promise<SerializationResult> {
        const jsonStr = JSON.stringify(data);
        const isLoaded = await loadToon();

        if (!isLoaded) {
            // Fallback to compact JSON
            return {
                content: jsonStr,
                format: 'json',
                stats: this.useEstimation ? {
                    originalTokens: estimateTokens(JSON.stringify(data, null, 2)),
                    optimizedTokens: estimateTokens(jsonStr),
                    savings: 0,
                    savingsPercent: 0
                } : undefined
            };
        }

        try {
            const toonStr = toon.stringify(data);
            const originalTokens = estimateTokens(JSON.stringify(data, null, 2));
            const optimizedTokens = estimateTokens(toonStr);
            const savings = originalTokens - optimizedTokens;
            const savingsPercent = originalTokens > 0
                ? Math.round((savings / originalTokens) * 100)
                : 0;

            logger.debug('TOON serialization complete', {
                originalTokens,
                optimizedTokens,
                savingsPercent: `${savingsPercent}%`
            });

            return {
                content: toonStr,
                format: 'toon',
                stats: {
                    originalTokens,
                    optimizedTokens,
                    savings,
                    savingsPercent
                }
            };
        } catch (error: any) {
            logger.warn('TOON serialization failed, using JSON fallback', { error: error.message });
            return {
                content: jsonStr,
                format: 'json'
            };
        }
    }

    /**
     * Deserialize TOON or JSON content back to object
     */
    async deserialize(content: string): Promise<any> {
        const isLoaded = await loadToon();

        // Try TOON first if available
        if (isLoaded) {
            try {
                return toon.parse(content);
            } catch (e) {
                // Fall through to JSON
            }
        }

        // Try JSON
        try {
            return JSON.parse(content);
        } catch (e) {
            throw new Error('Failed to deserialize content as TOON or JSON');
        }
    }

    /**
     * Optimize RAG context for LLM consumption
     */
    async optimizeContext(
        context: Array<{ content: string; score?: number; source?: string }>
    ): Promise<SerializationResult> {
        // Structure context for optimal TOON encoding
        const optimizedContext = context.map((item, index) => ({
            id: index + 1,
            text: item.content,
            score: item.score ? Math.round(item.score * 100) / 100 : undefined,
            src: item.source
        }));

        return this.serialize(optimizedContext);
    }

    /**
     * Optimize chat history for LLM consumption
     */
    async optimizeChatHistory(
        messages: Array<{ role: string; content: string; timestamp?: number }>
    ): Promise<SerializationResult> {
        // Use abbreviated role names
        const optimized = messages.map(m => ({
            r: m.role === 'assistant' ? 'a' : m.role === 'user' ? 'u' : 's',
            c: m.content,
            t: m.timestamp
        }));

        return this.serialize(optimized);
    }

    /**
     * Optimize tool results for LLM consumption
     */
    async optimizeToolResults(
        results: Array<{ tool: string; output: any; success: boolean }>
    ): Promise<SerializationResult> {
        const optimized = results.map(r => ({
            t: r.tool,
            ok: r.success,
            out: r.output
        }));

        return this.serialize(optimized);
    }

    /**
     * Optimize knowledge graph data
     */
    async optimizeKnowledgeGraph(
        nodes: Array<{ id: string; type: string; properties: Record<string, any> }>,
        edges: Array<{ from: string; to: string; relation: string }>
    ): Promise<SerializationResult> {
        return this.serialize({
            n: nodes.map(n => ({ i: n.id, t: n.type, p: n.properties })),
            e: edges.map(e => ({ f: e.from, t: e.to, r: e.relation }))
        });
    }

    /**
     * Get token savings estimate for a given data structure
     */
    async estimateSavings(data: any): Promise<TokenStats> {
        const result = await this.serialize(data);
        return result.stats || {
            originalTokens: 0,
            optimizedTokens: 0,
            savings: 0,
            savingsPercent: 0
        };
    }

    /**
     * Create optimized system prompt section
     */
    async optimizeSystemPromptData(
        contextData: Record<string, any>
    ): Promise<string> {
        const result = await this.serialize(contextData);

        if (result.format === 'toon') {
            return `<context format="toon">\n${result.content}\n</context>`;
        }
        return `<context format="json">\n${result.content}\n</context>`;
    }

    /**
     * Batch serialize multiple items
     */
    async serializeBatch(items: any[]): Promise<SerializationResult> {
        return this.serialize(items);
    }

    /**
     * Check if TOON is available
     */
    async isAvailable(): Promise<boolean> {
        return loadToon();
    }
}

// Singleton instance
let instance: ToonSerializer | null = null;

export function getToonSerializer(): ToonSerializer {
    if (!instance) {
        instance = new ToonSerializer();
    }
    return instance;
}

export default ToonSerializer;
