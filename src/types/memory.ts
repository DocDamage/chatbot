/**
 * Memory Stratification - Session / Episodic / Canon
 */

export enum MemoryType {
  SESSION = 'SESSION',
  EPISODIC = 'EPISODIC',
  CANONICAL = 'CANONICAL'
}

export enum CanonLevel {
  IMMUTABLE = 'IMMUTABLE',
  CANON = 'CANON',
  PLAYER_CANON = 'PLAYER_CANON',
  NONCANON = 'NONCANON',
  QUARANTINED = 'QUARANTINED'
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  timestamp: Date;
  content: string;
  metadata?: {
    entities?: string[];
    salience?: number;
    emotional_summary?: string;
    facts_summary?: string;
  };
  canon_level?: CanonLevel;
}

export interface SessionMemory extends MemoryEntry {
  type: MemoryType.SESSION;
  turn_number: number;
  scene_context?: string;
}

export interface EpisodicMemory extends MemoryEntry {
  type: MemoryType.EPISODIC;
  embedding?: number[];
  key_decisions?: string[];
  relationship_deltas?: Record<string, number>;
}

export interface CanonicalMemory extends MemoryEntry {
  type: MemoryType.CANONICAL;
  canon_level: CanonLevel;
  immutable: boolean;
}

export interface MemoryContext {
  session_memories: SessionMemory[];
  episodic_memories: EpisodicMemory[];
  canonical_facts: CanonicalMemory[];
}

