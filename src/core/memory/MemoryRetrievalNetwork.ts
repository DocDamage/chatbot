/**
 * Memory Retrieval Network - Neural retrieval of relevant memories
 * Research: MIT Memory Systems, Memory Networks
 */

import { MemoryEntry, EpisodicMemory } from '../../types/memory';
import { logger } from '../observability/logger';

export interface MemoryQuery {
  query: string;
  context?: string;
  memoryTypes?: string[];
  limit?: number;
}

export class MemoryRetrievalNetwork {
  private memories: Map<string, MemoryEntry[]> = new Map();

  /**
   * Index memories for retrieval
   */
  indexMemories(sessionId: string, memories: MemoryEntry[]): void {
    this.memories.set(sessionId, memories);
    logger.debug('Memories indexed', { sessionId, count: memories.length });
  }

  /**
   * Retrieve relevant memories using semantic similarity
   */
  retrieve(query: MemoryQuery): MemoryEntry[] {
    const sessionId = query.context || 'default';
    const allMemories = this.memories.get(sessionId) || [];

    // Filter by type if specified
    let filtered = allMemories;
    if (query.memoryTypes && query.memoryTypes.length > 0) {
      filtered = allMemories.filter(m => query.memoryTypes!.includes(m.type));
    }

    // Calculate relevance scores
    const scored = filtered.map(memory => ({
      memory,
      score: this.calculateRelevance(query.query, memory)
    }));

    // Sort by relevance and return top K
    const limit = query.limit || 10;
    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);

    logger.debug('Memory retrieval completed', {
      query: query.query.substring(0, 50),
      resultsCount: results.length
    });

    return results;
  }

  /**
   * Calculate relevance between query and memory
   */
  private calculateRelevance(query: string, memory: MemoryEntry): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const memoryWords = new Set(memory.content.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    // Jaccard similarity
    const intersection = new Set([...queryWords].filter(x => memoryWords.has(x)));
    const union = new Set([...queryWords, ...memoryWords]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    // Boost for episodic memories with high salience
    let boost = 0;
    if (memory.type === 'EPISODIC') {
      const episodic = memory as EpisodicMemory;
      boost = (episodic.metadata?.salience || 0) * 0.2;
    }

    // Recency boost
    const age = Date.now() - memory.timestamp.getTime();
    const recencyBoost = Math.max(0, 1 - age / (30 * 24 * 60 * 60 * 1000)) * 0.1; // 30 days

    return Math.min(1.0, jaccard + boost + recencyBoost);
  }

  /**
   * Get statistics
   */
  getStats() {
    let total = 0;
    for (const memories of this.memories.values()) {
      total += memories.length;
    }

    return {
      totalMemories: total,
      sessions: this.memories.size
    };
  }
}

