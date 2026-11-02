/**
 * Developer QA Quality Filter (CRK Phase 13: CRK-P13-T02, T03)
 * Filters out low-signal, spam, link-only, and insufficient score Q&A pairs.
 */

import { QAPair, QAQualityFilterConfig, QAQualityFilterResult } from '../../types/developer-qa';

export class DeveloperQAQualityFilter {
  private config: QAQualityFilterConfig;

  private static readonly SPAM_REGEX =
    /\b(casino|crypto pump|buy cheap|viagra|cialis|essay writing service|whatsapp me)\b/i;

  private static readonly CHATTER_PATTERNS = [
    /^\s*(thanks|\+1|me too|same here|did you solve this\??|any update\??)\s*$/i,
    /^\s*(following|bump|upvoted)\s*$/i,
  ];

  constructor(config?: Partial<QAQualityFilterConfig>) {
    this.config = {
      minQuestionScore: 5,
      minAnswerScore: 3,
      requireAcceptedOrScore: true,
      minBodyLength: 40,
      rejectLinkOnly: true,
      rejectSpamPatterns: true,
      ...config,
    };
  }

  public evaluate(pair: QAPair): QAQualityFilterResult {
    // 1. Check attribution presence
    if (!pair.license || !pair.author || !pair.sourceUrl) {
      return { accepted: false, reason: 'Missing attribution or provenance metadata', qualityScore: 0 };
    }

    // 2. Score threshold check
    if (this.config.requireAcceptedOrScore) {
      const meetsScore =
        pair.isAccepted ||
        pair.answerScore >= this.config.minAnswerScore ||
        pair.questionScore >= this.config.minQuestionScore;

      if (!meetsScore) {
        return {
          accepted: false,
          reason: `Score threshold not met (accepted=${pair.isAccepted}, aScore=${pair.answerScore}, qScore=${pair.questionScore})`,
          qualityScore: 0.2,
        };
      }
    }

    // 3. Body length check
    if (pair.answerBody.trim().length < this.config.minBodyLength) {
      return {
        accepted: false,
        reason: `Answer body too short (${pair.answerBody.trim().length} < ${this.config.minBodyLength})`,
        qualityScore: 0.3,
      };
    }

    // 4. Low-signal chatter check
    for (const pattern of DeveloperQAQualityFilter.CHATTER_PATTERNS) {
      if (pattern.test(pair.answerBody.trim())) {
        return { accepted: false, reason: 'Answer is low-signal chatter', qualityScore: 0.1 };
      }
    }

    // 5. Spam check
    if (this.config.rejectSpamPatterns) {
      if (
        DeveloperQAQualityFilter.SPAM_REGEX.test(pair.questionTitle) ||
        DeveloperQAQualityFilter.SPAM_REGEX.test(pair.answerBody)
      ) {
        return { accepted: false, reason: 'Detected potential spam or promotional content', qualityScore: 0.0 };
      }
    }

    // 6. Link-only answer check
    if (this.config.rejectLinkOnly) {
      const cleanedBody = pair.answerBody
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/gi, '$1')
        .trim();

      if (cleanedBody.length < 25) {
        return { accepted: false, reason: 'Answer is link-only without substantial explanation', qualityScore: 0.2 };
      }
    }

    // Calculate quality score based on metrics
    let score = 0.6;
    if (pair.isAccepted) score += 0.2;
    if (pair.answerScore >= 10) score += 0.1;
    else if (pair.answerScore >= 3) score += 0.05;
    if (pair.questionScore >= 10) score += 0.05;
    if (pair.answerBody.includes('```') || pair.answerBody.includes('<code>')) score += 0.05;

    return {
      accepted: true,
      qualityScore: Math.min(1.0, score),
    };
  }
}
