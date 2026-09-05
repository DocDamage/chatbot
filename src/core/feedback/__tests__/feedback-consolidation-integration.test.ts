/**
 * Feedback Consolidation Integration Suite & Phase 16 Exit Gate
 *
 * Verifies canonical feedback collection, legacy collector adaptation, trace binding,
 * non-training invariant enforcement, and privacy deletion.
 */

import { CanonicalFeedbackService } from '../CanonicalFeedbackService';
import { FeedbackTraceBinding } from '../FeedbackTraceBinding';
import { FeedbackTriageService } from '../FeedbackTriageService';
import { FeedbackCollectorAdapter } from '../FeedbackCollectorAdapter';
import { ChatRuntimeResult, ChatContextPlan } from '../../../types/chat-runtime';

describe('CRK Phase 16: Feedback Consolidation Exit Gate', () => {
  let service: CanonicalFeedbackService;
  let traceBinding: FeedbackTraceBinding;
  let triageService: FeedbackTriageService;

  beforeEach(() => {
    traceBinding = new FeedbackTraceBinding();
    triageService = new FeedbackTriageService();
    service = new CanonicalFeedbackService(undefined, traceBinding, triageService);
  });

  it('Exit Gate Criterion 1: One canonical feedback service exists and ingests valid events (CRK-P16-T02)', async () => {
    const record = await service.submitFeedback({
      event: {
        responseId: 'resp-canonical-101',
        requestId: 'req-canonical-101',
        sessionId: 'sess-001',
        userId: 'usr-alice',
        thumbs: 'up',
        rating: 5,
        comment: 'Accurate and fast response.',
      },
      traceContext: {
        promptVersion: 'prompt-v2.1',
        botProfileVersion: 'profile-v1.0',
      },
    });

    expect(record.id).toBeDefined();
    expect(record.event.thumbs).toBe('up');
    expect(record.trace.promptVersion).toBe('prompt-v2.1');

    const fetched = service.getFeedbackByResponse('resp-canonical-101');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].id).toBe(record.id);
  });

  it('Exit Gate Criterion 2: Old collectors are adapted via FeedbackCollectorAdapter (CRK-P16-T01)', async () => {
    const adapter = new FeedbackCollectorAdapter(service);

    await adapter.adaptExplicit({
      responseId: 'resp-legacy-202',
      requestId: 'req-legacy-202',
      sessionId: 'sess-legacy',
      thumbsDown: true,
      rating: 1,
      categories: ['outdated', 'bad_code'],
      comment: 'Used deprecated API from version 3.',
    });

    const records = service.getFeedbackByResponse('resp-legacy-202');
    expect(records).toHaveLength(1);
    expect(records[0].event.thumbs).toBe('down');
    expect(records[0].event.categories).toContain('outdated');
    expect(records[0].event.categories).toContain('bad_code');

    // Implicit feedback adaptation records without fine-tuning
    adapter.adaptImplicit({ responseId: 'resp-legacy-202', sessionId: 'sess-legacy' });
  });

  it('Exit Gate Criterion 3: Feedback is bound to immutable trace versions without private prompt duplication (§2845, CRK-P16-T03)', async () => {
    const mockResult: Partial<ChatRuntimeResult> = {
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        policy: 'coding_high_reasoning',
        fallbackUsed: false,
      },
      citations: [
        {
          id: 'cit-01',
          sourceId: 'src-docs',
          datasetId: 'godot-docs',
          title: 'Godot Docs',
          version: '4.7',
          chunkId: 'chk-01',
        },
      ],
      toolResults: [
        { toolCallId: 'tc-1', toolName: 'test_runner', status: 'success', durationMs: 120 },
      ],
      latencyMs: 512,
      warnings: ['Token count close to ceiling'],
    };

    const mockPlan: Partial<ChatContextPlan> = {
      traceId: 'trc-plan-303',
      modelStrategy: { policy: 'coding_high_reasoning' },
    };

    const record = await service.submitFeedback({
      event: {
        responseId: 'resp-trace-bound-303',
        requestId: 'req-trace-bound-303',
        sessionId: 'sess-002',
        thumbs: 'down',
        categories: ['instruction_failure'],
      },
      traceContext: {
        result: mockResult,
        plan: mockPlan,
        promptVersion: 'prompt-envelope-v2.1',
        botProfileVersion: 'default-profile-v1.0',
      },
    });

    expect(record.trace.model).toBe('claude-3-5-sonnet');
    expect(record.trace.provider).toBe('anthropic');
    expect(record.trace.modelPolicy).toBe('coding_high_reasoning');
    expect(record.trace.selectedDatasetVersions['godot-docs']).toBe('4.7');
    expect(record.trace.toolResults[0].toolName).toBe('test_runner');
    expect(record.trace.latencyMs).toBe(512);

    // Invariant: Full private user prompt is strictly omitted
    expect((record.trace as any).fullPrompt).toBeUndefined();
    expect((record.trace as any).rawPrompt).toBeUndefined();
  });

  it('Exit Gate Criterion 4: Feedback cannot directly self-train production behavior (§2872-2892, CRK-P16-T05)', async () => {
    // Assert no auto training check executes cleanly
    expect(() => triageService.assertNoAutoTraining()).not.toThrow();

    // Submit negative feedback
    await service.submitFeedback({
      event: {
        responseId: 'resp-neg-404',
        requestId: 'req-neg-404',
        sessionId: 'sess-003',
        thumbs: 'down',
        rating: 1,
        categories: ['bad_code', 'incorrect'],
        comment: 'Code has an off-by-one error.',
      },
    });

    // Verification: Triage service generated an evaluation candidate, NOT a fine-tuning job
    const candidates = triageService.getCandidates('candidate');
    expect(candidates.length).toBeGreaterThanOrEqual(1);

    const match = candidates.find(c => c.responseId === 'resp-neg-404');
    expect(match).toBeDefined();
    expect(match?.failureCategories).toContain('bad_code');

    // Promotion to regression dataset
    const promoted = triageService.promoteToRegression(match!.id, 'Verified off-by-one error regression test added');
    expect(promoted.status).toBe('regression_added');
  });

  it('Exit Gate Criterion 5: Privacy deletion purges feedback by session and user (§2894, CRK-P16-T06)', async () => {
    await service.submitFeedback({
      event: {
        responseId: 'resp-del-1',
        requestId: 'req-del-1',
        sessionId: 'sess-purge',
        userId: 'usr-bob',
        thumbs: 'up',
      },
    });

    await service.submitFeedback({
      event: {
        responseId: 'resp-del-2',
        requestId: 'req-del-2',
        sessionId: 'sess-other',
        userId: 'usr-bob',
        thumbs: 'down',
      },
    });

    // Purge by session
    const deletedSessions = await service.deleteFeedbackBySession('sess-purge');
    expect(deletedSessions).toBe(1);
    expect(service.getFeedbackByResponse('resp-del-1')).toHaveLength(0);

    // Purge by user
    const deletedUsers = await service.deleteFeedbackByUser('usr-bob');
    expect(deletedUsers).toBe(1);
    expect(service.getFeedbackByResponse('resp-del-2')).toHaveLength(0);
  });
});
