import { ModelUpdater } from '../ModelUpdater';
import { FeedbackCollector } from '../FeedbackCollector';

describe('RT-LEARN-001: ModelUpdater Continuous Feedback & Version Rollback Suite', () => {
  let collector: FeedbackCollector;
  let updater: ModelUpdater;

  beforeEach(() => {
    collector = new FeedbackCollector();
    updater = new ModelUpdater(collector);
  });

  it('tracks feedback events and computes trend analysis', () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Collect historical feedback
    for (let i = 0; i < 30; i++) {
      collector.collect({
        responseId: `resp-old-${i}`,
        userId: 'u1',
        sessionId: 's1',
        rating: 5,
        timestamp: new Date(now - 1.5 * dayMs)
      });
    }

    // Collect recent feedback
    for (let i = 0; i < 30; i++) {
      collector.collect({
        responseId: `resp-today-${i}`,
        userId: 'u1',
        sessionId: 's1',
        rating: 4.8,
        timestamp: new Date(now - 0.2 * dayMs)
      });
    }

    const trends = updater.analyzeTrends();
    expect(trends.length).toBeGreaterThan(0);
    expect(['improving', 'stable', 'declining']).toContain(trends[0].trend);
  });

  it('provides update recommendations based on feedback volume and ratings', () => {
    // 1. Initial recommendation with empty history
    const initialRec = updater.getUpdateRecommendation();
    expect(initialRec.shouldUpdate).toBe(false);
    expect(updater.shouldUpdate()).toBe(false);

    // 2. Add high volume low rating feedback
    for (let i = 0; i < 60; i++) {
      collector.collect({
        responseId: `bad-resp-${i}`,
        userId: 'u1',
        sessionId: 's1',
        rating: 2.0,
        timestamp: new Date()
      });
    }

    const badRec = updater.getUpdateRecommendation();
    expect(badRec.shouldUpdate).toBe(true);
    expect(badRec.priority).toBe('high');
    expect(badRec.suggestedActions.length).toBeGreaterThan(0);
    expect(updater.shouldUpdate()).toBe(true);
  });

  it('manages model versions, active state transitions, rollbacks, and status diagnostics', () => {
    // Rollback with zero versions
    expect(updater.rollback()).toBeNull();

    const v1 = updater.createVersion({ accuracy: 0.85, latency: 120, cost: 0.002 });
    expect(v1.id).toBeDefined();

    updater.activateVersion(v1.id);
    expect(updater.getCurrentVersion()?.id).toBe(v1.id);

    // Rollback with one version
    expect(updater.rollback()).toBeNull();

    const v2 = updater.createVersion({ accuracy: 0.92, latency: 95, cost: 0.0018 });
    updater.activateVersion(v2.id);
    expect(updater.getCurrentVersion()?.id).toBe(v2.id);

    const history = updater.getVersions();
    expect(history).toHaveLength(2);

    const rolledBack = updater.rollback();
    expect(rolledBack?.id).toBe(v1.id);
    expect(updater.getCurrentVersion()?.id).toBe(v1.id);

    const status = updater.getStatus();
    expect(status.currentVersion?.id).toBe(v1.id);
    expect(status.recommendation).toBeDefined();
    expect(status.feedbackStats).toBeDefined();
  });
});
