import { describe, expect, it, beforeEach } from '@jest/globals';
import { UserProfiler } from '../UserProfiler';

describe('RT-PROF-001: UserProfiler Behavioral Modeling and Adaptation Suite', () => {
  let profiler: UserProfiler;

  beforeEach(() => {
    profiler = new UserProfiler();
  });

  it('creates default profile and records interactions', async () => {
    const profile = profiler.getProfile('user-42');
    expect(profile.userId).toBe('user-42');
    expect(profile.history.totalInteractions).toBe(0);

    // Record interaction with technical content
    await profiler.updateProfile('user-42', {
      message: 'How do I implement a distributed Raft consensus algorithm in TypeScript with async/await?',
      intent: 'coding',
      sessionLength: 120000,
      satisfaction: 5
    });

    const updated = profiler.getProfile('user-42');
    expect(updated.history.totalInteractions).toBe(1);
    expect(updated.behavior.commonIntents).toContain('coding');
    expect(updated.history.recentMessages).toHaveLength(1);
  });

  it('generates personalization hints and profile stats', async () => {
    await profiler.updateProfile('user-dev', {
      message: 'Explain memory management in nodejs with examples',
      intent: 'learning',
      satisfaction: 4
    });

    const hints = profiler.getPersonalizationHints('user-dev');
    expect(hints).toBeDefined();
    expect(hints.greetingStyle).toBeDefined();

    const stats = profiler.getStats();
    expect(stats.totalProfiles).toBe(1);
    expect(stats.averageSatisfaction).toBe(4);
  });
});
