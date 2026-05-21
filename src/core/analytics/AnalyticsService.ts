/**
 * Analytics Service - Track usage patterns, collect feedback, and generate insights
 */

import { logger } from '../observability/logger';

export interface AnalyticsEvent {
  type: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface UsageStats {
  totalRequests: number;
  requestsByModel: Map<string, number>;
  requestsByIntent: Map<string, number>;
  requestsByUser: Map<string, number>;
  averageLatency: number;
  errorRate: number;
  peakUsage: { timestamp: Date; requests: number };
  popularQueries: Array<{ query: string; count: number }>;
}

export interface UserBehavior {
  userId: string;
  totalSessions: number;
  averageSessionLength: number;
  preferredTimeOfDay: string[];
  commonIntents: string[];
  satisfactionScore: number;
  feedbackCount: number;
  lastFeedback?: UserFeedback;
}

export interface UserFeedback {
  userId: string;
  sessionId?: string;
  rating: number; // 1-5
  comment?: string;
  messageId?: string;
  timestamp: Date;
  categories?: string[]; // 'helpful', 'accurate', 'fast', etc.
}

export interface TrendData {
  query: string;
  currentCount: number;
  previousCount: number;
  growth: number; // percentage
  growthRate: 'rising' | 'stable' | 'falling';
}

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private maxEvents: number = 10000;
  private queryCounts: Map<string, number> = new Map();
  private queryTimeframes: Map<string, number[]> = new Map(); // query -> timestamps
  private modelUsage: Map<string, number> = new Map();
  private intentUsage: Map<string, number> = new Map();
  private userUsage: Map<string, number> = new Map();
  private latencies: number[] = [];
  private errors: number = 0;
  private requests: number = 0;
  private hourlyRequests: Map<number, number> = new Map();

  // Feedback tracking
  private feedbackStore: Map<string, UserFeedback[]> = new Map(); // userId -> feedbacks
  private globalFeedback: UserFeedback[] = [];
  private satisfactionScores: Map<string, number[]> = new Map(); // userId -> ratings

