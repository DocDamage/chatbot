import { DebugInfo, DebugMode } from '../debug/DebugMode';
import {
  SafetyValidator,
  SchemaValidator,
  ToneValidator,
  ValidationPipeline,
} from '../validator/Validators';
import { ProvenanceLedger } from '../provenance/ProvenanceLedger';
import { AlertingSystem } from '../../observability/alerts';
import { TracingService } from '../../observability/tracing';
import { QuickRepliesService } from '../suggestions/QuickReplies';
import { CustomInstructionsService } from '../user/CustomInstructions';
import { PredictiveCache } from '../cache/PredictiveCache';

function debugInfo(requestId: string, timestamp: Date): DebugInfo {
  return {
    requestId,
    timestamp,
    request: { message: `message-${requestId}` },
    processing: { model: 'test-model', usedRAG: false, cacheHit: false },
    response: { content: 'ok', latency: 5 },
    performance: { totalTime: 5 },
  };
}

describe('branch coverage tail services', () => {
  const originalDebugMode = process.env.DEBUG_MODE;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalDebugMode === undefined) delete process.env.DEBUG_MODE;
    else process.env.DEBUG_MODE = originalDebugMode;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('covers debug enablement, disabled logging, development logging, eviction, sorting, and clearing', () => {
    const debug = new DebugMode();
    const early = debugInfo('early', new Date('2026-01-01T00:00:00Z'));
    const late = debugInfo('late', new Date('2026-01-02T00:00:00Z'));

    debug.log(early);
    expect(debug.getDebugInfo('early')).toBeUndefined();
    expect(debug.isEnabled()).toBe(false);

    process.env.DEBUG_MODE = 'true';
    expect(debug.isEnabled()).toBe(true);
    process.env.NODE_ENV = 'development';
    (debug as unknown as { maxLogs: number }).maxLogs = 1;
    debug.log(early);
    debug.log(late);

    expect(debug.getDebugInfo('early')).toBeUndefined();
    expect(debug.getDebugInfo('late')).toEqual(late);
    expect(debug.getRecentLogs()).toEqual([late]);
    expect(debug.getRecentLogs(0)).toEqual([]);

    debug.disable();
    delete process.env.DEBUG_MODE;
    expect(debug.isEnabled()).toBe(false);
    debug.enable();
    expect(debug.isEnabled()).toBe(true);
    debug.clear();
    expect(debug.getRecentLogs()).toEqual([]);
  });

  it('covers safety, tone, schema, and pipeline validation decisions', () => {
    const safety = new SafetyValidator();
    expect(safety.validate('Violence and harmful illegal instructions').warnings).toHaveLength(3);
    expect(safety.validate('ordinary text')).toEqual({ valid: true, errors: [], warnings: [] });

    const tone = new ToneValidator();
    expect(tone.validate('OMG, lol', 'professional').warnings).toContain(
      'Content may be too casual for professional tone',
    );
    expect(tone.validate('Good afternoon', 'professional').warnings).toEqual([]);
    expect(tone.validate('lol', 'casual').warnings).toEqual([]);

    const schema = new SchemaValidator();
    expect(schema.validate('{"ok":true}', 'json').valid).toBe(true);
    expect(schema.validate('{bad json', 'json')).toEqual({
      valid: false,
      errors: ['Invalid JSON format'],
      warnings: [],
    });
    expect(schema.validate('plain', 'plain').valid).toBe(true);

    const pipeline = new ValidationPipeline();
    const result = pipeline.validate('This is harmful, lol', 'professional');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });

  it('covers provenance defaults, optional references, quarantine, and canon updates', () => {
    const ledger = new ProvenanceLedger();
    const contract = { version: '1.0.0' } as any;
    const first = ledger.createRecord(
      'artifact-1',
      'text' as any,
      'content',
      contract,
      'model-a',
      {},
    );
    const second = ledger.createRecord(
      'artifact-2',
      'text' as any,
      'other content',
      contract,
      'model-b',
      { temperature: 0 },
      'user',
      ['memory-1'],
      ['retrieval-1'],
    );

    expect(first.author).toBe('system');
    expect(first.prompt_hash).toHaveLength(16);
    expect(second.memory_refs).toEqual(['memory-1']);
    expect(ledger.getRecord('missing')).toBeUndefined();

    ledger.quarantine('missing', 'ignored');
    ledger.quarantine('artifact-1');
    expect(ledger.getRecord('artifact-1')?.metadata).toBeUndefined();
    ledger.quarantine('artifact-2', 'policy');
    expect(ledger.getRecord('artifact-2')?.metadata).toEqual({ quarantine_reason: 'policy' });

    ledger.updateCanonLevel('missing', 'CANON');
    ledger.updateCanonLevel('artifact-1', 'CANON');
    expect(ledger.getRecord('artifact-1')?.canon_level).toBe('CANON');
  });

  it('covers alert conditions, condition failures, resolution, and severity filtering', () => {
    const alerts = new AlertingSystem();
    alerts.registerRule({
      id: 'high',
      name: 'High load',
      severity: 'critical',
      message: 'Load exceeded',
      condition: metrics => metrics.load > 0.9,
    });
    alerts.registerRule({
      id: 'false',
      name: 'Never',
      severity: 'info',
      message: 'No',
      condition: () => false,
    });
    alerts.registerRule({
      id: 'throws',
      name: 'Broken',
      severity: 'warning',
      message: 'Broken rule',
      condition: () => {
        throw new Error('metric unavailable');
      },
    });

    const triggered = alerts.check({ load: 1 });
    expect(triggered).toHaveLength(1);
    expect(triggered[0]).toMatchObject({ severity: 'critical', resolved: false });
    expect(triggered[0].metadata).toEqual({ metrics: { load: 1 } });
    expect(alerts.getAlertsBySeverity('warning')).toEqual([]);

    alerts.resolve('missing');
    alerts.resolve(triggered[0].id);
    expect(alerts.getActiveAlerts()).toEqual([]);
    expect(alerts.getAlertsBySeverity('critical')).toEqual([]);
  });

  it('covers trace creation, repeated traces, missing spans, merged attributes, and missing traces', () => {
    const tracing = new TracingService();
    const first = tracing.startTrace('trace-1', 'first');
    const second = tracing.startTrace('trace-1', 'second', { input: true });

    tracing.endSpan('missing');
    tracing.endSpan(first.id);
    tracing.endSpan(second.id, { output: true });

    const spans = tracing.getTrace('trace-1');
    expect(spans).toHaveLength(2);
    expect(spans[0].attributes).toEqual({});
    expect(spans[1].attributes).toEqual({ input: true, output: true });
    expect(spans.every(span => span.endTime !== undefined)).toBe(true);
    expect(tracing.getTrace('missing')).toEqual([]);
  });

  it('covers quick-reply parsing, type inference, context, caching, and fallback', async () => {
    const generate = jest.fn().mockResolvedValue({
      content: [
        '1. filtered numbered item',
        '- What should I do next?',
        '* Show the details',
        'A useful suggestion',
        `${'x'.repeat(100)}`,
        '',
      ].join('\n'),
    });
    const service = new QuickRepliesService({ generate } as any);

    const replies = await service.generateQuickReplies('message', 'response', ['one', 'two', 'three', 'four']);
    expect(replies.map(reply => reply.type)).toEqual(['question', 'action', 'suggestion']);
    expect(generate.mock.calls[0][0].prompt).toContain('two\nthree\nfour');

    expect(await service.generateQuickReplies('message', 'response')).toBe(replies);
    expect(generate).toHaveBeenCalledTimes(1);

    generate.mockRejectedValueOnce(new Error('provider down'));
    const fallback = await service.generateQuickReplies('different', 'response');
    expect(fallback).toHaveLength(3);
    expect(fallback.every(reply => reply.confidence === 0.5)).toBe(true);
  });

  it('covers quick-reply cache eviction and prompt generation without context', async () => {
    const generate = jest.fn().mockResolvedValue({ content: 'How does this work?' });
    const service = new QuickRepliesService({ generate } as any);

    for (let index = 0; index <= 100; index += 1) {
      await service.generateQuickReplies(`unique-${index.toString().padStart(3, '0')}`, 'response');
    }

    expect(generate).toHaveBeenCalledTimes(101);
    expect(generate.mock.calls[0][0].prompt).not.toContain('Recent context:');
    await service.generateQuickReplies('unique-000', 'response');
    expect(generate).toHaveBeenCalledTimes(102);
  });

  it('covers custom-instruction defaults, database load/cache, persistence, and prompt options', async () => {
    const row = {
      user_id: 'db-user',
      instructions: 'Prefer concrete examples.',
      preferences: JSON.stringify({
        responseStyle: 'detailed',
        tone: 'professional',
        includeExamples: true,
        includeCitations: true,
        maxLength: 400,
      }),
      context_rules: JSON.stringify({
        rememberPreviousConversations: false,
        includeRelevantHistory: false,
        maxHistoryTurns: 0,
      }),
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const query = jest.fn().mockResolvedValueOnce({ rows: [row] }).mockResolvedValue({ rows: [] });
    const service = new CustomInstructionsService({ query } as any);

    const loaded = await service.getInstructions('db-user');
    expect(await service.getInstructions('db-user')).toBe(loaded);
    expect(query).toHaveBeenCalledTimes(1);

    const prompt = service.buildSystemPrompt('Base', loaded);
    expect(prompt).toContain('Prefer concrete examples.');
    expect(prompt).toContain('Max length: 400 tokens');
    expect(prompt).toContain('Include examples when helpful');
    expect(prompt).toContain('Include citations for factual claims');

    const updated = await service.updateInstructions('db-user', { instructions: '' });
    expect(updated.instructions).toBe('');
    expect(query).toHaveBeenCalledTimes(2);

    const defaults = await new CustomInstructionsService().getInstructions('new-user');
    const defaultPrompt = service.buildSystemPrompt('Base', defaults);
    expect(defaultPrompt).not.toContain('User-specific instructions:');
    expect(defaultPrompt).not.toContain('Max length:');
    expect(defaultPrompt).not.toContain('Include examples when helpful');
  });

  it('fails open to defaults when custom-instruction database operations reject', async () => {
    const query = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const service = new CustomInstructionsService({ query } as any);

    const defaults = await service.getInstructions('fallback-user');
    expect(defaults.userId).toBe('fallback-user');
    const updated = await service.updateInstructions('fallback-user', { instructions: 'Keep going.' });
    expect(updated.instructions).toBe('Keep going.');
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('covers predictive cache history limits, prediction modes, and background success/failure', async () => {
    const set = jest.fn();
    const cache = new PredictiveCache({ set } as any);
    for (let index = 0; index <= 1000; index += 1) {
      cache.recordQuery(index === 1000 ? 'what is testing' : `history ${index}`);
    }

    expect(cache.predictNextQueries('what is testing', 2)).toEqual([
      'how does testing',
      'why is testing',
    ]);
    expect(cache.predictNextQueries('how testing', 1)).toHaveLength(1);
    expect(cache.predictNextQueries('unrelated', 2)).toEqual([]);

    const generate = jest.fn(async (query: string) => {
      if (query.startsWith('why')) throw new Error('skip one');
      return `response:${query}`;
    });
    await cache.preCache('what is testing', generate);
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(generate).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith('how does testing', 'response:how does testing');
  });
});
