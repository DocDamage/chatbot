import { GroundingDecision, RecommendedAction } from './grounding-eval';

describe('GroundingEval Types', () => {
  it('should validate recommendedAction union variants', () => {
    const actions: RecommendedAction[] = [
      'answer',
      'broaden-local',
      'search-online',
      'ask-clarification',
      'abstain',
    ];
    expect(actions).toHaveLength(5);
    expect(actions).toContain('abstain');
    expect(actions).toContain('broaden-local');
  });

  it('should construct valid GroundingDecision', () => {
    const decision: GroundingDecision = {
      attempted: true,
      sufficient: true,
      confidence: 0.88,
      reasons: ['High authority official documentation match'],
      recommendedAction: 'answer',
      features: {
        topScore: 0.92,
        scoreMargin: 0.25,
        sourceAuthority: 0.95,
        sourceDiversity: 2,
        versionCompatibility: 1.0,
        relevantChunkCount: 3,
        queryCoverage: 0.85,
        conflictingEvidence: false,
      },
    };

    expect(decision.sufficient).toBe(true);
    expect(decision.recommendedAction).toBe('answer');
    expect(decision.features?.topScore).toBe(0.92);
  });
});
