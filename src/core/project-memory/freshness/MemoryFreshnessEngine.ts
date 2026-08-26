/**
 * Memory Freshness & Contradiction Engine (PX-05 / PX05-T04 & PX05-T05)
 *
 * Evaluates memory freshness, transitions stale memories to 'possibly_stale' or 'stale',
 * tracks supersession chains, and identifies contradictions between memories and source facts.
 */

import { ProjectMemoryRecord, MemoryFreshnessState } from '../capture/ProjectMemorySchema';
import { ProjectMemoryStore } from '../capture/ProjectMemoryStore';
import { GitSymbolMemoryAnchor } from './GitSymbolMemoryAnchor';

export interface FreshnessEvaluationReport {
  totalEvaluated: number;
  currentCount: number;
  staleCount: number;
  supersededCount: number;
  quarantinedCount: number;
  detectedContradictions: Array<{ memoryA: string; memoryB: string; reason: string }>;
}

export class MemoryFreshnessEngine {
  constructor(
    private readonly store: ProjectMemoryStore,
    private readonly anchor: GitSymbolMemoryAnchor
  ) {}

  /**
   * Run full freshness evaluation pass across all active memories.
   */
  public evaluateFreshness(currentFileDigests: Map<string, string>): FreshnessEvaluationReport {
    const allMemories = this.store.query({}, { userId: 'system', isAdmin: true });
    let currentCount = 0;
    let staleCount = 0;
    let supersededCount = 0;
    let quarantinedCount = 0;
    const detectedContradictions: Array<{ memoryA: string; memoryB: string; reason: string }> = [];

    for (const mem of allMemories) {
      if (mem.freshnessState === 'superseded') {
        supersededCount++;
        continue;
      }
      if (mem.freshnessState === 'quarantined') {
        quarantinedCount++;
        continue;
      }
      if (mem.freshnessState === 'deleted') {
        continue;
      }

      const anchorResult = this.anchor.validateAnchor(mem, currentFileDigests);

      if (!anchorResult.isAnchored) {
        // Degrade freshness unless protected
        if (!mem.isProtected) {
          mem.freshnessState = anchorResult.fileDigestMatch ? 'possibly_stale' : 'stale';
          mem.confidence = Math.max(0.1, mem.confidence - anchorResult.confidencePenalty);
          this.store.save(mem);
          staleCount++;
        } else {
          currentCount++;
        }
      } else {
        mem.freshnessState = 'current';
        this.store.save(mem);
        currentCount++;
      }
    }

    // Contradiction detection pass
    for (let i = 0; i < allMemories.length; i++) {
      for (let j = i + 1; j < allMemories.length; j++) {
        const a = allMemories[i];
        const b = allMemories[j];

        if (a.kind === b.kind && a.title.toLowerCase() === b.title.toLowerCase() && a.id !== b.id) {
          if (a.freshnessState === 'current' && b.freshnessState === 'current') {
            detectedContradictions.push({
              memoryA: a.id,
              memoryB: b.id,
              reason: `Duplicate/conflicting active memory found with title: "${a.title}"`
            });
          }
        }
      }
    }

    return {
      totalEvaluated: allMemories.length,
      currentCount,
      staleCount,
      supersededCount,
      quarantinedCount,
      detectedContradictions
    };
  }
}
