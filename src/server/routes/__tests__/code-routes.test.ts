import express from 'express';
import request from 'supertest';
import { createCodeRouter } from '../code';

function makeApp(extraServices: Record<string, unknown> = {}) {
  const app = express();
  const codingAgent = {
    handle: jest.fn().mockResolvedValue({ summary: 'ok', filesInspected: [] }),
    plan: jest.fn().mockResolvedValue({ steps: ['inspect files'] }),
    createPatch: jest.fn().mockResolvedValue({ diff: '' }),
    createStructuredPatch: jest.fn().mockReturnValue({ operations: [], diff: '', filesChanged: [], conflicts: [], applied: false }),
    applyStructuredPatch: jest.fn().mockReturnValue({ operations: [], diff: '', filesChanged: [], conflicts: [], applied: true }),
    repair: jest.fn().mockResolvedValue({ status: 'blocked', attempts: [], finalVerification: [], remainingRisks: [] }),
    verify: jest.fn().mockResolvedValue({ status: 'passed', commandsRun: [] }),
    review: jest.fn().mockResolvedValue({ findings: [] }),
    searchFiles: jest.fn().mockResolvedValue([{ path: 'src/index.ts' }]),
    getSymbols: jest.fn().mockResolvedValue([{ name: 'Index' }])
  };
  app.use(express.json());
  app.use(createCodeRouter({ codingAgent, ...extraServices }));
  return { app, codingAgent };
}

describe('code routes', () => {
  it('mounts code ask, review, verify, and search endpoints', async () => {
    const { app } = makeApp();

    await request(app).post('/api/code/ask').send({ message: 'where is x?' }).expect(200);
    await request(app).post('/api/code/review').send({ diff: 'diff --git a/a b/a' }).expect(200);
    await request(app).post('/api/code/verify').send({ commands: ['npm run type-check'] }).expect(403);
    await request(app).post('/api/code/verify').send({ mode: 'implement', commands: ['npm run type-check'] }).expect(200);
    await request(app).get('/api/code/files/search?q=index').expect(200);
    await request(app).get('/api/code/symbols?file=src/index.ts').expect(200);
  });

  it('allows planning only from plan mode', async () => {
    const { app, codingAgent } = makeApp();

    await request(app).post('/api/code/plan').send({ mode: 'chat', message: 'plan this' }).expect(403);
    await request(app).post('/api/code/plan').set('x-work-mode', 'plan').send({ message: 'plan this' }).expect(200);

    expect(codingAgent.plan).toHaveBeenCalledTimes(1);
  });

  it('blocks patch generation outside implement mode', async () => {
    const { app, codingAgent } = makeApp();

    await request(app).post('/api/code/patch').send({ mode: 'plan', message: 'change a file' }).expect(403);
    await request(app).post('/api/code/patch').send({ mode: 'debug', message: 'change a file' }).expect(403);
    await request(app).post('/api/code/patch').set('x-work-mode', 'implement').send({ message: 'change a file' }).expect(200);

    expect(codingAgent.createPatch).toHaveBeenCalledTimes(1);
  });

  it('allows verification only from implement or debug mode', async () => {
    const { app, codingAgent } = makeApp();

    await request(app).post('/api/code/verify').send({ mode: 'chat', commands: ['npm run type-check'] }).expect(403);
    await request(app).post('/api/code/verify').send({ mode: 'plan', commands: ['npm run type-check'] }).expect(403);
    await request(app).post('/api/code/verify').send({ mode: 'implement', commands: ['npm run type-check'] }).expect(200);
    await request(app).post('/api/code/verify').send({ mode: 'debug', commands: ['npm test'] }).expect(200);

    expect(codingAgent.verify).toHaveBeenCalledTimes(2);
  });

  it('passes a configured non-template coding adapter to structured patch drafting', async () => {
    const adapter = { getModelName: () => 'configured-coder' };
    const { app, codingAgent } = makeApp({ codingModelAdapter: adapter });

    await request(app).post('/api/code/ask').send({ message: 'implement the requested fix' }).expect(200);
    expect(codingAgent.handle).toHaveBeenCalledWith(expect.objectContaining({ modelAdapter: adapter, model: 'configured-coder', generatePatch: true }));
  });

  it('requires explicit approval before applying a structured patch', async () => {
    const { app, codingAgent } = makeApp();
    const operations = [{ operation: 'create', path: 'src/new.ts', content: 'export const ok = true;', reason: 'requested module', authorized: true }];

    await request(app).post('/api/code/patch/apply').send({ mode: 'implement', operations }).expect(403);
    await request(app).post('/api/code/patch/apply').send({ mode: 'implement', approved: true, operations: [{ ...operations[0], authorized: false }] }).expect(403);
    await request(app).post('/api/code/patch/apply').send({ mode: 'implement', approved: true, operations }).expect(200);
    expect(codingAgent.createStructuredPatch).toHaveBeenCalledWith(operations);
    expect(codingAgent.applyStructuredPatch).toHaveBeenCalledWith(expect.anything(), 'implement');
  });

  it('requires debug authorization and explicit approval for bounded repair', async () => {
    const { app, codingAgent } = makeApp();
    const operations = [{ operation: 'modify', path: 'src/app.ts', content: 'fixed', expectedContent: 'broken', reason: 'diagnostic repair', authorized: true }];

    await request(app).post('/api/code/repair').send({ mode: 'implement', approved: true, operations }).expect(403);
    await request(app).post('/api/code/repair').send({ mode: 'debug', operations }).expect(403);
    await request(app).post('/api/code/repair').send({ mode: 'debug', approved: true, operations }).expect(200);
    expect(codingAgent.repair).toHaveBeenCalledWith(expect.objectContaining({ mode: 'debug', operations }));
  });
});
