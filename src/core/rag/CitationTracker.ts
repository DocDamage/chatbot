/**
 * Citation Tracker - Link responses to source documents
 * Research: Latest RAG papers on citation tracking
 */

import { DocumentChunk, Citation } from '../../types/rag';
import { logger } from '../observability/logger';

export class CitationTracker {
  /**
   * Extract citations from response text
   */
  extractCitations(response: string, chunks: DocumentChunk[]): Citation[] {
    const citations: Citation[] = [];
    const responseLower = response.toLowerCase();

    for (const chunk of chunks) {
      // Check if chunk content appears in response
      const relevance = this.calculateRelevance(response, chunk);
      
      if (relevance > 0.1) { // Threshold for citation
        citations.push({
          chunkId: chunk.id,
          source: chunk.metadata.source || 'Unknown',
          content: this.extractRelevantSnippet(chunk.content, response),
          relevance,
          metadata: {
            ...chunk.metadata,
            title: chunk.metadata.title,
            date: chunk.metadata.date
          }
        });
      }
    }

    // Sort by relevance
    citations.sort((a, b) => b.relevance - a.relevance);

    logger.debug('Citations extracted', {
      responseLength: response.length,
      citationsCount: citations.length
    });

    return citations;
  }

  /**
   * Calculate relevance between response and chunk
   */
  private calculateRelevance(response: string, chunk: DocumentChunk): number {
    const responseWords = new Set(
      response.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    const chunkWords = new Set(
      chunk.content.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    const intersection = new Set([...responseWords].filter(x => chunkWords.has(x)));
    const union = new Set([...responseWords, ...chunkWords]);

    if (union.size === 0) return 0;

    // Jaccard similarity
    const jaccard = intersection.size / union.size;

    // Boost if chunk metadata matches
    let metadataBoost = 0;
    if (chunk.metadata.title && response.toLowerCase().includes(chunk.metadata.title.toLowerCase())) {
      metadataBoost += 0.2;
    }

    return Math.min(1.0, jaccard + metadataBoost);
  }

  /**
   * Extract relevant snippet from chunk
   */
  private extractRelevantSnippet(chunkContent: string, response: string): string {
    // Find the most relevant sentence
    const sentences = chunkContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const responseWords = new Set(response.toLowerCase().split(/\s+/));

    let bestSentence = sentences[0] || chunkContent.substring(0, 200);
    let bestScore = 0;

    for (const sentence of sentences) {
      const sentenceWords = new Set(sentence.toLowerCase().split(/\s+/));
      const intersection = new Set([...responseWords].filter(x => sentenceWords.has(x)));
      const score = intersection.size / Math.max(responseWords.size, sentenceWords.size);

      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence.trim();
      }
    }

    // Limit length
    if (bestSentence.length > 300) {
      bestSentence = bestSentence.substring(0, 297) + '...';
    }

    return bestSentence;
  }

  /**
   * Format citations for display
   */
  formatCitations(citations: Citation[]): string {
    if (citations.length === 0) return '';

    const formatted = citations.map((citation, index) => {
      const source = citation.metadata.title || citation.source;
      return `[${index + 1}] ${source}${citation.metadata.date ? ` (${citation.metadata.date})` : ''}`;
    }).join('\n');

    return `\n\nSources:\n${formatted}`;
  }
}

