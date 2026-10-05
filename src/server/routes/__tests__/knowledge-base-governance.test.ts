import express from 'express';
import request from 'supertest';
import { DabookError, TrainingExportError } from '../../../core/dabook';
import { createKnowledgeBaseRouter } from '../knowledge-base';

const PAIR = 'a1b2c3d4e5f60718';

function app(services: Record<string, unknown>) {
  const server = express();
  server.use(express.json());
  server.use(createKnowledgeBaseRouter(services));
  return server;
}

describe('DABOOK governance routes', () => {
  const bridge = {
    listBooks: jest.fn(),
    setLicense: jest.fn(),
    reviewSample: jest.fn(),
    reviewDecision: jest.fn(),
    reviewBook: jest.fn(),
    recompile: jest.fn()
  };
  const exporter = { export: jest.fn() };
  const client = () => request(app({ dabookBridge: bridge, trainingExporter: exporter }));

  beforeEach(() => {
    for (const fn of [...Object.values(bridge), exporter.export]) fn.mockReset();
  });

  it('GET /books returns the governance view', async () => {
    bridge.listBooks.mockResolvedValue({ books: [{ book_id: 1 }], policy: { quality_verified: 0.95 } });
    const response = await client().get('/api/knowledge-base/dabook/books');
    expect(response.status).toBe(200);
    expect(response.body.books).toEqual([{ book_id: 1 }]);
  });

  it('POST /license passes a valid status through and rejects the rest before any process runs', async () => {
    bridge.setLicense.mockResolvedValue({ book_id: 1, license_status: 'owned' });
    const ok = await client().post('/api/knowledge-base/dabook/license').send({ book: 'abc123', status: 'owned' });
    expect(ok.status).toBe(200);
    expect(bridge.setLicense).toHaveBeenCalledWith('abc123', 'owned');

    for (const body of [{ book: 'abc123', status: 'stolen' }, { book: '--help', status: 'owned' }, { book: '   ', status: 'owned' }, { status: 'owned' }, {}]) {
      const bad = await client().post('/api/knowledge-base/dabook/license').send(body);
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('invalid_request');
    }
    expect(bridge.setLicense).toHaveBeenCalledTimes(1);
  });

  it('GET /review/sample validates and coerces its query', async () => {
    bridge.reviewSample.mockResolvedValue({ sample: [] });
    await client().get('/api/knowledge-base/dabook/review/sample?book=abc123&n=5&seed=9').expect(200);
    expect(bridge.reviewSample).toHaveBeenCalledWith('abc123', { count: 5, seed: 9 });
    await client().get('/api/knowledge-base/dabook/review/sample?book=abc123');
    expect(bridge.reviewSample).toHaveBeenLastCalledWith('abc123', { count: 10, seed: 42 });
    for (const query of ['', 'book=abc&n=0', 'book=abc&n=500', 'book=abc&n=x', 'book=-x']) {
      expect((await client().get(`/api/knowledge-base/dabook/review/sample?${query}`)).status).toBe(400);
    }
  });

  it('POST /review/decision only accepts well-formed pair ids and decisions', async () => {
    bridge.reviewDecision.mockResolvedValue({ action: 'reject' });
    await client().post('/api/knowledge-base/dabook/review/decision').send({ book: 'abc123', pairId: PAIR, decision: 'reject', reason: 'wrong' }).expect(200);
    expect(bridge.reviewDecision).toHaveBeenCalledWith('abc123', PAIR, 'reject', 'wrong');
    for (const body of [
      { book: 'abc123', pairId: 'short', decision: 'reject' },
      { book: 'abc123', pairId: `${PAIR}; rm -rf /`, decision: 'reject' },
      { book: 'abc123', pairId: PAIR, decision: 'maybe' },
      { book: 'abc123', pairId: PAIR, decision: 'reject', reason: 'x'.repeat(501) }
    ]) {
      expect((await client().post('/api/knowledge-base/dabook/review/decision').send(body)).status).toBe(400);
    }
  });

  it('POST /review/book and /recompile', async () => {
    bridge.reviewBook.mockResolvedValue({ review_status: 'approved' });
    bridge.recompile.mockResolvedValue({ replanned: { pending: 1 } });
    await client().post('/api/knowledge-base/dabook/review/book').send({ book: 'abc123', status: 'approved' }).expect(200);
    await client().post('/api/knowledge-base/dabook/recompile').send({ book: 'abc123' }).expect(200);
    expect(bridge.reviewBook).toHaveBeenCalledWith('abc123', 'approved');
    expect(bridge.recompile).toHaveBeenCalledWith('abc123');
    expect((await client().post('/api/knowledge-base/dabook/review/book').send({ book: 'abc123', status: 'maybe' })).status).toBe(400);
  });

  describe('POST /training-export', () => {
    it('applies defaults and returns the bundle', async () => {
      exporter.export.mockResolvedValue({ bundleDir: 'D', manifest: { schema: 'dabook.export.v1' } });
      const response = await client().post('/api/knowledge-base/dabook/training-export').send({});
      expect(response.status).toBe(200);
      expect(response.body.bundleDir).toBe('D');
      expect(exporter.export).toHaveBeenCalledWith({ modes: ['sft'], formats: ['jsonl'] });
    });

    it('passes a full request through', async () => {
      exporter.export.mockResolvedValue({ bundleDir: 'D', manifest: {} });
      await client().post('/api/knowledge-base/dabook/training-export')
        .send({ books: ['1', 'abc123'], modes: ['sft', 'code'], formats: ['jsonl', 'parquet'], includeHeuristic: false, splits: true }).expect(200);
      expect(exporter.export).toHaveBeenCalledWith({ books: ['1', 'abc123'], modes: ['sft', 'code'], formats: ['jsonl', 'parquet'], includeHeuristic: false, splits: true });
    });

    it.each([
      [{ modes: ['rag'] }],
      [{ modes: [] }],
      [{ formats: ['csv'] }],
      [{ books: ['--output=/etc'] }],
      [{ books: 'not-an-array' }]
    ])('rejects an invalid request %j before exporting', async body => {
      const response = await client().post('/api/knowledge-base/dabook/training-export').send(body);
      expect(response.status).toBe(400);
      expect(exporter.export).not.toHaveBeenCalled();
    });

    it.each([
      ['unknown_book', 404, 'export_blocked'],
      ['blocked', 403, 'export_blocked'],
      ['no_books', 409, 'export_blocked'],
      ['contaminated', 409, 'contaminated']
    ] as const)('maps %s to HTTP %i', async (code, status, error) => {
      exporter.export.mockRejectedValue(new TrainingExportError(code, `${code} message`, { blocked: { 'Book 1': ['license is copyrighted'] } }));
      const response = await client().post('/api/knowledge-base/dabook/training-export').send({});
      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ error, code, message: `${code} message`, details: { blocked: { 'Book 1': ['license is copyrighted'] } } });
    });

    it('maps DABOOK failures (including its own license gate) to typed statuses', async () => {
      const cases: Array<[ConstructorParameters<typeof DabookError>[0], number]> = [
        ['export_blocked', 403], ['lock_held', 423], ['timeout', 504], ['interpreter_not_found', 503], ['bad_args', 400], ['failed', 502]
      ];
      for (const [reason, status] of cases) {
        exporter.export.mockRejectedValueOnce(new DabookError(reason, `${reason}!`, { blocked: { B: ['why'] } }));
        const response = await client().post('/api/knowledge-base/dabook/training-export').send({});
        expect(response.status).toBe(status);
        expect(response.body.error).toBe(reason);
      }
    });

    it('lets unexpected errors reach the error handler (500)', async () => {
      exporter.export.mockRejectedValue(new Error('unexpected'));
      const response = await client().post('/api/knowledge-base/dabook/training-export').send({});
      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });

  it('builds a default exporter on the shared bridge when none is wired', async () => {
    bridge.listBooks.mockResolvedValue({
      policy: { training_licenses: ['owned'], quality_verified: 0.95, review_statuses: [] },
      books: [{ book_id: 1, sha256: 'a'.repeat(64), source_path: 'x', state: 'done', license_status: 'copyrighted', quality_score: 1, warnings: [], datasets: {}, counts: {} }]
    });
    const response = await request(app({ dabookBridge: bridge })).post('/api/knowledge-base/dabook/training-export').send({ books: ['1'] });
    expect(response.status).toBe(403); // copyrighted: refused by the real TrainingExporter, end to end
    expect(response.body.details.blocked['x'] ?? response.body.details.blocked[Object.keys(response.body.details.blocked)[0]]).toBeDefined();
  });
});
