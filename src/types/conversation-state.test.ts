import {
  conversationVariableSchema,
  conversationStateSchema,
  turnContextSchema,
  sessionMemorySchema,
  userMemoryItemSchema,
  episodicMemoryItemSchema,
  supportedVariableKeySchema,
} from './conversation-state';

describe('conversation-state schemas', () => {
  it('validates supported variable keys', () => {
    expect(supportedVariableKeySchema.parse('framework')).toBe('framework');
    expect(supportedVariableKeySchema.parse('frameworkVersion')).toBe('frameworkVersion');
    expect(supportedVariableKeySchema.parse('repository')).toBe('repository');
    expect(() => supportedVariableKeySchema.parse('unsupportedKey')).toThrow();
  });

  it('validates a valid ConversationVariable', () => {
    const variable = {
      key: 'framework',
      value: 'Godot',
      confidence: 1.0,
      sourceTurnId: 'turn-1',
      source: 'explicit' as const,
      updatedAt: new Date().toISOString(),
    };
    const parsed = conversationVariableSchema.parse(variable);
    expect(parsed.key).toBe('framework');
    expect(parsed.value).toBe('Godot');
    expect(parsed.confidence).toBe(1.0);
    expect(parsed.source).toBe('explicit');
  });

  it('rejects invalid confidence range', () => {
    expect(() =>
      conversationVariableSchema.parse({
        key: 'framework',
        value: 'Godot',
        confidence: 1.5,
        sourceTurnId: 'turn-1',
        source: 'explicit',
        updatedAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it('validates UserMemory requires userApproved = true', () => {
    const valid = {
      key: 'favoriteTheme',
      value: 'dark',
      userApproved: true as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(userMemoryItemSchema.parse(valid).userApproved).toBe(true);

    expect(() =>
      userMemoryItemSchema.parse({
        ...valid,
        userApproved: false,
      })
    ).toThrow();
  });

  it('validates full ConversationState hierarchy', () => {
    const state = {
      sessionId: 'sess-123',
      variables: {
        framework: {
          key: 'framework',
          value: 'Godot',
          confidence: 0.95,
          sourceTurnId: 'turn-1',
          source: 'explicit' as const,
          updatedAt: new Date().toISOString(),
        },
      },
      sessionMemory: {
        sessionId: 'sess-123',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        maxHistoryTurns: 50,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = conversationStateSchema.parse(state);
    expect(parsed.sessionId).toBe('sess-123');
    expect(parsed.variables.framework.value).toBe('Godot');
  });
});
