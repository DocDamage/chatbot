import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { InternalSpriteImageAdapter } from '../../core/sprite-lab/InternalSpriteImageAdapter';
import { SpriteExternalToolAdapter } from '../../core/sprite-lab/SpriteExternalToolAdapter';
import { SpriteLabPlanService } from '../../core/sprite-lab/SpriteLabPlanService';

export function createSpriteLabRouter(services: any, workspaceRoot = process.cwd()): Router {
  const router = Router();

  const getService = () => new SpriteLabPlanService(services?.database, workspaceRoot);
  const getInternalAdapter = () => new InternalSpriteImageAdapter(workspaceRoot);
  const getExternalAdapter = () => new SpriteExternalToolAdapter(services?.database, workspaceRoot);

  router.get('/api/sprite-lab/status', asyncHandler(async (_req, res) => {
    res.json(await getService().getStatus());
  }));

  router.post('/api/sprite-lab/plan', asyncHandler(async (req, res) => {
    const workflow = sanitizeInput(String(req.body.workflow || '')) as any;
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputTarget = req.body.outputTarget ? sanitizeInput(String(req.body.outputTarget)) : undefined;

    if (!workflow.trim() || !inputPath.trim()) {
      return res.status(400).json({ error: 'workflow and inputPath are required' });
    }

    res.json(await getService().planWorkflow({ workflow, inputPath, outputTarget }));
  }));

  router.post('/api/sprite-lab/external/plan', asyncHandler(async (req, res) => {
    const backend = sanitizeInput(String(req.body.backend || '')) as any;
    const workflow = sanitizeInput(String(req.body.workflow || '')) as any;
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputTarget = req.body.outputTarget ? sanitizeInput(String(req.body.outputTarget)) : undefined;

    if (!backend.trim() || !workflow.trim() || !inputPath.trim()) {
      return res.status(400).json({ error: 'backend, workflow, and inputPath are required' });
    }

    res.json(await getExternalAdapter().planRun({
      backend,
      workflow,
      inputPath,
      outputTarget,
      cwd: req.body.cwd ? String(req.body.cwd) : undefined,
      approvedByUser: req.body.approvedByUser === true,
      options: req.body.options && typeof req.body.options === 'object' ? req.body.options : undefined
    }));
  }));

  router.post('/api/sprite-lab/external/run', asyncHandler(async (req, res) => {
    const backend = sanitizeInput(String(req.body.backend || '')) as any;
    const workflow = sanitizeInput(String(req.body.workflow || '')) as any;
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputTarget = req.body.outputTarget ? sanitizeInput(String(req.body.outputTarget)) : undefined;

    if (!backend.trim() || !workflow.trim() || !inputPath.trim()) {
      return res.status(400).json({ error: 'backend, workflow, and inputPath are required' });
    }
    if (req.body.approvedByUser !== true) {
      return res.status(400).json({ error: 'approvedByUser must be true before starting an external sprite tool run' });
    }

    res.json(await getExternalAdapter().run({
      backend,
      workflow,
      inputPath,
      outputTarget,
      cwd: req.body.cwd ? String(req.body.cwd) : undefined,
      approvedByUser: true,
      options: req.body.options && typeof req.body.options === 'object' ? req.body.options : undefined
    }));
  }));

  router.post('/api/sprite-lab/internal/slice-grid', asyncHandler(async (req, res) => {
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputDir = sanitizeInput(String(req.body.outputDir || ''));
    const frameWidth = Number(req.body.frameWidth || 0);
    const frameHeight = Number(req.body.frameHeight || 0);
    if (!inputPath.trim() || !outputDir.trim()) {
      return res.status(400).json({ error: 'inputPath and outputDir are required' });
    }
    res.json(await getInternalAdapter().sliceGrid({ inputPath, outputDir, frameWidth, frameHeight }));
  }));

  router.post('/api/sprite-lab/internal/palette', asyncHandler(async (req, res) => {
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputPath = sanitizeInput(String(req.body.outputPath || ''));
    if (!inputPath.trim() || !outputPath.trim()) {
      return res.status(400).json({ error: 'inputPath and outputPath are required' });
    }
    res.json(await getInternalAdapter().extractPalette({
      inputPath,
      outputPath,
      maxColors: req.body.maxColors ? Number(req.body.maxColors) : undefined
    }));
  }));

  router.post('/api/sprite-lab/internal/manifest', asyncHandler(async (req, res) => {
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputPath = sanitizeInput(String(req.body.outputPath || ''));
    if (!inputPath.trim() || !outputPath.trim()) {
      return res.status(400).json({ error: 'inputPath and outputPath are required' });
    }
    res.json(await getInternalAdapter().createBasicManifest({
      inputPath,
      outputPath,
      frameWidth: req.body.frameWidth ? Number(req.body.frameWidth) : undefined,
      frameHeight: req.body.frameHeight ? Number(req.body.frameHeight) : undefined,
      animationName: req.body.animationName ? String(req.body.animationName) : undefined
    }));
  }));

  return router;
}
