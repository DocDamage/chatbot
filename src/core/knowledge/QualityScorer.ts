import { QualitySignals } from '../../types/retrieval-scoring';

export class QualityScorer {
  /**
   * Computes a normalized quality score (0.0 to 1.0) based on content signals (§1938-1952).
   */
  public computeQuality(signals?: QualitySignals): number {
    if (!signals) {
      return 0.50; // Neutral baseline when signals are missing
    }

    let score = 0.50;

    // Positive indicators
    if (signals.isOfficialStatus) {
      score += 0.25;
    }

    if (signals.isAcceptedAnswer) {
      score += 0.20;
    }

    if (typeof signals.score === 'number') {
      if (signals.score > 25) {
        score += 0.15;
      } else if (signals.score > 5) {
        score += 0.08;
      } else if (signals.score < 0) {
        score -= 0.15;
      }
    }

    if (typeof signals.contentCompleteness === 'number') {
      score += (signals.contentCompleteness - 0.5) * 0.2;
    }

    // Negative indicators / penalties
    if (typeof signals.spamScore === 'number' && signals.spamScore > 0) {
      score -= signals.spamScore * 0.40;
    }

    if (signals.isMinifiedOrGenerated) {
      score -= 0.35;
    }

    return Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));
  }
}
