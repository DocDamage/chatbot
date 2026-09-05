import {
  ApiClientVersionSchema,
  LegacyChatRequestSchema,
} from './api-compatibility';

describe('API Compatibility Types & Schemas', () => {
  it('validates client API versions', () => {
    expect(ApiClientVersionSchema.safeParse('v1_legacy').success).toBe(true);
    expect(ApiClientVersionSchema.safeParse('v2_canonical').success).toBe(true);
    expect(ApiClientVersionSchema.safeParse('v2_canary').success).toBe(true);
    expect(ApiClientVersionSchema.safeParse('v999').success).toBe(false);
  });

  it('validates legacy chat request payloads', () => {
    const validPayload = {
      prompt: 'What is the system status?',
      userId: 'user-123',
      sessionId: 'sess-456',
      options: {
        model: 'gemini-1.5-pro',
        useRag: true,
      },
    };
    expect(LegacyChatRequestSchema.safeParse(validPayload).success).toBe(true);

    const alternativeFieldPayload = {
      message: 'Hello bot',
      conversationId: 'conv-789',
    };
    expect(LegacyChatRequestSchema.safeParse(alternativeFieldPayload).success).toBe(true);
  });
});
