import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { PlanDocumentService } from '../../core/planning/PlanDocumentService';

export function createPlansRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const plans = new PlanDocumentService(workspaceRoot);

  router.post('/api/plans', asyncHandler(async (req, res) => {
    const userRequest = sanitizeInput(String(req.body.userRequest || req.body.message || ''));
    if (!userRequest.trim()) return res.status(400).json({ error: 'userRequest is required' });
    res.json(await plans.createPlan({
      userRequest,
      mode: 'plan',
      affectedFiles: req.body.affectedFiles,
      phases: req.body.phases,
      acceptanceCriteria: req.body.acceptanceCriteria,
      risks: req.body.risks,
      verificationChecklist: req.body.verificationChecklist
    }));
  }));

  router.get('/api/plans', asyncHandler(async (_req, res) => {
    res.json({ plans: await plans.listPlans() });
  }));

  router.get('/api/plans/:planId', asyncHandler(async (req, res) => {
    const plan = await plans.getPlan(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  }));

  router.post('/api/plans/:planId/load', asyncHandler(async (req, res) => {
    const plan = await plans.getPlan(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ loaded: true, plan });
  }));

  return router;
}
