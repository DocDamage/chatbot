/**
 * Entity Linking Service (CRK Phase 19: CRK-P19-T03)
 *
 * Links Wikipedia sections and text spans to Wikidata entities with conservative
 * confidence scoring to prevent irreversible merges from low-confidence matches.
 */

import { EntityLinkResult } from '../../types/general-knowledge';
import { WikidataStructuredStore } from './WikidataStructuredStore';

export class EntityLinkingService {
  private store: WikidataStructuredStore;
  private readonly confidenceThreshold: number;

  constructor(store: WikidataStructuredStore, confidenceThreshold = 0.85) {
    this.store = store;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Links a text mention or article title to a Wikidata entity (§3106-3111)
   */
  public linkMention(
    mention: string,
    context?: { summary?: string; domain?: string }
  ): EntityLinkResult {
    const trimmed = mention.trim();
    if (!trimmed) {
      return {
        textSpan: mention,
        entityId: '',
        entityLabel: '',
        confidence: 0,
        isLinked: false,
        matchType: 'unmatched',
      };
    }

    const candidates = this.store.findByLabelOrAlias(trimmed);
    if (candidates.length === 0) {
      return {
        textSpan: mention,
        entityId: '',
        entityLabel: '',
        confidence: 0,
        isLinked: false,
        matchType: 'unmatched',
      };
    }

    // 1. Single exact label match
    const exactMatches = candidates.filter(
      (c) => c.label.toLowerCase() === trimmed.toLowerCase()
    );

    if (exactMatches.length === 1) {
      const best = exactMatches[0];
      return {
        textSpan: mention,
        entityId: best.entityId,
        entityLabel: best.label,
        confidence: 0.95,
        isLinked: 0.95 >= this.confidenceThreshold,
        matchType: 'exact_label',
      };
    }

    // 2. Disambiguation among multiple candidates via context
    if (context?.summary && candidates.length > 1) {
      const summaryLower = context.summary.toLowerCase();
      let bestCandidate = candidates[0];
      let maxScore = 0;

      for (const candidate of candidates) {
        let matchScore = 0;
        const descWords = candidate.description.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        for (const w of descWords) {
          if (summaryLower.includes(w)) matchScore += 0.15;
        }
        if (matchScore > maxScore) {
          maxScore = matchScore;
          bestCandidate = candidate;
        }
      }

      const disambiguatedConfidence = Math.min(0.92, 0.70 + maxScore);
      if (disambiguatedConfidence >= this.confidenceThreshold) {
        return {
          textSpan: mention,
          entityId: bestCandidate.entityId,
          entityLabel: bestCandidate.label,
          confidence: disambiguatedConfidence,
          isLinked: true,
          matchType: 'contextual_disambiguation',
        };
      }
    }

    // 3. Alias match
    const aliasMatches = candidates.filter((c) =>
      c.aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())
    );

    if (aliasMatches.length === 1) {
      const best = aliasMatches[0];
      const confidence = 0.86;
      return {
        textSpan: mention,
        entityId: best.entityId,
        entityLabel: best.label,
        confidence,
        isLinked: confidence >= this.confidenceThreshold,
        matchType: 'alias',
      };
    }

    // Ambiguous without sufficient confidence -> conservative rejection (§3110)
    return {
      textSpan: mention,
      entityId: candidates[0].entityId,
      entityLabel: candidates[0].label,
      confidence: 0.50,
      isLinked: false,
      matchType: 'unmatched',
    };
  }
}
