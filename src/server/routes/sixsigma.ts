import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createSixSigmaRouter(services: any): Router {
  const router = Router();

  router.post('/api/sixsigma/ask', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.ask(req.body.query || req.body.message || ''));
  }));

  router.post('/api/sixsigma/calculate', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.calculate(req.body.query || req.body.message || ''));
  }));

  router.post('/api/sixsigma/project', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.project(req.body.query || req.body.message || ''));
  }));

  router.post('/api/sixsigma/certification', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.certification(req.body.query || req.body.message || ''));
  }));

  router.post('/api/sixsigma/simulate', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.simulate(req.body.query || req.body.message || ''));
  }));

  router.post('/api/sixsigma/export', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.export(req.body.query || req.body.message || ''));
  }));

  router.post('/api/sixsigma/study-plan', asyncHandler(async (req, res) => {
    res.json(await services.sixSigmaBlackBeltAgent.studyPlan(req.body.query || req.body.message || ''));
  }));

  return router;
}
