/**
 * Feedback Collector - Collect user feedback automatically
 * Research: MIT Online Learning, Stanford Continual Learning
 */

import { logger } from '../observability/logger';

export interface FeedbackData {
  responseId: string;
  userId: string;
  sessionId: string;
  rating?: number; // 1-5
  thumbsUp?: boolean;
  thumbsDown?: boolean;
  comment?: string;
  timestamp: Date;
}

export class FeedbackCollector {
  private feedbackQueue: FeedbackData[] = [];
  private batchSize: number = 10;

  /**
   * Collect feedback
   */
  collect(feedback: FeedbackData): void {
    this.feedbackQueue.push(feedback);
    logger.info('Feedback collected', {
      responseId: feedback.responseId,
      rating: feedback.rating,
      thumbsUp: feedback.thumbsUp
    });

    // Process batch if ready
    if (this.feedbackQueue.length >= this.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Process feedback batch
   */
  private async processBatch(): Promise<void> {
    const batch = this.feedbackQueue.splice(0, this.batchSize);
    
    logger.info('Processing feedback batch', { size: batch.length });

    // In production, would send to learning pipeline
    // For now, just log
    const avgRating = batch
      .filter(f => f.rating)
      .reduce((sum, f) => sum + (f.rating || 0), 0) / batch.filter(f => f.rating).length;

    logger.info('Feedback batch processed', {
      avgRating: avgRating.toFixed(2),
      positive: batch.filter(f => f.thumbsUp).length,
      negative: batch.filter(f => f.thumbsDown).length
    });
  }

  /**
   * Get feedback statistics
   */
  getStats() {
    return {
      pending: this.feedbackQueue.length,
      readyForBatch: this.feedbackQueue.length >= this.batchSize
    };
  }
}

