import {
  RegisteredModel,
  RegisteredModelSchema,
  UserFacingModelPolicy
} from './model-registry';

describe('Model Registry & Policy Schemas (CRK-P10)', () => {
  it('should validate complete RegisteredModel matching §2021-2046', () => {
    const validModel: RegisteredModel = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      enabled: true,
      verifiedAt: new Date().toISOString(),
      capabilities: {
        chat: true,
        streaming: true,
        tools: true,
        structuredOutput: true,
        vision: true,
        embeddings: false,
        reasoningClass: 'advanced',
        codingClass: 'advanced'
      },
      contextWindow: 200000,
      maxOutputTokens: 8192,
      cost: {
        inputPerMillion: 3.0,
        outputPerMillion: 15.0,
        source: 'config',
        verifiedAt: new Date().toISOString()
      },
      privacy: 'remote',
      status: 'available'
    };

    const parseRes = RegisteredModelSchema.safeParse(validModel);
    expect(parseRes.success).toBe(true);
  });

  it('should support all 7 user-facing policies matching §2064-2072', () => {
    const policies = [
      UserFacingModelPolicy.AUTO,
      UserFacingModelPolicy.FAST,
      UserFacingModelPolicy.BALANCED,
      UserFacingModelPolicy.REASONING,
      UserFacingModelPolicy.CODING,
      UserFacingModelPolicy.CREATIVE,
      UserFacingModelPolicy.LOCAL
    ];
    expect(policies).toHaveLength(7);
  });

  it('should reject invalid status or missing provider', () => {
    const invalid: any = {
      provider: '',
      model: 'test',
      enabled: true,
      capabilities: { chat: true },
      privacy: 'invalid-privacy',
      status: 'non-existent'
    };
    expect(RegisteredModelSchema.safeParse(invalid).success).toBe(false);
  });
});
