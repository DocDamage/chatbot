import { SafetyPipeline } from './SafetyPipeline';

describe('SafetyPipeline', () => {
  it('reports unsupported factual claims as warnings without treating them as unsafe content', async () => {
    const adapter = {
      generate: jest.fn(),
      estimateCost: jest.fn().mockReturnValue(0),
      getModelName: jest.fn().mockReturnValue('test-model')
    };
    const pipeline = new SafetyPipeline(adapter as any);

    (pipeline as any).selfCheck = {
      check: jest.fn().mockResolvedValue({ safe: true, confidence: 0.9, issues: [], reasoning: 'safe' })
    };
    (pipeline as any).constitutional = {
      check: jest.fn().mockResolvedValue({ compliant: true, violations: [], reasoning: 'compliant' })
    };
    (pipeline as any).toxicityDetector = {
      detect: jest.fn().mockReturnValue({ toxic: false, score: 0, categories: [] })
    };
    (pipeline as any).biasMitigator = {
      detect: jest.fn().mockReturnValue({ biased: false, score: 0, detectedBiases: [], suggestions: [] })
    };
    (pipeline as any).uncertaintyQuantifier = {
      quantify: jest.fn().mockResolvedValue({
        confidence: 0.6,
        uncertainty: 0.4,
        factors: { knowledge: 0.6, certainty: 0.6, sourceQuality: 0.4 },
        explanation: 'limited local evidence'
      })
    };
    (pipeline as any).factChecker = {
      check: jest.fn().mockResolvedValue({
        verified: false,
        confidence: 0.2,
        claims: [{ claim: 'A historical claim', verified: false, confidence: 0.2 }]
      })
    };

    const result = await pipeline.check('A harmless historical answer about 1997.', true);

    expect(result.safe).toBe(true);
    expect(result.warnings).toContain('Some facts could not be verified');
  });
});
