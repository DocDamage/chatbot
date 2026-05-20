import express from 'express';
import request from 'supertest';
import { createCodeRouter } from '../code';

describe('code routes', () => {
  it('mounts code ask, review, verify, and search endpoints', async () => {
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

    await request(app).post('/api/code/ask').send({ message: 'where is x?' }).expect(200);
    await request(app).post('/api/code/review').send({ diff: 'diff --git a/a b/a' }).expect(200);
    await request(app).post('/api/code/verify').send({ commands: ['npm run type-check'] }).expect(403);
    await request(app).post('/api/code/verify').send({ mode: 'implement', commands: ['npm run type-check'] }).expect(200);
    await request(app).get('/api/code/files/search?q=index').expect(200);
    await request(app).get('/api/code/symbols?file=src/index.ts').expect(200);
  });
});
