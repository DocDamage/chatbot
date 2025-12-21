/**
 * Feedback Collector - User feedback collection
 * Research: Stanford CS224N, RLHF
 */

import { FeedbackData } from './RewardModel';
import { logger } from '../observability/logger';

export interface FeedbackEvent {
  type: 'explicit' | 'implicit';
  timestamp: Date;
  data: FeedbackData;
}

export class FeedbackCollector {
  private feedbackQueue: FeedbackEvent[] = [];
  private batchSize: number = 10;

  /**
   * Collect explicit feedback (thumbs up/down, rating, comment)
   */
  collectExplicit(feedback: FeedbackData): void {
    this.feedbackQueue.push({
      type: 'explicit',
      timestamp: new Date(),
      data: feedback
    });

    logger.info('Explicit feedback collected', {
      responseId: feedback.responseId,
      rating: feedback.userFeedback?.rating,
      thumbsUp: feedback.userFeedback?.thumbsUp
    });
  }

  /**
   * Collect implicit feedback (user behavior)
   */
  collectImplicit(feedback: FeedbackData): void {
    this.feedbackQueue.push({
      type: 'implicit',
      timestamp: new Date(),
      data: feedback
    });

    logger.debug('Implicit feedback collected', {
      responseId: feedback.responseId,
      userContinued: feedback.implicitFeedback?.userContinued
    });
  }

  /**
   * Get feedback batch for processing
   */
  getBatch(): FeedbackEvent[] {
    if (this.feedbackQueue.length < this.batchSize) {
      return [];
    }

    const batch = this.feedbackQueue.splice(0, this.batchSize);
    logger.debug('Feedback batch prepared', { size: batch.length });
    return batch;
  }

  /**
   * Get all pending feedback
   */
  getAll(): FeedbackEvent[] {
    return [...this.feedbackQueue];
  }

  /**
   * Clear processed feedback
   */
  clearProcessed(processedIds: string[]): void {
    this.feedbackQueue = this.feedbackQueue.filter(
      event => !processedIds.includes(event.data.responseId)
    );
    logger.debug('Processed feedback cleared', { count: processedIds.length });
  }

  /**
   * Get feedback statistics
   */
  getStats() {
    const explicit = this.feedbackQueue.filter(f => f.type === 'explicit').length;
    const implicit = this.feedbackQueue.filter(f => f.type === 'implicit').length;

    return {
      total: this.feedbackQueue.length,
      explicit,
      implicit,
      readyForBatch: this.feedbackQueue.length >= this.batchSize
    };
  }
}

