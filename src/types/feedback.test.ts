/**
 * Unit Tests for Canonical Feedback Schemas (CRK-P16-T02, T03, T05)
 */

import {
  feedbackEventSchema,
  feedbackTraceBindingMetadataSchema,
  enrichedFeedbackRecordSchema,
  evaluationCandidateRecordSchema,
} from './feedback';

describe('Canonical Feedback Schemas', () => {
  it('validates canonical FeedbackEvent with 11 standard categories (CRK-P16-T02)', () => {
    const event = {
      id: 'fb-001',
      responseId: 'resp-001',
      requestId: 'req-001',
      sessionId: 'sess-001',
      userId: 'usr-001',
      thumbs: 'down' as const,
      categories: ['outdated' as const, 'wrong_source' as const],
      comment: 'Referenced Godot 3 syntax instead of Godot 4.',
      createdAt: new Date().toISOString(),
    };

    const parsed = feedbackEventSchema.parse(event);
    expect(parsed.id).toBe('fb-001');
    expect(parsed.categories).toContain('outdated');
    expect(parsed.thumbs).toBe('down');
  });

  it('validates FeedbackTraceBindingMetadata without private prompt duplication (§2845, CRK-P16-T03)', () => {
    const traceMeta = {
      promptVersion: 'prompt-v2.1',
      botProfileVersion: 'profile-v1.0',
      model: 'claude-3-5-sonnet',
      provider: 'anthropic',
      modelPolicy: 'coding_high_reasoning',
      contextPlanId: 'cp-01',
      retrievalPolicy: 'retrieval-v1.4',
      selectedDatasetVersions: { 'godot-docs': '4.7' },
      toolResults: [{ toolName: 'file_read', status: 'success', durationMs: 45 }],
      latencyMs: 380,
      validationWarnings: [],
    };

    const parsed = feedbackTraceBindingMetadataSchema.parse(traceMeta);
    expect(parsed.model).toBe('claude-3-5-sonnet');
    expect(parsed.selectedDatasetVersions['godot-docs']).toBe('4.7');
    // Ensure full private prompts are not in trace binding schema
    expect((parsed as any).fullPrompt).toBeUndefined();
    expect((parsed as any).rawUserPrompt).toBeUndefined();
  });

  it('validates EvaluationCandidateRecord for regression loop (CRK-P16-T05)', () => {
    const candidate = {
      id: 'eval-cand-01',
      feedbackId: 'fb-001',
      responseId: 'resp-001',
      sessionId: 'sess-001',
      failureCategories: ['outdated' as const],
      status: 'candidate' as const,
      createdAt: new Date().toISOString(),
    };

    const parsed = evaluationCandidateRecordSchema.parse(candidate);
    expect(parsed.status).toBe('candidate');
  });
});
