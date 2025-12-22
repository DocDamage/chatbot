/**
 * Feedback Collector - Collect user feedback and send to learning pipeline
 * Research: MIT Online Learning, Stanford Continual Learning
 */

import { logger } from '../observability/logger';
import { AnalyticsService } from '../analytics/AnalyticsService';

export interface FeedbackData {
  responseId: string;
  userId: string;
  sessionId: string;
  rating?: number; // 1-5
  thumbsUp?: boolean;
  thumbsDown?: boolean;
  comment?: string;
  categories?: string[]; // 'helpful', 'accurate', 'fast', 'creative', etc.
  timestamp: Date;
  messageContent?: string;
  responseContent?: string;
}

export interface FeedbackStats {
  pending: number;
  processed: number;
  averageRating: number;
  positiveRate: number;
  negativeRate: number;
  topCategories: Array<{ category: string; count: number }>;
}

export class FeedbackCollector {
  private feedbackQueue: FeedbackData[] = [];
  private processedFeedback: FeedbackData[] = [];
  private batchSize: number = 10;
  private analyticsService?: AnalyticsService;
  private categoryCount: Map<string, number> = new Map();
  private onFeedbackCallbacks: Array<(feedback: FeedbackData) => void> = [];

  constructor(analyticsService?: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  /**
   * Set analytics service for integration
   */
  setAnalyticsService(service: AnalyticsService): void {
    this.analyticsService = service;
  }

  /**
   * Register callback for new feedback
   */
  onFeedback(callback: (feedback: FeedbackData) => void): void {
    this.onFeedbackCallbacks.push(callback);
  }

  /**
   * Collect feedback
   */
  collect(feedback: FeedbackData): void {
    this.feedbackQueue.push(feedback);

    // Track categories
    if (feedback.categories) {
      for (const cat of feedback.categories) {
        this.categoryCount.set(cat, (this.categoryCount.get(cat) || 0) + 1);
      }
    }

    logger.info('Feedback collected', {
      responseId: feedback.responseId,
      rating: feedback.rating,
      thumbsUp: feedback.thumbsUp
    });

    // Send to analytics service if available
    if (this.analyticsService) {
      this.analyticsService.recordFeedback({
        userId: feedback.userId,
        sessionId: feedback.sessionId,
        rating: feedback.rating || (feedback.thumbsUp ? 5 : feedback.thumbsDown ? 1 : 3),
        comment: feedback.comment,
        messageId: feedback.responseId,
        categories: feedback.categories
      });
    }

    // Notify callbacks
    for (const callback of this.onFeedbackCallbacks) {
      try {
        callback(feedback);
      } catch (e) {
        // Ignore callback errors
      }
    }

    // Process batch if ready
    if (this.feedbackQueue.length >= this.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Process feedback batch - send to learning pipeline
   */
  private async processBatch(): Promise<void> {
    const batch = this.feedbackQueue.splice(0, this.batchSize);

    logger.info('Processing feedback batch', { size: batch.length });

    // Calculate batch metrics
    const ratedFeedback = batch.filter(f => f.rating);
    const avgRating = ratedFeedback.length > 0
      ? ratedFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / ratedFeedback.length
      : 0;

    const positiveCount = batch.filter(f => f.thumbsUp || (f.rating && f.rating >= 4)).length;
    const negativeCount = batch.filter(f => f.thumbsDown || (f.rating && f.rating <= 2)).length;

    // Store processed feedback
    this.processedFeedback.push(...batch);
    if (this.processedFeedback.length > 1000) {
      this.processedFeedback = this.processedFeedback.slice(-1000);
    }

    // Generate training signals from feedback
    const trainingSignals = this.generateTrainingSignals(batch);

    logger.info('Feedback batch processed', {
      avgRating: avgRating.toFixed(2),
      positive: positiveCount,
      negative: negativeCount,
      trainingSignals: trainingSignals.length
    });

    // In production, send to fine-tuning pipeline
    if (trainingSignals.length > 0) {
      await this.sendToLearningPipeline(trainingSignals);
    }
  }

  /**
   * Generate training signals from feedback
   */
  private generateTrainingSignals(batch: FeedbackData[]): Array<{
    input: string;
    output: string;
    quality: 'positive' | 'negative';
    weight: number;
  }> {
    const signals: Array<{
      input: string;
      output: string;
      quality: 'positive' | 'negative';
      weight: number;
    }> = [];

    for (const feedback of batch) {
      // Only generate signals for feedback with message content
      if (!feedback.messageContent || !feedback.responseContent) {
        continue;
      }

      // Determine quality
      const isPositive = feedback.thumbsUp || (feedback.rating && feedback.rating >= 4);
      const isNegative = feedback.thumbsDown || (feedback.rating && feedback.rating <= 2);

      if (!isPositive && !isNegative) {
        continue; // Neutral feedback doesn't create strong signals
      }

      // Calculate weight based on confidence
      let weight = 0.5;
      if (feedback.rating) {
        weight = feedback.rating === 5 || feedback.rating === 1 ? 1.0
          : feedback.rating === 4 || feedback.rating === 2 ? 0.7
            : 0.3;
      }

      signals.push({
        input: feedback.messageContent,
        output: feedback.responseContent,
        quality: isPositive ? 'positive' : 'negative',
        weight
      });
    }

    return signals;
  }

  /**
   * Send training signals to learning pipeline
   */
  private async sendToLearningPipeline(signals: Array<{
    input: string;
    output: string;
    quality: 'positive' | 'negative';
    weight: number;
  }>): Promise<void> {
    // In production, this would:
    // 1. Store signals in a training database
    // 2. Trigger fine-tuning jobs when enough data accumulates
    // 3. Send to RLHF pipeline for reinforcement learning

    logger.info('Training signals generated', {
      total: signals.length,
      positive: signals.filter(s => s.quality === 'positive').length,
      negative: signals.filter(s => s.quality === 'negative').length
    });

    // Store signals for later use
    // In production: await this.trainingDatabase.storeSignals(signals);
  }

  /**
   * Force process all pending feedback
   */
  async flush(): Promise<void> {
    while (this.feedbackQueue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Get feedback statistics
   */
  getStats(): FeedbackStats {
    const allFeedback = [...this.processedFeedback, ...this.feedbackQueue];

    const ratedFeedback = allFeedback.filter(f => f.rating);
    const avgRating = ratedFeedback.length > 0
      ? ratedFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / ratedFeedback.length
      : 0;

    const positiveCount = allFeedback.filter(f => f.thumbsUp || (f.rating && f.rating >= 4)).length;
    const negativeCount = allFeedback.filter(f => f.thumbsDown || (f.rating && f.rating <= 2)).length;

    // Get top categories
    const sortedCategories = Array.from(this.categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      pending: this.feedbackQueue.length,
      processed: this.processedFeedback.length,
      averageRating: avgRating,
      positiveRate: allFeedback.length > 0 ? positiveCount / allFeedback.length : 0,
      negativeRate: allFeedback.length > 0 ? negativeCount / allFeedback.length : 0,
      topCategories: sortedCategories
    };
  }

  /**
   * Get recent feedback for analysis
   */
  getRecentFeedback(limit: number = 20): FeedbackData[] {
    return [...this.processedFeedback, ...this.feedbackQueue]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get feedback by user
   */
  getFeedbackByUser(userId: string): FeedbackData[] {
    return [...this.processedFeedback, ...this.feedbackQueue]
      .filter(f => f.userId === userId);
  }
}
