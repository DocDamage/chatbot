import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { Database } from '../../../core/database/Database';
import { ensureExpansionDatabase } from '../../../core/database/ExpansionDatabase';
import { createLocalToolsRouter } from '../local-tools';
import { errorHandler } from '../../../middleware/errorHandler';

function makeApp(database: Database, workspaceRoot: string) {
  const app = express();
  app.use(express.json());
  app.use(createLocalToolsRouter({ database }, workspaceRoot));
  app.use(errorHandler);
  return app;
}

describe('local tools routes', () => {
  let tempDir: string;
  let db: Database;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tools-route-test-'));
    db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'chatbot.db') });
    await db.initialize();
    await ensureExpansionDatabase(db);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('plans, approves, starts, lists, and downloads local tool output', async () => {
    const app = makeApp(db, tempDir);

    const planned = await request(app)
      .post('/api/local-tools/run/plan')
      .send({
        executablePath: process.execPath,
        args: ['-e', "console.log('route-output')"],
        cwd: '.',
        riskLevel: 'low'
      })
      .expect(200);

    expect(planned.body.status).toBe('planned');
    expect(planned.body.requiresApproval).toBe(true);

    await request(app)
      .post(`/api/local-tools/runs/${planned.body.runId}/start`)
      .send({})
      .expect(500);

    await request(app)
      .post(`/api/local-tools/runs/${planned.body.runId}/approve`)
      .send({ approvalNote: 'test approval' })
      .expect(200)
      .expect(response => {
        expect(response.body.run.approvedByUser).toBe(true);
      });

    await request(app)
      .post(`/api/local-tools/runs/${planned.body.runId}/start`)
      .send({})
      .expect(200)
      .expect(response => {
        expect(response.body.run.status).toBe('completed');
        expect(response.body.run.stdout).toContain('route-output');
      });

    await request(app)
      .get('/api/local-tools/runs')
      .expect(200)
      .expect(response => {
        expect(response.body.runs[0].id).toBe(planned.body.runId);
        expect(response.body.runs[0].status).toBe('completed');
      });

    const files = await request(app)
      .get(`/api/local-tools/runs/${planned.body.runId}/files`)
      .expect(200);

    expect(files.body.files.map((file: any) => file.fileName)).toContain('stdout.txt');

    await request(app)
      .get(`/api/local-tools/runs/${planned.body.runId}/files/stdout.txt`)
      .expect(200)
      .expect(response => {
        expect(response.text).toContain('route-output');
      });
  });

  it('rejects unknown disallowed args for governed tools', async () => {
    const app = makeApp(db, tempDir);

    await request(app)
      .post('/api/local-tools/run/plan')
      .send({
        toolSlug: 'aseprite',
        args: ['--not-allowed'],
        cwd: '.'
      })
      .expect(400)
      .expect(response => {
        expect(response.body.error).toMatch(/not allowed/i);
      });
  });

  it('returns cancel status for a planned non-running job', async () => {
    const app = makeApp(db, tempDir);

    const planned = await request(app)
      .post('/api/local-tools/run/plan')
      .send({
        executablePath: process.execPath,
        args: ['-e', "console.log('cancel-test')"],
        cwd: '.',
        riskLevel: 'low'
      })
      .expect(200);

    await request(app)
      .post(`/api/local-tools/runs/${planned.body.runId}/cancel`)
      .send({})
      .expect(200)
      .expect(response => {
        expect(response.body.runId).toBe(planned.body.runId);
        expect(response.body.cancelRequested).toBe(false);
        expect(response.body.status).toBe('planned');
      });
  });
});
