import express from 'express';
import request from 'supertest';
import { createCodeRouter } from '../code';

function makeApp() {
  const app = express();
  const codingAgent = {
    handle: jest.fn().mockResolvedValue({ summary: 'ok', filesInspected: [] }),
    plan: jest.fn().mockResolvedValue({ steps: ['inspect files'] }),
    createPatch: jest.fn().mockResolvedValue({ diff: '' }),
    verify: jest.fn().mockResolvedValue({ status: 'passed', commandsRun: [] }),
    review: jest.fn().mockResolvedValue({ findings: [] }),
    searchFiles: jest.fn().mockResolvedValue([{ path: 'src/index.ts' }]),
    getSymbols: jest.fn().mockResolvedValue([{ name: 'Index' }])
  };
  app.use(express.json());
  app.use(createCodeRouter({ codingAgent }));
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
});
