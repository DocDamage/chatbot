import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { LocalToolService } from '../../core/local-tools/LocalToolService';
import { LocalRunApprovalService } from '../../core/local-tools/LocalRunApprovalService';

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

    res.json(await getService().planRun({
      toolSlug,
      executablePath,
      args,
      cwd: req.body.cwd ? String(req.body.cwd) : undefined,
      riskLevel: req.body.riskLevel ? String(req.body.riskLevel) : undefined,
      approvedByUser: req.body.approvedByUser === true
    }));
  }));

  router.get('/api/local-tools/runs', asyncHandler(async (req, res) => {
    res.json({ runs: await getApprovalService().listRuns(req.query.limit ? Number(req.query.limit) : undefined) });
  }));

  router.post('/api/local-tools/runs/:runId/approve', asyncHandler(async (req, res) => {
    const runId = sanitizeInput(String(req.params.runId || ''));
    if (!runId.trim()) return res.status(400).json({ error: 'runId is required' });
    res.json({ run: await getApprovalService().approveRun(runId, req.body.approvalNote ? String(req.body.approvalNote) : undefined) });
  }));

  return router;
}
