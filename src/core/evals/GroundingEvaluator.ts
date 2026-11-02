/**
 * Grounding Evaluator
 * CRK Phase 12: Evidence Sufficiency Model (CRK-P12-T01, T02)
 */

import {
  GroundingDecision,
  GroundingEvaluationInput,
  RecommendedAction,
  RetrievalConfidenceFeatures,
} from '../../types/grounding-eval';

export class GroundingEvaluator {
  public static readonly DEFAULT_SUFFICIENCY_THRESHOLD = 0.65;

  public static evaluate(input: GroundingEvaluationInput): GroundingDecision {
    const threshold = input.strictThreshold || this.DEFAULT_SUFFICIENCY_THRESHOLD;
    const chunks = input.chunks || [];

    if (chunks.length === 0) {
      const action: RecommendedAction = !input.localScopeBroadened
        ? 'broaden-local'
        : input.onlineSearchAllowed
        ? 'search-online'
        : 'abstain';

      return {
        attempted: true,
        sufficient: false,
        confidence: 0,
        reasons: ['No retrieved chunks available for query.'],
        recommendedAction: action,
        features: this.emptyFeatures(),
      };
    }

    const features = this.extractFeatures(input.query, chunks);
    const reasons: string[] = [];

    // Calculate composite confidence
    const confidence =
      features.topScore * 0.35 +
      features.sourceAuthority * 0.25 +
      features.queryCoverage * 0.25 +
      Math.min(features.relevantChunkCount / 3, 1.0) * 0.15;

    let sufficient = confidence >= threshold;

    if (features.conflictingEvidence) {
      sufficient = false;
      reasons.push('Direct conflict detected across evidence sources.');
    }

    if (features.queryCoverage < 0.4) {
      sufficient = false;
      reasons.push(`Low query keyword coverage: ${(features.queryCoverage * 100).toFixed(0)}%.`);
    }

    if (features.topScore < 0.5) {
      sufficient = false;
      reasons.push(`Top retrieval score (${features.topScore.toFixed(2)}) is below relevance floor.`);
    }

    if (sufficient) {
      reasons.push(`Sufficient grounding evidence verified (confidence: ${confidence.toFixed(2)}).`);
    }

    // Determine recommended escalation action (§2318-2332)
    let recommendedAction: RecommendedAction = 'answer';
    if (!sufficient) {
      if (features.conflictingEvidence) {
        recommendedAction = 'ask-clarification';
      } else if (!input.localScopeBroadened) {
        recommendedAction = 'broaden-local';
      } else if (input.onlineSearchAllowed) {
        recommendedAction = 'search-online';
      } else {
        recommendedAction = 'abstain';
      }
    }

    return {
      attempted: true,
      sufficient,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      recommendedAction,
      features,
    };
  }

  private static extractFeatures(query: string, chunks: any[]): RetrievalConfidenceFeatures {
    const scores = chunks.map((c) => c.compositeScore ?? 0).sort((a, b) => b - a);
    const topScore = scores[0] || 0;
    const secondScore = scores[1] || 0;
    const scoreMargin = Math.max(0, topScore - secondScore);

    const avgAuthority =
      chunks.reduce((acc, c) => acc + (c.authority ?? 0.8), 0) / chunks.length;

    const uniqueSources = new Set(chunks.map((c) => c.sourceUri)).size;

    // Check query keyword coverage with stop words filtered and prefix stemming
    const STOP_WORDS = new Set([
      'what', 'how', 'when', 'where', 'which', 'who', 'why', 'the', 'and', 'for',
      'with', 'from', 'about', 'into', 'can', 'are', 'does', 'that', 'this', 'have', 'has', 'in'
    ]);

    const keywords = query
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((k) => k.length >= 3 && !STOP_WORDS.has(k));

    const combinedText = chunks.map((c) => c.content.toLowerCase()).join(' ');
    let matchedKeywords = 0;
    for (const kw of keywords) {
      const stem = kw.length > 5 ? kw.slice(0, 5) : kw;
      if (combinedText.includes(kw) || combinedText.includes(stem)) {
        matchedKeywords++;
      }
    }
    const queryCoverage = keywords.length > 0 ? matchedKeywords / keywords.length : 1.0;

    // Detect conflicting evidence (contradiction signals in chunks)
    const hasConflict =
      chunks.some((c) => c.metadata?.hasConflict === true) ||
      (chunks.length >= 2 &&
        chunks.some((c) => c.content.includes('DEPRECATED') || c.content.includes('REMOVED')) &&
        chunks.some((c) => c.content.includes('SUPPORTED') || c.content.includes('RECOMMENDED')));

    return {
      topScore,
      scoreMargin,
      sourceAuthority: Math.round(avgAuthority * 100) / 100,
      sourceDiversity: uniqueSources,
      versionCompatibility: 1.0,
      relevantChunkCount: chunks.filter((c) => (c.compositeScore ?? 0) >= 0.5).length,
      queryCoverage: Math.round(queryCoverage * 100) / 100,
      conflictingEvidence: hasConflict,
    };
  }

  private static emptyFeatures(): RetrievalConfidenceFeatures {
    return {
      topScore: 0,
      scoreMargin: 0,
      sourceAuthority: 0,
      sourceDiversity: 0,
      versionCompatibility: 0,
      relevantChunkCount: 0,
      queryCoverage: 0,
      conflictingEvidence: false,
    };
  }
}
