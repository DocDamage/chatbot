/**
 * Memory Consolidator - Transfer from working to long-term
 * Research: MIT Memory Systems, Memory Consolidation
 */

import { HierarchicalMemory } from './HierarchicalMemory';
import { MemoryService } from './MemoryService';
import { logger } from '../observability/logger';

export interface ConsolidationRule {
  minPriority: number;
  minAge: number; // minutes
  maxMemories: number;
}

export class MemoryConsolidator {
  private hierarchicalMemory: HierarchicalMemory;
  private memoryService: MemoryService;
  private rules: ConsolidationRule;

  constructor(
    hierarchicalMemory: HierarchicalMemory,
    memoryService: MemoryService,
    rules: ConsolidationRule = {
      minPriority: 0.7,
      minAge: 15, // 15 minutes
      maxMemories: 50
    }
  ) {
    this.hierarchicalMemory = hierarchicalMemory;
    this.memoryService = memoryService;
    this.rules = rules;
  }

  /**
   * Consolidate memories for a session
   */
  consolidate(sessionId: string): {
    consolidated: number;
    pruned: number;
  } {
    // Get working memories
    const context = this.hierarchicalMemory.getContext(sessionId);
    const working = context.working;

    // Filter memories that meet consolidation criteria
    const now = Date.now();
    const toConsolidate = working.filter(m => {
      const age = (now - m.timestamp.getTime()) / (1000 * 60); // minutes
      return m.priority >= this.rules.minPriority && age >= this.rules.minAge;
    });

    // Consolidate to episodic
    for (const memory of toConsolidate) {
      this.memoryService.addEpisodicMemory(sessionId, {
        content: memory.content,
        metadata: {
          salience: memory.priority
        }
      });
    }

    // Prune old episodic memories if too many
    const episodic = context.episodic;
    let pruned = 0;
    if (episodic.length > this.rules.maxMemories) {
      // Keep only top memories by salience
      const sorted = [...episodic].sort((a, b) => 
        (b.metadata?.salience || 0) - (a.metadata?.salience || 0)
      );
      pruned = episodic.length - this.rules.maxMemories;
      // In production, would actually remove from memory service
    }

    // Trigger hierarchical consolidation
    this.hierarchicalMemory.consolidate(sessionId, this.rules.minPriority);

    logger.info('Memory consolidation completed', {
      sessionId,
      consolidated: toConsolidate.length,
      pruned
    });

    return {
      consolidated: toConsolidate.length,
      pruned
    };
  }

  /**
   * Auto-consolidate (call periodically)
   */
  autoConsolidate(): void {
    // Would iterate over all sessions
    // For now, just log
    logger.debug('Auto-consolidation check');
  }
}

