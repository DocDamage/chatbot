/**
 * Feedback Collector Compatibility Adapter (CRK-P16-T01)
 *
 * Bridges legacy FeedbackCollector callers to the CanonicalFeedbackService,
 * ensuring all feedback is unified into canonical trace-bound events while
 * strictly preventing legacy direct calls from invoking fine-tuning pipelines.
 */

import { CanonicalFeedbackService } from './CanonicalFeedbackService';
import { FeedbackCategory } from '../../types/feedback';
import { logger } from '../observability/logger';

export interface LegacyFeedbackPayload {
  responseId: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  rating?: number;
  thumbsUp?: boolean;
  thumbsDown?: boolean;
  comment?: string;
  categories?: string[];
  messageContent?: string;
  responseContent?: string;
}

export class FeedbackCollectorAdapter {
  constructor(private readonly canonicalService: CanonicalFeedbackService) {}

  /**
   * Adapts legacy explicit feedback to canonical feedback event.
   */
  public async adaptExplicit(payload: LegacyFeedbackPayload): Promise<void> {
    const thumbs: 'up' | 'down' | undefined = payload.thumbsUp
      ? 'up'
      : payload.thumbsDown
        ? 'down'
        : undefined;

    const rating = (payload.rating && payload.rating >= 1 && payload.rating <= 5)
      ? (payload.rating as 1 | 2 | 3 | 4 | 5)
      : undefined;

    const categories = this.normalizeCategories(payload.categories);

    await this.canonicalService.submitFeedback({
      event: {
        responseId: payload.responseId,
        requestId: payload.requestId || `legacy-${payload.responseId}`,
        sessionId: payload.sessionId || 'legacy-session',
        userId: payload.userId,
        rating,
        thumbs,
        categories,
        comment: payload.comment,
      },
    });

    logger.debug('Legacy explicit feedback adapted to canonical service', {
      responseId: payload.responseId,
    });
  }

  /**
   * Adapts legacy implicit feedback (e.g. user continued session).
   */
  public adaptImplicit(payload: LegacyFeedbackPayload): void {
    logger.debug('Legacy implicit feedback recorded without fine-tuning side effects', {
      responseId: payload.responseId,
    });
  }

  private normalizeCategories(categories?: string[]): FeedbackCategory[] {
    if (!categories) return [];
    const validSet = new Set<FeedbackCategory>([
      'incorrect',
      'instruction_failure',
      'outdated',
      'misunderstood',
      'bad_code',
      'too_verbose',
      'too_short',
      'wrong_source',
      'tool_failed',
      'citation_problem',
      'other',
    ]);

    const result: FeedbackCategory[] = [];
    for (const cat of categories) {
      const lower = cat.toLowerCase() as FeedbackCategory;
      if (validSet.has(lower)) {
        result.push(lower);
      } else {
        result.push('other');
      }
    }
    return result;
  }
}
