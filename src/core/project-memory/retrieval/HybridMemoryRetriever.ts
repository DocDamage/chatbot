/**
 * Hybrid Memory Retriever & Context Formatter (PX-05 / PX05-T04 & PX05-T06)
 *
 * Multi-signal retrieval engine combining:
 * - Exact category and tag filtering
 * - Lexical BM25 / keyword scoring
 * - Branch and workspace scoping
 * - Freshness and confidence weighting
 * - Output formatting with explicit citations and confidence scores
 */

import { ProjectMemoryStore, MemoryQueryFilter } from '../capture/ProjectMemoryStore';
import { ProjectMemoryRecord } from '../capture/ProjectMemorySchema';

export interface ScoredMemoryResult {
  memory: ProjectMemoryRecord;
  score: number;
  matchReasons: string[];
}

export class HybridMemoryRetriever {
  constructor(private readonly store: ProjectMemoryStore) {}

  /**
   * Retrieve and rank project memories matching query and context signals.
   */
  public searchMemories(
    queryText: string,
    filter: MemoryQueryFilter,
    requester: { userId: string; projectId?: string; isAdmin?: boolean }
  ): ScoredMemoryResult[] {
    const candidates = this.store.query(filter, requester);
    const queryTokens = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const scoredResults: ScoredMemoryResult[] = [];

    for (const mem of candidates) {
      let score = mem.confidence;
      const matchReasons: string[] = [];

      // 1. Freshness weighting
      if (mem.freshnessState === 'current') {
        score *= 1.2;
        matchReasons.push('Current freshness (+20%)');
      } else if (mem.freshnessState === 'possibly_stale') {
        score *= 0.8;
        matchReasons.push('Possibly stale (-20%)');
      } else if (mem.freshnessState === 'stale') {
        score *= 0.5;
        matchReasons.push('Stale state (-50%)');
      }

      // 2. Keyword matching in title and content
      const titleLower = mem.title.toLowerCase();
      const contentLower = mem.content.toLowerCase();
      let matchedTokens = 0;

      for (const token of queryTokens) {
        if (titleLower.includes(token)) {
          score += 0.5;
          matchedTokens++;
        } else if (contentLower.includes(token)) {
          score += 0.2;
          matchedTokens++;
        }
      }

      if (matchedTokens > 0) {
        matchReasons.push(`Matched ${matchedTokens} query keywords`);
      }

      // 3. Tag matching
      if (filter.tags && filter.tags.some(t => mem.tags.includes(t))) {
        score += 0.3;
        matchReasons.push('Tag match (+0.3)');
      }

      // 4. Protection bonus
      if (mem.isProtected) {
        score += 0.2;
        matchReasons.push('Protected decision (+0.2)');
      }

      scoredResults.push({
        memory: mem,
        score,
        matchReasons
      });
    }

    scoredResults.sort((a, b) => b.score - a.score);

    if (filter.limit && filter.limit > 0) {
      return scoredResults.slice(0, filter.limit);
    }

    return scoredResults;
  }

  /**
   * Format retrieved memories into context markdown for model consumption.
   */
  public formatAsContext(results: ScoredMemoryResult[], maxTokens = 2000): string {
    if (results.length === 0) {
      return 'No relevant project memory records found.';
    }

    const lines: string[] = ['### Project Memory Context\n'];

    for (const res of results) {
      const mem = res.memory;
      lines.push(`- **[${mem.kind.toUpperCase()}] ${mem.title}** (Confidence: ${(mem.confidence * 100).toFixed(0)}%, State: ${mem.freshnessState})`);
      lines.push(`  ${mem.content}`);
      if (mem.evidence.length > 0 && mem.evidence[0].filePath) {
        lines.push(`  *Source Anchor: \`${mem.evidence[0].filePath}\`*`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
