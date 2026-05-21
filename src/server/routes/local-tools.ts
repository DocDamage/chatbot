import * as fs from 'fs';
import * as path from 'path';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { ensureExpansionDatabase } from '../../core/database/ExpansionDatabase';
import { LocalToolService } from '../../core/local-tools/LocalToolService';
import { LocalRunApprovalService } from '../../core/local-tools/LocalRunApprovalService';
import { cancelLocalToolRun } from '../../core/local-tools/LocalToolRunner';
import { validateLocalToolArgs } from '../../core/local-tools/LocalToolPolicy';

export function createLocalToolsRouter(services: any, workspaceRoot = process.cwd()): Router {
  const router = Router();

  const getService = () => new LocalToolService(services?.database, workspaceRoot);
  const getApprovalService = () => new LocalRunApprovalService(services?.database);

  router.get('/api/local-tools/detect', asyncHandler(async (_req, res) => {
    res.json(await getService().detectAll());
  }));

  router.get('/api/local-tools/executables', asyncHandler(async (_req, res) => {
    res.json({ executables: await getService().listExecutables() });
  }));

  router.post('/api/local-tools/executables', asyncHandler(async (req, res) => {
    const executablePath = sanitizeInput(String(req.body.executablePath || ''));
    const name = sanitizeInput(String(req.body.name || ''));
    const toolSlug = req.body.toolSlug ? sanitizeInput(String(req.body.toolSlug)) : undefined;

    if (!name.trim() || !executablePath.trim()) {
      return res.status(400).json({ error: 'name and executablePath are required' });
    }

    res.json({ executable: await getService().registerManualExecutable({
      name,
      executablePath,
      toolSlug,
      enabled: req.body.enabled === true,
      trustLevel: req.body.trustLevel ? String(req.body.trustLevel) : undefined,
      approvalPolicy: req.body.approvalPolicy ? String(req.body.approvalPolicy) : undefined
    }) });
  }));

  router.post('/api/local-tools/run/plan', asyncHandler(async (req, res) => {
    const toolSlug = req.body.toolSlug ? sanitizeInput(String(req.body.toolSlug)) : undefined;
    const executablePath = req.body.executablePath ? sanitizeInput(String(req.body.executablePath)) : undefined;
    const args = Array.isArray(req.body.args) ? req.body.args.map(String) : [];
    const policy = validateLocalToolArgs(toolSlug, args);
    if (!policy.allowed) {
      return res.status(400).json({ error: policy.reason || 'Local tool arguments are not allowed' });
    }

    res.json(await getService().planRun({
      toolSlug,
      executablePath,
      args,
      cwd: req.body.cwd ? String(req.body.cwd) : undefined,
      riskLevel: req.body.riskLevel ? String(req.body.riskLevel) : undefined,
      approvedByUser: req.body.approvedByUser === true
    }));
  }));

  router.post('/api/local-tools/run/start-approved', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.body.runId || ''));
    if (!runId.trim()) return res.status(400).json({ error: 'runId is required' });

    res.json({
      run: await getService().executePlannedRun(runId, req.body.approvedByUser === true)
    });
  }));

  router.get('/api/local-tools/runs', asyncHandler(async (req, res) => {
    res.json({ runs: await getApprovalService().listRuns(req.query.limit ? Number(req.query.limit) : undefined) });
  }));

  router.post('/api/local-tools/runs/:runId/approve', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.params.runId || ''));
    if (!runId.trim()) return res.status(400).json({ error: 'runId is required' });
    res.json({ run: await getApprovalService().approveRun(runId, req.body.approvalNote ? String(req.body.approvalNote) : undefined) });
  }));

  router.post('/api/local-tools/runs/:runId/start', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.params.runId || ''));
    if (!runId.trim()) return res.status(400).json({ error: 'runId is required' });

    res.json({
      run: await getService().executePlannedRun(runId, req.body.approvedByUser === true)
    });
  }));

  router.post('/api/local-tools/runs/:runId/cancel', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.params.runId || ''));
    if (!runId.trim()) return res.status(400).json({ error: 'runId is required' });

    const database = await ensureExpansionDatabase(services?.database);
    const existing = (await database.query('SELECT id, status FROM local_tool_runs WHERE id = ? LIMIT 1', [runId])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Local tool run not found' });

    const cancelRequested = cancelLocalToolRun(runId);
    if (cancelRequested) {
      await database.query(
        `UPDATE local_tool_runs
         SET status = ?, metadata_json = ?, completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        ['cancel_requested', JSON.stringify({ cancelRequestedAt: new Date().toISOString() }), runId]
      );
    }

    res.json({ runId, cancelRequested, status: cancelRequested ? 'cancel_requested' : existing.status });
  }));

  router.get('/api/local-tools/runs/:runId/files', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.params.runId || ''));
    if (!runId.trim()) return res.status(400).json({ error: 'runId is required' });
    const row = await loadRunRow(services?.database, runId);
    const parent = outputParent(row);
    const files = allowedRunFiles(row)
      .filter(file => fs.existsSync(file))
      .filter(file => {
        assertInside(parent, file);
        return true;
      })
      .map(file => {
        const stats = fs.statSync(file);
        return {
          fileName: path.basename(file),
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
          kind: path.basename(file) === 'stdout.txt' ? 'stdout' : path.basename(file) === 'stderr.txt' ? 'stderr' : 'output',
          downloadUrl: `/api/local-tools/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(path.basename(file))}`
        };
      });
    res.json({ runId, files });
  }));

  router.get('/api/local-tools/runs/:runId/files/:fileName', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.params.runId || ''));
    const fileName = sanitizeInput(String(req.params.fileName || ''));
    if (!runId.trim() || !fileName.trim()) return res.status(400).json({ error: 'runId and fileName are required' });
    if (fileName.includes('/') || fileName.includes('\\')) return res.status(400).json({ error: 'Invalid output file name' });

    const row = await loadRunRow(services?.database, runId);
    const parent = outputParent(row);
    const match = allowedRunFiles(row).find(file => path.basename(file) === fileName);
    if (!match || !fs.existsSync(match)) return res.status(404).json({ error: 'Output file not found' });
    assertInside(parent, match);
    res.setHeader('Content-Type', contentTypeFor(match));
    res.sendFile(match);
  }));

  return router;
}

async function loadRunRow(databaseLike: any, runId: string): Promise<any> {
  const database = await ensureExpansionDatabase(databaseLike);
  const row = (await database.query('SELECT * FROM local_tool_runs WHERE id = ? LIMIT 1', [runId])).rows[0];
  if (!row) throw new Error(`Local tool run not found: ${runId}`);
  return row;
}

function allowedRunFiles(row: any): string[] {
  const parsed = parseJson<string[]>(row.output_files_json, []);
  return [row.stdout_path, row.stderr_path, ...parsed]
    .filter(Boolean)
    .map(file => path.resolve(String(file)));
}

function outputParent(row: any): string {
  const first = allowedRunFiles(row)[0];
  if (!first) throw new Error('Local tool run has no output directory yet');
  return path.dirname(first);
}

function assertInside(parent: string, child: string): void {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid output file path');
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.txt' || ext === '.log') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}
