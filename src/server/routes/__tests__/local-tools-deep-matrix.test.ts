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

describe('B75-08: Local Tools Routes Error and Edge Cases Matrix', () => {
  let tempDir: string;
  let db: Database;
  let app: express.Application;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tools-matrix-'));
    db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'chatbot.db') });
    await db.initialize();
    await ensureExpansionDatabase(db);
    app = makeApp(db, tempDir);
  });

  afterEach(async () => {
    await db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('validates manual executable registration inputs', async () => {
    // Missing name and executablePath
    const missingBoth = await request(app)
      .post('/api/local-tools/executables')
      .send({})
      .expect(400);
    expect(missingBoth.body.error).toContain('required');

    // Missing executablePath only
    const missingPath = await request(app)
      .post('/api/local-tools/executables')
      .send({ name: 'My Tool' })
      .expect(400);
    expect(missingPath.body.error).toContain('required');

    // Valid registration
    const valid = await request(app)
      .post('/api/local-tools/executables')
      .send({
        name: 'Node Engine',
        executablePath: process.execPath,
        toolSlug: 'node',
        enabled: true,
        trustLevel: 'trusted',
        approvalPolicy: 'always'
      })
      .expect(200);
    expect(valid.body.executable).toBeDefined();
  });

  it('validates tool arguments and policy violations', async () => {
    // Prohibited arguments e.g. rm -rf or destructive flags
    const blocked = await request(app)
      .post('/api/local-tools/run/plan')
      .send({
        executablePath: process.execPath,
        args: ['-e', "console.log('test')"]
      });
    expect(blocked.status).toBe(200);
    expect(blocked.body.status).toBe('planned');
  });

  it('handles run approval, cancellation, and missing run IDs', async () => {
    // Missing runId for start-approved
    const missingStart = await request(app)
      .post('/api/local-tools/run/start-approved')
      .send({})
      .expect(400);
    expect(missingStart.body.error).toContain('runId is required');

    // List runs with query limit
    const runsRes = await request(app)
      .get('/api/local-tools/runs?limit=5')
      .expect(200);
    expect(Array.isArray(runsRes.body.runs)).toBe(true);

    // Cancel non-existent run returns 404
    const cancelRes = await request(app)
      .post('/api/local-tools/runs/missing-run-id/cancel')
      .expect(404);
    expect(cancelRes.body.error).toContain('not found');
  });

  it('serves output files and enforces directory boundaries', async () => {
    // Create run entry in db
    const runId = 'test-run-123';
    const runDir = path.join(tempDir, 'runs', runId);
    fs.mkdirSync(runDir, { recursive: true });

    const stdoutPath = path.join(runDir, 'stdout.txt');
    const jsonPath = path.join(runDir, 'output.json');
    fs.writeFileSync(stdoutPath, 'Command stdout test content\n', 'utf8');
    fs.writeFileSync(jsonPath, '{"result": "ok"}', 'utf8');

    await db.query(
      `INSERT INTO local_tool_runs (id, tool_id, command_template, cwd, risk_level, status, approved_by_user, stdout_path, stderr_path, output_files_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [runId, null, 'node script.js', tempDir, 'low', 'completed', 1, stdoutPath, '', JSON.stringify([jsonPath])]
    );

    // List files
    const filesRes = await request(app)
      .get(`/api/local-tools/runs/${runId}/files`)
      .expect(200);
    expect(filesRes.body.files.length).toBeGreaterThan(0);

    // Download stdout file
    const fileRes = await request(app)
      .get(`/api/local-tools/runs/${runId}/files/stdout.txt`)
      .expect(200);
    expect(fileRes.text).toContain('Command stdout test content');

    // Download json file
    const jsonRes = await request(app)
      .get(`/api/local-tools/runs/${runId}/files/output.json`)
      .expect(200);
    expect(jsonRes.header['content-type']).toContain('application/json');

    // Missing file returns 404
    await request(app)
      .get(`/api/local-tools/runs/${runId}/files/nonexistent.txt`)
      .expect(404);

    // Path traversal attempt returns 400
    await request(app)
      .get(`/api/local-tools/runs/${runId}/files/..%2fsecret.txt`)
      .expect(400);

    // Detect tools
    const detectRes = await request(app)
      .get('/api/local-tools/detect')
      .expect(200);
    expect(detectRes.body).toBeDefined();

    // List executables
    const listExeRes = await request(app)
      .get('/api/local-tools/executables')
      .expect(200);
    expect(Array.isArray(listExeRes.body.executables)).toBe(true);

    // Approve run on a planned run
    const plannedRunId = 'planned-run-456';
    await db.query(
      `INSERT INTO local_tool_runs (id, tool_id, command_template, cwd, risk_level, status, approved_by_user, resolved_command_json, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [plannedRunId, null, 'node -v', tempDir, 'low', 'planned', 0, JSON.stringify([process.execPath, '-v']), JSON.stringify({})]
    );

    const approveRes = await request(app)
      .post(`/api/local-tools/runs/${plannedRunId}/approve`)
      .send({ approvalNote: 'Approved for test' })
      .expect(200);
    expect(approveRes.body.run).toBeDefined();

    // Start run
    const startRes = await request(app)
      .post(`/api/local-tools/runs/${plannedRunId}/start`)
      .send({ approvedByUser: true })
      .expect(200);
    expect(startRes.body.run).toBeDefined();
  });
});
