/**
 * Forgetting Mechanism - Intelligent memory decay
 * Research: MIT Memory Systems, Forgetting Curves
 */

import { MemoryEntry, EpisodicMemory } from '../../types/memory';
import { logger } from '../observability/logger';

export interface ForgettingCurve {
  initialStrength: number;
  decayRate: number; // per day
  minStrength: number; // threshold for forgetting
}

export class ForgettingMechanism {
  private curves: Map<string, ForgettingCurve> = new Map();

  constructor() {
    // Default forgetting curve (Ebbinghaus)
    this.setDefaultCurve();
  }

  /**
   * Calculate memory strength based on forgetting curve
   */
  calculateStrength(memory: MemoryEntry, daysSinceAccess: number): number {
    const curve = this.curves.get(memory.type) || this.curves.get('default')!;
    
    // Exponential decay
    const strength = curve.initialStrength * Math.exp(-curve.decayRate * daysSinceAccess);
    
    return Math.max(curve.minStrength, strength);
  }

  /**
   * Check if memory should be forgotten
   */
  shouldForget(memory: MemoryEntry, lastAccess?: Date): boolean {
    const accessDate = lastAccess || memory.timestamp;
    const daysSinceAccess = (Date.now() - accessDate.getTime()) / (1000 * 60 * 60 * 24);
    
    const strength = this.calculateStrength(memory, daysSinceAccess);
    const curve = this.curves.get(memory.type) || this.curves.get('default')!;
    
    return strength <= curve.minStrength;
  }

  /**
   * Get memories to forget
   */
  getMemoriesToForget(memories: MemoryEntry[], lastAccessMap?: Map<string, Date>): MemoryEntry[] {
    return memories.filter(memory => {
      const lastAccess = lastAccessMap?.get(memory.id);
      return this.shouldForget(memory, lastAccess);
    });
  }

  /**
   * Apply forgetting to episodic memories
   */
  applyForgetting(episodicMemories: EpisodicMemory[]): {
    kept: EpisodicMemory[];
    forgotten: EpisodicMemory[];
  } {
    const forgotten: EpisodicMemory[] = [];
    const kept: EpisodicMemory[] = [];

    for (const memory of episodicMemories) {
      if (this.shouldForget(memory)) {
        forgotten.push(memory);
      } else {
        kept.push(memory);
      }
    }

    logger.info('Forgetting applied', {
      total: episodicMemories.length,
      kept: kept.length,
      forgotten: forgotten.length
    });

    return { kept, forgotten };
  }

  /**
   * Set forgetting curve for memory type
   */
  setCurve(memoryType: string, curve: ForgettingCurve): void {
    this.curves.set(memoryType, curve);
    logger.debug('Forgetting curve set', { memoryType, curve });
  }

  /**
   * Set default forgetting curves
   */
  private setDefaultCurve(): void {
    // Episodic memories decay faster
    this.curves.set('EPISODIC', {
      initialStrength: 1.0,
      decayRate: 0.1, // 10% per day
      minStrength: 0.2
    });

    // Canonical memories decay slower
    this.curves.set('CANONICAL', {
      initialStrength: 1.0,
      decayRate: 0.01, // 1% per day
      minStrength: 0.5
    });

    // Default curve
    this.curves.set('default', {
      initialStrength: 1.0,
      decayRate: 0.05, // 5% per day
      minStrength: 0.3
    });
  }
}