  /**
   * Track an event
   */
  track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.updateAggregations(fullEvent);
  }

  /**
   * Track a chat request
   */
  trackRequest(data: {
    userId?: string;
    sessionId?: string;
    model: string;
    intent: string;
    latency: number;
    success: boolean;
    query?: string;
  }): void {
    this.requests++;

    if (!data.success) {
      this.errors++;
    }

    this.modelUsage.set(
      data.model,
      (this.modelUsage.get(data.model) || 0) + 1
    );

    this.intentUsage.set(
      data.intent,
      (this.intentUsage.get(data.intent) || 0) + 1
    );

    if (data.userId) {
      this.userUsage.set(
        data.userId,
        (this.userUsage.get(data.userId) || 0) + 1
      );
    }

    this.latencies.push(data.latency);
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }

    if (data.query) {
      const normalized = data.query.toLowerCase().trim();
      this.queryCounts.set(
        normalized,
        (this.queryCounts.get(normalized) || 0) + 1
      );

      // Track query timestamps for trending analysis
      const timestamps = this.queryTimeframes.get(normalized) || [];
      timestamps.push(Date.now());
      // Keep only last 24 hours
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.queryTimeframes.set(
        normalized,
        timestamps.filter(t => t > oneDayAgo)
      );
    }

    const hour = new Date().getHours();
    this.hourlyRequests.set(
      hour,
      (this.hourlyRequests.get(hour) || 0) + 1
    );

    this.track({
      type: 'request',
      userId: data.userId,
      sessionId: data.sessionId,
      metadata: {
        model: data.model,
        intent: data.intent,
        latency: data.latency,
        success: data.success,
      },
    });
  }

  /**
   * Record user feedback
   */
  recordFeedback(feedback: Omit<UserFeedback, 'timestamp'>): void {
    const fullFeedback: UserFeedback = {
      ...feedback,
      timestamp: new Date()
    };

    // Store globally
    this.globalFeedback.push(fullFeedback);
    if (this.globalFeedback.length > 5000) {
      this.globalFeedback.shift();
    }

    // Store per user
    if (feedback.userId) {
      const userFeedback = this.feedbackStore.get(feedback.userId) || [];
      userFeedback.push(fullFeedback);
      this.feedbackStore.set(feedback.userId, userFeedback);

      // Update satisfaction scores
      const scores = this.satisfactionScores.get(feedback.userId) || [];
      scores.push(feedback.rating);
      // Keep last 20 ratings
      if (scores.length > 20) scores.shift();
      this.satisfactionScores.set(feedback.userId, scores);
    }

    this.track({
      type: 'feedback',
      userId: feedback.userId,
      sessionId: feedback.sessionId,
      metadata: {
        rating: feedback.rating,
        categories: feedback.categories
      }
    });

    logger.info('Feedback recorded', {
      userId: feedback.userId,
      rating: feedback.rating
    });
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): UsageStats {
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;

    const errorRate = this.requests > 0
      ? (this.errors / this.requests) * 100
      : 0;

    let peakHour = 0;
    let peakRequests = 0;
    for (const [hour, requests] of this.hourlyRequests.entries()) {
      if (requests > peakRequests) {
        peakRequests = requests;
        peakHour = hour;
      }
    }

    const popularQueries = Array.from(this.queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalRequests: this.requests,
      requestsByModel: new Map(this.modelUsage),
      requestsByIntent: new Map(this.intentUsage),
      requestsByUser: new Map(this.userUsage),
      averageLatency: avgLatency,
      errorRate,
      peakUsage: {
        timestamp: new Date(new Date().setHours(peakHour, 0, 0, 0)),
        requests: peakRequests,
      },
      popularQueries,
    };
  }

  /**
   * Get user behavior insights with real satisfaction scoring
   */
  getUserBehavior(userId: string): UserBehavior | null {
    const userEvents = this.events.filter(e => e.userId === userId);
    if (userEvents.length === 0) return null;

    const sessions = new Set(userEvents.map(e => e.sessionId)).size;
    const intents = userEvents
      .filter(e => e.metadata.intent)
      .map(e => e.metadata.intent);

    const intentCounts = new Map<string, number>();
    for (const intent of intents) {
      intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
    }

    const commonIntents = Array.from(intentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent]) => intent);

    const hours = userEvents.map(e => e.timestamp.getHours());
    const timeOfDay = hours.map(h =>
      h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
    );
    const preferredTimeOfDay = Array.from(new Set(timeOfDay));

    // Calculate real satisfaction score from feedback
    const userScores = this.satisfactionScores.get(userId) || [];
    const satisfactionScore = userScores.length > 0
      ? userScores.reduce((a, b) => a + b, 0) / userScores.length / 5 // Normalize to 0-1
      : 0.5; // Default to neutral if no feedback

    // Get feedback data
    const userFeedback = this.feedbackStore.get(userId) || [];

    return {
      userId,
      totalSessions: sessions,
      averageSessionLength: userEvents.length / sessions,
      preferredTimeOfDay,
      commonIntents,
      satisfactionScore,
      feedbackCount: userFeedback.length,
      lastFeedback: userFeedback.length > 0 ? userFeedback[userFeedback.length - 1] : undefined
    };
  }

  /**
   * Get query pattern analysis with real trending data
   */
  getQueryPatterns(): {
    mostCommon: Array<{ query: string; count: number }>;
    trending: TrendData[];
  } {
    const mostCommon = Array.from(this.queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    // Calculate real trending based on timeframe comparison
    const now = Date.now();
    const sixHoursAgo = now - 6 * 60 * 60 * 1000;
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;

    const trending: TrendData[] = [];

    for (const [query, timestamps] of this.queryTimeframes.entries()) {
      const currentPeriod = timestamps.filter(t => t > sixHoursAgo).length;
      const previousPeriod = timestamps.filter(t => t > twelveHoursAgo && t <= sixHoursAgo).length;

      if (currentPeriod > 0 || previousPeriod > 0) {
        const growth = previousPeriod > 0
          ? ((currentPeriod - previousPeriod) / previousPeriod) * 100
          : currentPeriod > 0 ? 100 : 0;

        let growthRate: 'rising' | 'stable' | 'falling';
        if (growth > 20) growthRate = 'rising';
        else if (growth < -20) growthRate = 'falling';
        else growthRate = 'stable';

        trending.push({
          query,
          currentCount: currentPeriod,
          previousCount: previousPeriod,
          growth: Math.round(growth),
          growthRate
        });
      }
    }

    // Sort by growth rate
    trending.sort((a, b) => b.growth - a.growth);

    return { mostCommon, trending: trending.slice(0, 10) };
  }

  /**
   * Get overall satisfaction metrics
   */
  getSatisfactionMetrics(): {
    averageRating: number;
    totalFeedback: number;
    ratingDistribution: Record<number, number>;
    categoryBreakdown: Record<string, number>;
    recentTrend: 'improving' | 'stable' | 'declining';
  } {
    const ratings = this.globalFeedback.map(f => f.rating);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const rating of ratings) {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    }

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const feedback of this.globalFeedback) {
      if (feedback.categories) {
        for (const cat of feedback.categories) {
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
        }
      }
    }

    // Recent trend - compare last 50 to previous 50
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (this.globalFeedback.length >= 20) {
      const recent = this.globalFeedback.slice(-10).map(f => f.rating);
      const previous = this.globalFeedback.slice(-20, -10).map(f => f.rating);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

      const diff = recentAvg - prevAvg;
      if (diff > 0.3) recentTrend = 'improving';
      else if (diff < -0.3) recentTrend = 'declining';
    }

    return {
      averageRating,
      totalFeedback: this.globalFeedback.length,
      ratingDistribution,
      categoryBreakdown,
      recentTrend
    };
  }

  /**
   * Update aggregations from event
   */
  private updateAggregations(event: AnalyticsEvent): void {
    // Additional aggregation logic can go here
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.events = [];
    this.queryCounts.clear();
    this.queryTimeframes.clear();
    this.modelUsage.clear();
    this.intentUsage.clear();
    this.userUsage.clear();
    this.latencies = [];
    this.errors = 0;
    this.requests = 0;
    this.hourlyRequests.clear();
    this.feedbackStore.clear();
    this.globalFeedback = [];
    this.satisfactionScores.clear();
    logger.info('Analytics data cleared');
  }

  /**
   * Export analytics data
   */
  export(): {
    stats: UsageStats;
    satisfaction: ReturnType<AnalyticsService['getSatisfactionMetrics']>;
    patterns: ReturnType<AnalyticsService['getQueryPatterns']>;
  } {
    return {
      stats: this.getUsageStats(),
      satisfaction: this.getSatisfactionMetrics(),
      patterns: this.getQueryPatterns()
    };
  }
}
