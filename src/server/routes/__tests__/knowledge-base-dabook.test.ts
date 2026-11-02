import express from 'express';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { resetDabookBridgeForTests } from '../../../core/dabook';
import { DocumentManager } from '../../../core/rag/DocumentManager';
import { createKnowledgeBaseRouter } from '../knowledge-base';

const appWith = (services: Record<string, unknown>) => {
  const app = express();
  app.use(express.json());
  app.use(createKnowledgeBaseRouter(services));
  return app;
};

describe('GET /api/knowledge-base/dabook/health', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetDabookBridgeForTests();
  });

  it('returns the bridge health, shallow by default', async () => {
    const health = jest.fn().mockResolvedValue({ enabled: true, available: true, status: 'ready', version: '1.1.0' });
    const response = await request(appWith({ dabookBridge: { health } })).get('/api/knowledge-base/dabook/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ready', version: '1.1.0' });
    expect(health).toHaveBeenCalledWith({ deep: false, force: false });
  });

  it('supports ?deep=true (run `dabook doctor`) and ?refresh=1 (bypass the probe cache)', async () => {
    const health = jest.fn().mockResolvedValue({ status: 'ready' });
    const app = appWith({ dabookBridge: { health } });
    await request(app).get('/api/knowledge-base/dabook/health?deep=true&refresh=1');
    expect(health).toHaveBeenCalledWith({ deep: true, force: true });
    await request(app).get('/api/knowledge-base/dabook/health?deep=nope');
    expect(health).toHaveBeenLastCalledWith({ deep: false, force: false });
  });

  it('works without any wiring: the shared bridge reports what is missing', async () => {
    delete process.env.DABOOK_ENABLED;
    process.env.DABOOK_PYTHON = path.join(os.tmpdir(), 'no-such-dir', 'python.exe');
    process.env.CHATBOT_NATIVE_PYTHON = path.join(os.tmpdir(), 'no-such-dir', 'python2.exe');
    resetDabookBridgeForTests();

    const response = await request(appWith({})).get('/api/knowledge-base/dabook/health?refresh=true');

    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(false);
    expect(response.body.candidates.map((c: any) => c.source)).toEqual(expect.arrayContaining(['DABOOK_PYTHON', 'CHATBOT_NATIVE_PYTHON']));
    expect(['disabled', 'unavailable']).toContain(response.body.status);
  });

  it('surfaces a failing probe as an error response, not a hang', async () => {
    const health = jest.fn().mockRejectedValue(new Error('probe exploded'));
    const response = await request(appWith({ dabookBridge: { health } })).get('/api/knowledge-base/dabook/health');
    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});

describe('knowledge base stats report the PDF extractor', () => {
  const saved = process.env.DABOOK_ENABLED;
  afterEach(() => {
    if (saved === undefined) delete process.env.DABOOK_ENABLED;
    else process.env.DABOOK_ENABLED = saved;
  });

  it.each([
    ['true', 'dabook'],
    [undefined, 'pdf-parse'],
    ['false', 'pdf-parse']
  ])('DABOOK_ENABLED=%s -> %s', async (flag, extractor) => {
    if (flag === undefined) delete process.env.DABOOK_ENABLED;
    else process.env.DABOOK_ENABLED = flag;
    const stats = await new DocumentManager({} as any).getStats();
    expect(stats.pdfExtractor).toBe(extractor);
  });
});
