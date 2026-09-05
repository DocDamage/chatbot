import { chatRunRecordSchema, failureTaxonomyCodeSchema } from './chat-diagnostics';

describe('chat-diagnostics schemas', () => {
  it('validates a complete chat run record with stage timings', () => {
    const record = {
      requestId: 'req-diag-1',
      traceId: 'tr-diag-1',
      sessionId: 'sess-diag-1',
      startedAt: new Date().toISOString(),
      status: 'success',
      taskType: 'CODING_DEBUG',
      intent: 'fix_bug',
      botProfileVersion: 'profile-v1',
      contextPlanSummary: { packsUsed: ['core-official-docs', 'developer-qa'] },
      modelPolicyVersion: 'model-policy-v1',
      selectedModel: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        fallbackUsed: false,
      },
      selectedSourceIds: ['src-1', 'src-2'],
      toolCallIds: ['tool-git-1'],
      validationCodes: ['TOOL_CLAIM_OK', 'GROUNDING_SUFFICIENT'],
      stageTimings: {
        normalizeMs: 4,
        contextPlanningMs: 15,
        retrievalMs: 45,
        generationMs: 650,
        validationMs: 12,
      },
      latencyMs: 726,
    };

    const parsed = chatRunRecordSchema.parse(record);
    expect(parsed.requestId).toBe('req-diag-1');
    expect(parsed.stageTimings.retrievalMs).toBe(45);
  });

  it('validates failure taxonomy codes', () => {
    expect(failureTaxonomyCodeSchema.parse('GROUNDING_INSUFFICIENT')).toBe('GROUNDING_INSUFFICIENT');
    expect(failureTaxonomyCodeSchema.parse('MODEL_RATE_LIMITED')).toBe('MODEL_RATE_LIMITED');
    expect(() => failureTaxonomyCodeSchema.parse('RANDOM_ERROR')).toThrow();
  });
});
