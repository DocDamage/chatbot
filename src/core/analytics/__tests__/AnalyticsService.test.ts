import { describe, expect, it, beforeEach } from '@jest/globals';
import { AnalyticsService } from '../AnalyticsService';

describe('RT-ANALYTICS-001: AnalyticsService Usage Patterns and Feedback Suite', () => {
  let analytics: AnalyticsService;

  beforeEach(() => {
    analytics = new AnalyticsService();
  });

  it('tracks events, user requests, model usage, and error metrics', () => {
    analytics.trackRequest({
      userId: 'u1',
      model: 'gpt-4o',
      intent: 'chat',
      latency: 250,
      success: true,
      query: 'hello world'
    });

    analytics.trackRequest({
      userId: 'u1',
      model: 'gpt-4o',
      intent: 'chat',
      latency: 500,
      success: false
    });

    const stats = analytics.getUsageStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.averageLatency).toBe(375);
    expect(stats.errorRate).toBe(50);
  });

  it('tracks user feedback and computes satisfaction scores', () => {
    analytics.recordFeedback({
      userId: 'u1',
      rating: 5,
      comment: 'Super fast and helpful!',
      categories: ['helpful', 'fast']
    });

    analytics.recordFeedback({
      userId: 'u1',
      rating: 3
    });

    const behavior = analytics.getUserBehavior('u1');
    expect(behavior?.satisfactionScore).toBe(0.8);

    const satisfaction = analytics.getSatisfactionMetrics();
    expect(satisfaction.totalFeedback).toBe(2);
    expect(satisfaction.averageRating).toBe(4);
  });

  it('computes query patterns and exports analytics data', () => {
    for (let i = 0; i < 5; i++) {
      analytics.trackRequest({
        userId: `u-${i}`,
        model: 'gpt-4o',
        intent: 'chat',
        latency: 100,
        success: true,
        query: 'machine learning roadmap'
      });
    }

    const exported = analytics.export();
    expect(exported.stats.totalRequests).toBe(5);
    expect(exported.patterns.mostCommon.length).toBeGreaterThan(0);
  });
});
