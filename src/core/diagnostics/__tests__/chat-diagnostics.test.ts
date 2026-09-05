import { ChatDiagnosticsService } from '../ChatDiagnosticsService';
import { ChatRunRepository } from '../ChatRunRepository';
import { createDiagnosticsRouter } from '../../../server/routes/chat-diagnostics';

describe('Phase 23: Chat Diagnostics Service & Repository', () => {
  it('records run lifecycle with stage timings and successful completion', () => {
    const service = new ChatDiagnosticsService();
    const run = service.startRun({
      requestId: 'req-test-100',
      traceId: 'tr-test-100',
      sessionId: 'sess-test-100',
      taskType: 'CODING_DEBUG',
      intent: 'debug_error',
    });

    expect(run.status).toBe('success');
    expect(run.taskType).toBe('CODING_DEBUG');

    service.recordStageTiming('req-test-100', 'normalizeMs', 5);
    service.recordStageTiming('req-test-100', 'retrievalMs', 35);
    service.recordStageTiming('req-test-100', 'generationMs', 450);

    const finished = service.finishRunSuccess('req-test-100', {
      selectedModel: { provider: 'anthropic', model: 'claude-3-5-sonnet', fallbackUsed: false },
      selectedSourceIds: ['doc-1'],
      validationCodes: ['TOOL_CLAIM_OK'],
      latencyMs: 490,
    });

    expect(finished).not.toBeNull();
    expect(finished?.stageTimings.retrievalMs).toBe(35);
    expect(finished?.latencyMs).toBe(490);
    expect(finished?.completedAt).toBeDefined();
  });

  it('classifies failures into normalized failure taxonomy', () => {
    const service = new ChatDiagnosticsService();

    service.startRun({
      requestId: 'req-test-err-1',
      traceId: 'tr-1',
      sessionId: 'sess-1',
      taskType: 'general_chat',
    });

    const failedRun = service.finishRunFailure(
      'req-test-err-1',
      new Error('Rate limit exceeded: 429 Too Many Requests')
    );

    expect(failedRun?.status).toBe('failed');
    expect(failedRun?.failureCode).toBe('MODEL_RATE_LIMITED');

    expect(service.classifyErrorToTaxonomy('Request timed out after 30000ms')).toBe('MODEL_TIMEOUT');
    expect(service.classifyErrorToTaxonomy('Unauthorized user session')).toBe('AUTH_BLOCKED');
    expect(service.classifyErrorToTaxonomy('insufficient evidence to answer query')).toBe('GROUNDING_INSUFFICIENT');
    expect(service.classifyErrorToTaxonomy('Tool blocked by policy')).toBe('TOOL_BLOCKED');
  });

  it('strictly sanitizes secrets and internal reasoning from diagnostics records (§3433)', () => {
    const repo = new ChatRunRepository();
    const rawRecord: any = {
      requestId: 'req-secret-test',
      traceId: 'tr-secret-test',
      sessionId: 'sess-secret',
      startedAt: new Date().toISOString(),
      status: 'success',
      taskType: 'test',
      modelPolicyVersion: 'v1',
      contextPlanSummary: {
        packs: ['pack-1'],
        user_token: 'secret_user_jwt_123',
        api_key: 'sk-prod-999',
        chain_of_thought: 'internal hidden reasoning trace',
      },
      selectedSourceIds: [],
      toolCallIds: [],
      validationCodes: [],
      stageTimings: {},
    };

    const saved = repo.save(rawRecord);
    expect((saved.contextPlanSummary as any).packs).toEqual(['pack-1']);
    expect((saved.contextPlanSummary as any).user_token).toBeUndefined();
    expect((saved.contextPlanSummary as any).api_key).toBeUndefined();
    expect((saved.contextPlanSummary as any).chain_of_thought).toBeUndefined();
  });

  it('serves diagnostic reports via express router', () => {
    const service = new ChatDiagnosticsService();
    service.startRun({
      requestId: 'req-api-test',
      traceId: 'tr-api-test',
      sessionId: 'sess-api',
      taskType: 'CODING_DEBUG',
    });

    const router = createDiagnosticsRouter(service);
    expect(router).toBeDefined();

    const mockRes: any = {
      status: function (code: number) {
        this.statusCode = code;
        return this;
      },
      json: function (payload: any) {
        this.body = payload;
        return this;
      },
    };

    // Test existing run
    (router as any).handle(
      { method: 'GET', url: '/chat-runs/req-api-test', params: { requestId: 'req-api-test' }, headers: {} },
      mockRes,
      () => {}
    );

    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.body.success).toBe(true);
    expect(mockRes.body.data.requestId).toBe('req-api-test');

    // Test non-existing run
    const notFoundRes: any = {
      status: function (code: number) {
        this.statusCode = code;
        return this;
      },
      json: function (payload: any) {
        this.body = payload;
        return this;
      },
    };

    (router as any).handle(
      { method: 'GET', url: '/chat-runs/unknown-id', params: { requestId: 'unknown-id' }, headers: {} },
      notFoundRes,
      () => {}
    );

    expect(notFoundRes.statusCode).toBe(404);
    expect(notFoundRes.body.error).toBe('RUN_NOT_FOUND');
  });
});
