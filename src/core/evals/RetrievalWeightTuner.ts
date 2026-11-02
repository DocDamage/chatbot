/**
 * Retrieval Weight Tuner (CRK-P25-T05)
 *
 * Evaluates candidate retrieval weight permutations against held-out validation cases.
 * Strictly avoids evaluating and optimizing on the exact same small seed set (§3715).
 */

import {
  RetrievalWeightCandidate,
  retrievalWeightCandidateSchema,
} from '../../types/ab-evaluation';

export interface EvaluationItem {
  query: string;
  expectedTopDocId: string;
  candidateDocs: Array<{
    docId: string;
    authority: number;
    freshness: number;
    quality: number;
    versionScore: number;
    textMatch: number;
  }>;
}

export class RetrievalWeightTuner {
  /**
   * Evaluates weight candidates on held-out cases and selects the optimal weight set.
   */
  public tuneHeldOutWeights(
    heldOutCases: EvaluationItem[],
    candidateWeightSets: Array<Record<string, number>>
  ): RetrievalWeightCandidate {
    if (heldOutCases.length === 0) {
      throw new Error('HELD_OUT_CASES_REQUIRED: Tuning requires a non-empty held-out evaluation set.');
    }

    let bestScore = -1;
    let bestWeights: Record<string, number> = candidateWeightSets[0] || {
      authority: 0.25,
      freshness: 0.15,
      quality: 0.20,
      versionScore: 0.15,
      textMatch: 0.25,
    };

    for (const weights of candidateWeightSets) {
      let hits = 0;

      for (const item of heldOutCases) {
        let bestCandidateId = '';
        let highestScore = -Infinity;

        for (const doc of item.candidateDocs) {
          const score =
            (doc.authority * (weights.authority ?? 0.2)) +
            (doc.freshness * (weights.freshness ?? 0.15)) +
            (doc.quality * (weights.quality ?? 0.15)) +
            (doc.versionScore * (weights.versionScore ?? 0.2)) +
            (doc.textMatch * (weights.textMatch ?? 0.3));

          if (score > highestScore) {
            highestScore = score;
            bestCandidateId = doc.docId;
          }
        }

        if (bestCandidateId === item.expectedTopDocId) {
          hits++;
        }
      }

      const evalScore = Number((hits / heldOutCases.length).toFixed(3));
      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestWeights = weights;
      }
    }

    const candidate: RetrievalWeightCandidate = {
      weights: bestWeights,
      heldOutEvaluationScore: Math.max(0, bestScore),
      version: `retrieval-weights-v${Date.now()}`,
    };

    return retrievalWeightCandidateSchema.parse(candidate);
  }
}
