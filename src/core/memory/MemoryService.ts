/**
 * Memory Service - Stratified memory management (Session / Episodic / Canon)
 */

import { MemoryType, MemoryEntry, SessionMemory, EpisodicMemory, CanonicalMemory, MemoryContext } from '../../types/memory';
import { logger } from '../observability/logger';

export class MemoryService {
  private sessionMemories: Map<string, SessionMemory[]> = new Map();
  private episodicMemories: Map<string, EpisodicMemory[]> = new Map();
  private canonicalMemories: CanonicalMemory[] = [];

  constructor() {
    // Initialize with some default canonical facts
    this.initializeCanonicalMemory();
  }

  /**
   * Add a session memory (ephemeral, last N turns)
   */
  addSessionMemory(sessionId: string, memory: Omit<SessionMemory, 'id' | 'type' | 'timestamp'>): void {
    if (!this.sessionMemories.has(sessionId)) {
      this.sessionMemories.set(sessionId, []);
    }

    const sessionMemories = this.sessionMemories.get(sessionId)!;
    const newMemory: SessionMemory = {
      ...memory,
      id: this.generateId(),
      type: MemoryType.SESSION,
      timestamp: new Date(),
      turn_number: sessionMemories.length + 1
    };

    sessionMemories.push(newMemory);

    // Keep only last 50 turns
    if (sessionMemories.length > 50) {
      sessionMemories.shift();
    }

    logger.debug(`Added session memory for session ${sessionId}`, { turn: newMemory.turn_number });
  }

  /**
   * Add an episodic memory (durable, key decisions)
   */
  addEpisodicMemory(sessionId: string, memory: Omit<EpisodicMemory, 'id' | 'type' | 'timestamp'>): void {
    if (!this.episodicMemories.has(sessionId)) {
      this.episodicMemories.set(sessionId, []);
    }

    const episodicMemories = this.episodicMemories.get(sessionId)!;
    const newMemory: EpisodicMemory = {
      ...memory,
      id: this.generateId(),
      type: MemoryType.EPISODIC,
      timestamp: new Date()
    };

    episodicMemories.push(newMemory);
    logger.debug(`Added episodic memory for session ${sessionId}`);
  }

  /**
   * Get memory context for a session
   */
  getMemoryContext(sessionId: string, limit: number = 10): MemoryContext {
    const session_memories = this.sessionMemories.get(sessionId) || [];
    const episodic_memories = (this.episodicMemories.get(sessionId) || [])
      .slice(-limit)
      .sort((a, b) => (b.metadata?.salience || 0) - (a.metadata?.salience || 0))
      .slice(0, limit);

    return {
      session_memories: session_memories.slice(-limit),
      episodic_memories,
      canonical_facts: this.canonicalMemories
    };
  }

  /**
   * Summarize recent memories for compression
   */
  summarizeMemories(sessionId: string): string {
    const context = this.getMemoryContext(sessionId, 20);
    
    const summaries: string[] = [];
    
    if (context.session_memories.length > 0) {
      summaries.push(`Recent conversation (${context.session_memories.length} turns)`);
    }
    
    if (context.episodic_memories.length > 0) {
      summaries.push(`Key memories (${context.episodic_memories.length} entries)`);
    }

    return summaries.join('. ') || 'No prior context';
  }

  /**
   * Initialize with some default canonical facts
   */
  private initializeCanonicalMemory(): void {
    // Example canonical facts - in a real system these would come from a knowledge base
    this.canonicalMemories = [
      {
        id: 'canon-001',
        type: MemoryType.CANONICAL,
        timestamp: new Date(),
        content: 'This is an AI chatbot that can answer general questions and engage in conversation.',
        canon_level: 'CANON',
        immutable: false
      }
    ];
  }

  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

