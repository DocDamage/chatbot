/**
 * Query Expander - Multi-query generation for better retrieval
 * Research: Latest RAG papers on query expansion
 */

import { QueryExpansion } from '../../types/rag';
import { logger } from '../observability/logger';
import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';

export class QueryExpander {
  private llmAdapter?: LLMAdapter;

  constructor(llmAdapter?: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Expand a query into multiple related queries
   */
  async expandQuery(originalQuery: string, numExpansions: number = 3): Promise<QueryExpansion> {
    if (!this.llmAdapter) {
      // Fallback to simple expansion
      return this.simpleExpand(originalQuery);
    }

    try {
      const prompt = `Given the following query, generate ${numExpansions} alternative phrasings or related queries that would help retrieve relevant information. Each query should be a complete question or statement.

Original query: "${originalQuery}"

Generate ${numExpansions} alternative queries, one per line:`;

      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a helpful assistant that generates query variations for information retrieval.',
        maxTokens: 200,
        temperature: 0.7
      });

      const expandedQueries = response.content
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.match(/^\d+\./)) // Remove numbering
        .slice(0, numExpansions);

      return {
        originalQuery,
        expandedQueries: expandedQueries.length > 0 ? expandedQueries : [originalQuery],
        reasoning: `Generated ${expandedQueries.length} query variations using LLM`
      };
    } catch (error: any) {
      logger.warn('Query expansion failed, using simple expansion', { error: error.message });
      return this.simpleExpand(originalQuery);
    }
  }

  /**
   * Simple query expansion (fallback)
   */
  private simpleExpand(originalQuery: string): QueryExpansion {
    const expansions: string[] = [originalQuery];

    // Add question form if not already a question
    if (!originalQuery.includes('?')) {
      expansions.push(`${originalQuery}?`);
    }

    // Add "what is" form
    if (!originalQuery.toLowerCase().startsWith('what is')) {
      expansions.push(`What is ${originalQuery}?`);
    }

    // Add "explain" form
    if (!originalQuery.toLowerCase().startsWith('explain')) {
      expansions.push(`Explain ${originalQuery}`);
    }

    return {
      originalQuery,
      expandedQueries: expansions.slice(0, 3),
      reasoning: 'Simple expansion using pattern matching'
    };
  }
}

