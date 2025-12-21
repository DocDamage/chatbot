/**
 * Knowledge Fusion - Combine knowledge from multiple sources
 */

import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import { LLMAdapter } from '../providers/LLMAdapter';

export interface FusionOptions {
  sources: KnowledgeSource[];
  query: string;
  maxResults?: number;
  minConfidence?: number;
  deduplicate?: boolean;
  summarize?: boolean;
}

export class KnowledgeFusion {
  private llmAdapter?: LLMAdapter;

  constructor(llmAdapter?: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Fuse knowledge from multiple sources
   */
  async fuse(options: FusionOptions): Promise<KnowledgeResult[]> {
    const { sources, query, maxResults = 10, minConfidence = 0.5, deduplicate = true, summarize = false } = options;

    logger.info('Fusing knowledge from multiple sources', {
      sources: sources.map(s => s.name),
      query,
    });

    // Query all sources in parallel
    const sourcePromises = sources.map(source =>
      source.search(query, { limit: maxResults }).catch((error: any) => {
        logger.warn('Source query failed', { source: source.name, error: error.message });
        return [];
      })
    );

    const allResults = await Promise.all(sourcePromises);
    const flattened = allResults.flat();

    // Filter by confidence
    let filtered = flattened.filter(r => (r.confidence || 0) >= minConfidence);

    // Deduplicate
    if (deduplicate) {
      filtered = this.deduplicate(filtered);
    }

    // Sort by confidence
    filtered.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    // Summarize if requested
    if (summarize && this.llmAdapter && filtered.length > 1) {
      const summary = await this.summarizeResults(query, filtered);
      if (summary) {
        filtered.unshift({
          id: 'fused_summary',
          title: 'Fused Summary',
          content: summary,
          source: 'knowledge_fusion',
          confidence: 0.9,
        });
      }
    }

    return filtered.slice(0, maxResults);
  }

  /**
   * Deduplicate results based on content similarity
   */
  private deduplicate(results: KnowledgeResult[]): KnowledgeResult[] {
    const seen = new Set<string>();
    const deduplicated: KnowledgeResult[] = [];

    for (const result of results) {
      // Create a signature from title and first 100 chars of content
      const signature = `${result.title}_${result.content.substring(0, 100)}`.toLowerCase();
      const normalized = signature.replace(/\s+/g, ' ').trim();

      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Summarize multiple results into one coherent answer
   */
  private async summarizeResults(query: string, results: KnowledgeResult[]): Promise<string | null> {
    if (!this.llmAdapter) return null;

    try {
      const context = results
        .slice(0, 5)
        .map((r, i) => `[Source ${i + 1}: ${r.source}]\n${r.title}\n${r.content.substring(0, 500)}`)
        .join('\n\n---\n\n');

      const prompt = `Based on the following information from multiple sources, provide a comprehensive answer to the question.

Question: ${query}

Sources:
${context}

Provide a well-structured answer that synthesizes information from all sources:`;

      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a knowledge synthesis system. Combine information from multiple sources into a coherent, accurate answer.',
        maxTokens: 1000,
        temperature: 0.5,
      });

      return response.content;
    } catch (error: any) {
      logger.warn('Failed to summarize results', { error: error.message });
      return null;
    }
  }

  /**
   * Validate and cross-reference results
   */
  async validateResults(results: KnowledgeResult[]): Promise<KnowledgeResult[]> {
    // Check for contradictions
    const validated: KnowledgeResult[] = [];

    for (const result of results) {
      // Simple validation: check if multiple sources agree
      const similarResults = results.filter(r =>
        r.id !== result.id &&
        this.isSimilar(r.content, result.content)
      );

      if (similarResults.length > 0) {
        // Multiple sources agree - increase confidence
        result.confidence = Math.min((result.confidence || 0.5) + 0.1, 1.0);
      }

      validated.push(result);
    }

    return validated;
  }

  /**
   * Check if two texts are similar
   */
  private isSimilar(text1: string, text2: string, threshold: number = 0.7): boolean {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 && intersection.size / union.size >= threshold;
  }
}

