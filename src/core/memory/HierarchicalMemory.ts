/**
 * Hierarchical Memory - Multi-level memory system
 * Research: MIT Memory Systems, Stanford Memory Networks
 */

import { MemoryService } from './MemoryService';
import { MemoryType, MemoryEntry, SessionMemory, EpisodicMemory, CanonicalMemory } from '../../types/memory';
import { logger } from '../observability/logger';

export interface WorkingMemory extends SessionMemory {
  priority: number;
  expirationTime: Date;
}

export interface ProceduralMemory extends MemoryEntry {
  type: MemoryType;
  pattern: string;
  behavior: string;
  successRate: number;
  usageCount: number;
}

export class HierarchicalMemory {
  private memoryService: MemoryService;
  private workingMemory: Map<string, WorkingMemory[]> = new Map();
  private proceduralMemories: ProceduralMemory[] = [];

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  /**
   * Add to working memory (short-term, high priority)
   */
  addWorkingMemory(sessionId: string, content: string, priority: number = 1.0, ttlMinutes: number = 30): void {
    if (!this.workingMemory.has(sessionId)) {
      this.workingMemory.set(sessionId, []);
    }

    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + ttlMinutes);

    const working: WorkingMemory = {
      id: this.generateId(),
      type: MemoryType.SESSION,
      timestamp: new Date(),
      content,
      priority,
      expirationTime,
      turn_number: this.workingMemory.get(sessionId)!.length + 1
    };

    this.workingMemory.get(sessionId)!.push(working);
    this.cleanupExpired(sessionId);

    logger.debug('Working memory added', { sessionId, priority });
  }

  /**
   * Consolidate working memory to episodic
   */
  consolidate(sessionId: string, threshold: number = 0.7): void {
    const working = this.workingMemory.get(sessionId) || [];
    const important = working.filter(m => m.priority >= threshold);

    for (const memory of important) {
      this.memoryService.addEpisodicMemory(sessionId, {
        content: memory.content,
        metadata: {
          salience: memory.priority
        }
      });
    }

    // Clear consolidated working memory
    this.workingMemory.set(sessionId, working.filter(m => m.priority < threshold));
    logger.info('Memory consolidated', { sessionId, consolidated: important.length });
  }

  /**
   * Add procedural memory (learned patterns)
   */
  addProceduralMemory(pattern: string, behavior: string, success: boolean): void {
    const existing = this.proceduralMemories.find(m => m.pattern === pattern);

    if (existing) {
      existing.usageCount++;
      if (success) {
        existing.successRate = (existing.successRate * (existing.usageCount - 1) + 1) / existing.usageCount;
      } else {
        existing.successRate = (existing.successRate * (existing.usageCount - 1)) / existing.usageCount;
      }
    } else {
      const procedural: ProceduralMemory = {
        id: this.generateId(),
        type: MemoryType.EPISODIC, // Using episodic as base
        timestamp: new Date(),
        content: `Pattern: ${pattern} → Behavior: ${behavior}`,
        pattern,
        behavior,
        successRate: success ? 1.0 : 0.0,
        usageCount: 1
      };
      this.proceduralMemories.push(procedural);
    }

    logger.debug('Procedural memory updated', { pattern, successRate: existing?.successRate || (success ? 1.0 : 0.0) });
  }

  /**
   * Retrieve relevant procedural memory
   */
  getProceduralMemory(pattern: string): ProceduralMemory | null {
    // Find best matching pattern
    const matches = this.proceduralMemories
      .filter(m => pattern.includes(m.pattern) || m.pattern.includes(pattern))
      .sort((a, b) => b.successRate - a.successRate);

    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Get hierarchical memory context
   */
  getContext(sessionId: string): {
    working: WorkingMemory[];
    episodic: EpisodicMemory[];
    procedural: ProceduralMemory[];
    canonical: CanonicalMemory[];
  } {
    const working = (this.workingMemory.get(sessionId) || [])
      .filter(m => m.expirationTime > new Date())
      .sort((a, b) => b.priority - a.priority);

    const memoryContext = this.memoryService.getMemoryContext(sessionId);
    const procedural = this.proceduralMemories
      .filter(m => m.successRate > 0.5)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    return {
      working,
      episodic: memoryContext.episodic_memories,
      procedural,
      canonical: memoryContext.canonical_facts
    };
  }

  /**
   * Cleanup expired working memory
   */
  private cleanupExpired(sessionId: string): void {
    const working = this.workingMemory.get(sessionId) || [];
    const now = new Date();
    const active = working.filter(m => m.expirationTime > now);
    this.workingMemory.set(sessionId, active);
  }

  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

