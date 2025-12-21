/**
 * Analytics Service - Track usage patterns and generate insights
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
}

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private maxEvents: number = 10000; // Keep last 10k events
  private queryCounts: Map<string, number> = new Map();
  private modelUsage: Map<string, number> = new Map();
  private intentUsage: Map<string, number> = new Map();
  private userUsage: Map<string, number> = new Map();
  private latencies: number[] = [];
  private errors: number = 0;
  private requests: number = 0;
  private hourlyRequests: Map<number, number> = new Map();

  /**
   * Track an event
   */
  track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Maintain max events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update aggregations
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

    // Track model usage
    this.modelUsage.set(
      data.model,
      (this.modelUsage.get(data.model) || 0) + 1
    );

    // Track intent usage
    this.intentUsage.set(
      data.intent,
      (this.intentUsage.get(data.intent) || 0) + 1
    );

    // Track user usage
    if (data.userId) {
      this.userUsage.set(
        data.userId,
        (this.userUsage.get(data.userId) || 0) + 1
      );
    }

    // Track latency
    this.latencies.push(data.latency);
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }

    // Track query popularity
    if (data.query) {
      const normalized = data.query.toLowerCase().trim();
      this.queryCounts.set(
        normalized,
        (this.queryCounts.get(normalized) || 0) + 1
      );
    }

    // Track hourly usage
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
   * Get usage statistics
   */
  getUsageStats(): UsageStats {
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;

    const errorRate = this.requests > 0
      ? (this.errors / this.requests) * 100
      : 0;

    // Find peak usage hour
    let peakHour = 0;
    let peakRequests = 0;
    for (const [hour, requests] of this.hourlyRequests.entries()) {
      if (requests > peakRequests) {
        peakRequests = requests;
        peakHour = hour;
      }
    }

    // Get popular queries
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
   * Get user behavior insights
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

    return {
      userId,
      totalSessions: sessions,
      averageSessionLength: userEvents.length / sessions,
      preferredTimeOfDay,
      commonIntents,
      satisfactionScore: 0.8, // Placeholder - would come from feedback
    };
  }

  /**
   * Get query pattern analysis
   */
  getQueryPatterns(): {
    mostCommon: Array<{ query: string; count: number }>;
    trending: Array<{ query: string; growth: number }>;
  } {
    const mostCommon = Array.from(this.queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    // Simple trending (would need time-based tracking for real trending)
    const trending = mostCommon.slice(0, 5).map(q => ({
      query: q.query,
      growth: 0, // Placeholder
    }));

    return { mostCommon, trending };
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
    this.modelUsage.clear();
    this.intentUsage.clear();
    this.userUsage.clear();
    this.latencies = [];
    this.errors = 0;
    this.requests = 0;
    this.hourlyRequests.clear();
    logger.info('Analytics data cleared');
  }
}

