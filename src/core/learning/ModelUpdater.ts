/**
 * Model Updater - Continuous model fine-tuning with feedback trend analysis
 * Research: MIT Online Learning, Model Fine-tuning
 */

import { logger } from '../observability/logger';
import { FeedbackCollector, FeedbackData, FeedbackStats } from './FeedbackCollector';

export interface ModelVersion {
  id: string;
  version: string;
  createdAt: Date;
  performance: {
    accuracy: number;
    latency: number;
    cost: number;
    satisfactionScore?: number;
  };
  active: boolean;
  feedbackSummary?: {
    totalFeedback: number;
    avgRating: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export interface FeedbackTrend {
  period: 'day' | 'week' | 'month';
  currentAvg: number;
  previousAvg: number;
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
  sampleSize: number;
}

export interface UpdateRecommendation {
  shouldUpdate: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
}

export class ModelUpdater {
  private feedbackCollector: FeedbackCollector;
  private versions: ModelVersion[] = [];
  private currentVersion: ModelVersion | null = null;
  private feedbackHistory: Array<{ timestamp: Date; rating: number }> = [];
  private updateThresholds = {
    ratingDeclinePercent: 10, // Trigger update if rating declines by 10%
    minSampleSize: 50, // Need at least 50 feedback items
    lowRatingThreshold: 3.0, // Average rating below this triggers concern
  };

  constructor(feedbackCollector: FeedbackCollector) {
    this.feedbackCollector = feedbackCollector;
    this.setupFeedbackTracking();
  }

  /**
   * Setup feedback tracking for trend analysis
   */
  private setupFeedbackTracking(): void {
    this.feedbackCollector.onFeedback((feedback: FeedbackData) => {
      if (feedback.rating) {
        this.feedbackHistory.push({
          timestamp: feedback.timestamp,
          rating: feedback.rating
        });

        // Keep last 1000 ratings
        if (this.feedbackHistory.length > 1000) {
          this.feedbackHistory = this.feedbackHistory.slice(-1000);
        }
      }
    });
  }

  /**
   * Analyze feedback trends
   */
  analyzeTrends(): FeedbackTrend[] {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    const trends: FeedbackTrend[] = [];

    // Daily trend
    const todayFeedback = this.feedbackHistory.filter(
      f => now - f.timestamp.getTime() < dayMs
    );
    const yesterdayFeedback = this.feedbackHistory.filter(
      f => now - f.timestamp.getTime() >= dayMs && now - f.timestamp.getTime() < 2 * dayMs
    );

    if (todayFeedback.length > 0 && yesterdayFeedback.length > 0) {
      trends.push(this.calculateTrend('day', todayFeedback, yesterdayFeedback));
    }

    // Weekly trend
    const thisWeekFeedback = this.feedbackHistory.filter(
      f => now - f.timestamp.getTime() < weekMs
    );
    const lastWeekFeedback = this.feedbackHistory.filter(
      f => now - f.timestamp.getTime() >= weekMs && now - f.timestamp.getTime() < 2 * weekMs
    );

    if (thisWeekFeedback.length >= 10 && lastWeekFeedback.length >= 10) {
      trends.push(this.calculateTrend('week', thisWeekFeedback, lastWeekFeedback));
    }

    // Monthly trend
    const thisMonthFeedback = this.feedbackHistory.filter(
      f => now - f.timestamp.getTime() < monthMs
    );
    const lastMonthFeedback = this.feedbackHistory.filter(
      f => now - f.timestamp.getTime() >= monthMs && now - f.timestamp.getTime() < 2 * monthMs
    );

    if (thisMonthFeedback.length >= 20 && lastMonthFeedback.length >= 20) {
      trends.push(this.calculateTrend('month', thisMonthFeedback, lastMonthFeedback));
    }

    return trends;
  }

  /**
   * Calculate trend for a period
   */
  private calculateTrend(
    period: 'day' | 'week' | 'month',
    current: Array<{ rating: number }>,
    previous: Array<{ rating: number }>
  ): FeedbackTrend {
    const currentAvg = current.reduce((sum, f) => sum + f.rating, 0) / current.length;
    const previousAvg = previous.reduce((sum, f) => sum + f.rating, 0) / previous.length;
    const changePercent = ((currentAvg - previousAvg) / previousAvg) * 100;

    let trend: 'improving' | 'stable' | 'declining';
    if (changePercent > 5) trend = 'improving';
    else if (changePercent < -5) trend = 'declining';
    else trend = 'stable';

    return {
      period,
      currentAvg,
      previousAvg,
      trend,
      changePercent: Math.round(changePercent * 10) / 10,
      sampleSize: current.length + previous.length
    };
  }

  /**
   * Get update recommendation based on feedback analysis
   */
  getUpdateRecommendation(): UpdateRecommendation {
    const stats = this.feedbackCollector.getStats();
    const trends = this.analyzeTrends();

    // Check if we have enough data
    if (stats.processed < this.updateThresholds.minSampleSize) {
      return {
        shouldUpdate: false,
        reason: `Insufficient data: ${stats.processed}/${this.updateThresholds.minSampleSize} samples collected`,
        priority: 'low',
        suggestedActions: ['Continue collecting feedback before making decisions']
      };
    }

    // Check for critical decline
    const weeklyTrend = trends.find(t => t.period === 'week');
    if (weeklyTrend && weeklyTrend.trend === 'declining' && weeklyTrend.changePercent < -this.updateThresholds.ratingDeclinePercent) {
      return {
        shouldUpdate: true,
        reason: `Weekly rating declined by ${Math.abs(weeklyTrend.changePercent)}%`,
        priority: 'critical',
        suggestedActions: [
          'Review recent negative feedback for common themes',
          'Check for recent system changes that may have caused regression',
          'Consider rollback if decline is severe',
          'Initiate fine-tuning with recent positive examples'
        ]
      };
    }

    // Check for low average rating
    if (stats.averageRating < this.updateThresholds.lowRatingThreshold) {
      return {
        shouldUpdate: true,
        reason: `Average rating (${stats.averageRating.toFixed(2)}) below threshold (${this.updateThresholds.lowRatingThreshold})`,
        priority: 'high',
        suggestedActions: [
          'Analyze top negative feedback categories',
          'Review and improve prompts for common failure cases',
          'Consider adding guardrails for problematic topics'
        ]
      };
    }

    // Check for high negative rate
    if (stats.negativeRate > 0.3) { // More than 30% negative
      return {
        shouldUpdate: true,
        reason: `High negative feedback rate: ${(stats.negativeRate * 100).toFixed(1)}%`,
        priority: 'medium',
        suggestedActions: [
          'Focus on reducing common failure patterns',
          'Review RAG retrieval quality',
          'Check for context window issues'
        ]
      };
    }

    // Check for improvement opportunity
    if (weeklyTrend && weeklyTrend.trend === 'improving') {
      return {
        shouldUpdate: false,
        reason: 'Model is performing well with improving trend',
        priority: 'low',
        suggestedActions: ['Continue monitoring', 'Document successful patterns for future reference']
      };
    }

    return {
      shouldUpdate: false,
      reason: 'Model performance is stable',
      priority: 'low',
      suggestedActions: ['Continue collecting feedback', 'Monitor for trend changes']
    };
  }

  /**
   * Check if model should be updated
   */
  shouldUpdate(): boolean {
    const recommendation = this.getUpdateRecommendation();
    return recommendation.shouldUpdate;
  }

  /**
   * Create new model version
   */
  createVersion(performance: ModelVersion['performance']): ModelVersion {
    const stats = this.feedbackCollector.getStats();
    const trends = this.analyzeTrends();
    const weeklyTrend = trends.find(t => t.period === 'week');

    const version: ModelVersion = {
      id: `model-${Date.now()}`,
      version: `v${this.versions.length + 1}`,
      createdAt: new Date(),
      performance: {
        ...performance,
        satisfactionScore: stats.averageRating / 5 // Normalize to 0-1
      },
      active: false,
      feedbackSummary: {
        totalFeedback: stats.processed,
        avgRating: stats.averageRating,
        trend: weeklyTrend?.trend || 'stable'
      }
    };

    this.versions.push(version);
    logger.info('Model version created', {
      versionId: version.id,
      version: version.version,
      satisfactionScore: version.performance.satisfactionScore
    });

    return version;
  }

  /**
   * Activate model version
   */
  activateVersion(versionId: string): void {
    if (this.currentVersion) {
      this.currentVersion.active = false;
    }

    const version = this.versions.find(v => v.id === versionId);
    if (version) {
      version.active = true;
      this.currentVersion = version;
      logger.info('Model version activated', { versionId, version: version.version });
    }
  }

  /**
   * Rollback to previous version
   */
  rollback(): ModelVersion | null {
    if (this.versions.length < 2) {
      logger.warn('Cannot rollback: only one version exists');
      return null;
    }

    const previous = this.versions[this.versions.length - 2];
    this.activateVersion(previous.id);

    logger.info('Rolled back to previous version', { versionId: previous.id });
    return previous;
  }

  /**
   * Get current version
   */
  getCurrentVersion(): ModelVersion | null {
    return this.currentVersion;
  }

  /**
   * Get version history
   */
  getVersions(): ModelVersion[] {
    return [...this.versions];
  }

  /**
   * Get comprehensive update status
   */
  getStatus(): {
    currentVersion: ModelVersion | null;
    recommendation: UpdateRecommendation;
    trends: FeedbackTrend[];
    feedbackStats: FeedbackStats;
  } {
    return {
      currentVersion: this.currentVersion,
      recommendation: this.getUpdateRecommendation(),
      trends: this.analyzeTrends(),
      feedbackStats: this.feedbackCollector.getStats()
    };
  }
}
