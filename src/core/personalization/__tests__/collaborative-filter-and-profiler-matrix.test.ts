import { UserProfiler, UserProfile } from '../UserProfiler';
import { CollaborativeFilter } from '../CollaborativeFilter';

describe('B75-07: CollaborativeFilter and UserProfiler Decision Matrix', () => {
  let profiler: UserProfiler;
  let filter: CollaborativeFilter;

  beforeEach(() => {
    profiler = new UserProfiler();
    filter = new CollaborativeFilter(profiler);
  });

  function createMockProfile(userId: string, topics: string[], style: 'formal' | 'casual' | 'technical' | 'friendly' = 'friendly', length: 'short' | 'medium' | 'long' = 'medium'): UserProfile {
    return {
      userId,
      preferences: {
        communicationStyle: style,
        responseLength: length,
        topics,
        detailedExplanations: true,
        codeExamples: true
      },
      behavior: {
        averageSessionLength: 10,
        preferredTimeOfDay: ['morning'],
        interactionFrequency: 5,
        commonIntents: ['ask_question'],
        averageMessageLength: 25,
        questionsAsked: 10,
        topicsDiscussed: topics.map(t => ({ topic: t, interestScore: 0.8, count: 5, lastMentioned: new Date(), sentiment: 'positive' as const }))
      },
      history: {
        totalInteractions: 10,
        firstSeen: new Date(),
        lastSeen: new Date(),
        satisfactionScore: 0.9,
        recentMessages: []
      },
      insights: {
        expertiseLevel: 'intermediate',
        primaryInterests: topics,
        communicationPatterns: [],
        sentimentTrend: 'positive'
      },
      metadata: {}
    };
  }

  it('finds similar users and calculates shared preferences accurately', () => {
    (profiler as any).profiles.set('user1', createMockProfile('user1', ['coding', 'music', 'gaming'], 'friendly', 'short'));
    (profiler as any).profiles.set('user2', createMockProfile('user2', ['coding', 'music', 'ai'], 'friendly', 'short'));
    (profiler as any).profiles.set('user3', createMockProfile('user3', ['cooking', 'gardening'], 'formal', 'long'));

    const similar = filter.findSimilarUsers('user1', 5);
    expect(similar.length).toBe(2);
    expect(similar[0].userId).toBe('user2');
    expect(similar[0].similarity).toBeGreaterThan(similar[1].similarity);
    expect(similar[0].sharedPreferences).toContain('coding');
  });

  it('generates recommendations based on aggregated preferences or defaults for empty profiles', () => {
    const defaultRecs = filter.getRecommendations('nonexistent_user');
    expect(defaultRecs.style).toBe('friendly');
    expect(defaultRecs.responseLength).toBe('medium');

    (profiler as any).profiles.set('userA', createMockProfile('userA', ['tech', 'startups']));
    (profiler as any).profiles.set('userB', createMockProfile('userB', ['tech', 'startups', 'crypto'], 'technical', 'long'));

    const recs = filter.getRecommendations('userA', 3);
    expect(recs.topics).toBeDefined();
    expect(recs.style).toBeDefined();
  });

  it('updates profile communication style, expertise, satisfaction, and exports profile', async () => {
    const profilerInstance = new UserProfiler();

    // Technical expert message
    await profilerInstance.updateProfile('u_expert', {
      message: 'Can you optimize the distributed consensus benchmark and analyze race conditions in the memory architecture? Please include code examples.',
      intent: 'code_optimization',
      satisfaction: 0.95,
      sessionLength: 15,
      timestamp: new Date()
    });

    const expertProfile = profilerInstance.getProfile('u_expert');
    expect(expertProfile.preferences.codeExamples).toBe(true);
    expect(['technical', 'formal']).toContain(expertProfile.preferences.communicationStyle);
    expect(['advanced', 'expert']).toContain(expertProfile.insights.expertiseLevel);
    expect(expertProfile.behavior.averageSessionLength).toBe(15);
    expect(expertProfile.history.satisfactionScore).toBeGreaterThan(0.8);

    // Beginner friendly message
    await profilerInstance.updateProfile('u_beginner', {
      message: "Hey there! I am new to coding, what is a variable? Could you explain simply for a beginner?",
      intent: 'learning',
      satisfaction: 0.3,
      sessionLength: 5,
      timestamp: new Date()
    });

    const beginnerProfile = profilerInstance.getProfile('u_beginner');
    expect(beginnerProfile.insights.expertiseLevel).toBe('beginner');
    expect(beginnerProfile.insights.sentimentTrend).toBe('negative');

    // Get prompt / export
    expect(expertProfile.history.recentMessages.length).toBe(1);
    expect(beginnerProfile.behavior.commonIntents).toContain('learning');
  });
});
