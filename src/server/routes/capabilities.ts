/**
 * Capability Hub Express Router (CF-09 & CF-10)
 * Exposes capability registry discovery, diagnostics, actions, job lifecycles,
 * evaluation suites, observability metrics, promotion gates, and support bundles.
 */

import { Router, Request, Response } from 'express';
import { CapabilityMaturity, CapabilityRegistry, UserRole } from '../../core/capabilities/CapabilityRegistry';
import { CapabilityJobManager, JobCapabilityCategory, JobStatus } from '../../core/capabilities/CapabilityJobManager';
import { CapabilityEvaluationSuite, EvaluationDomain } from '../../core/capabilities/evaluation/CapabilityEvaluationSuite';
import { CapabilityObservabilityService } from '../../core/capabilities/observability/CapabilityObservabilityService';
import { CapabilityPromotionEngine } from '../../core/capabilities/promotion/CapabilityPromotionEngine';
import { resolveDeploymentMode } from '../../core/config/EnvironmentDefinitions';
import { logger } from '../../core/observability/logger';
import { ApprovedRepositoryGateway } from '../../core/coding/security/ApprovedRepositoryGateway';
import { RepositoryFindingsAnalyzer } from '../../core/coding/findings/RepositoryFindings';
import { CapabilitySDK } from '../../core/capabilities/sdk/CapabilitySDK';

export function createCapabilityRouter(workspaceRoot: string = process.cwd()): Router {
  const router = Router();
  const registry = CapabilityRegistry.getInstance();
  const jobManager = CapabilityJobManager.getInstance();
  const evalSuite = CapabilityEvaluationSuite.getInstance();
  const obsService = CapabilityObservabilityService.getInstance();
  const promotionEngine = CapabilityPromotionEngine.getInstance();

  function resolveUserRole(req: Request): UserRole {
    // Roles must come from authenticated middleware. Never trust a caller-set
    // header for promotion, rollback, or capability-policy authority.
    const roles = req.user?.roles || [];
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('developer')) return 'developer';
    return 'user';
  }

  function canAccessJob(req: Request, requester: string): boolean {
    return resolveUserRole(req) === 'admin' || requester === (req.user?.userId || 'anonymous');
  }

  const validMaturities = new Set<CapabilityMaturity>([
    'PRODUCTION_SUPPORTED',
    'PRODUCTION_PREVIEW',
    'LOCAL_ONLY_EXPERIMENTAL',
    'DEPRECATED'
  ]);
  const validDomains = new Set<EvaluationDomain>(evalSuite.getAllDomains());

  // GET /api/capabilities - List all capabilities
  router.get('/', (req: Request, res: Response) => {
    try {
      const profile = resolveDeploymentMode();
      const role = resolveUserRole(req);
      const capabilities = registry.getCapabilities(profile, role);
      res.json({
        profile,
        userRole: role,
        count: capabilities.length,
        capabilities
      });
    } catch (error: any) {
      logger.error('Failed to list capabilities', { error: error.message });
      res.status(500).json({ error: 'Failed to list capabilities' });
    }
  });

  // GET /api/capabilities/jobs/list - List jobs
  router.get('/jobs/list', (req: Request, res: Response) => {
    try {
      const { capabilityId, category, status } = req.query;
      const jobs = jobManager.listJobs({
        capabilityId: typeof capabilityId === 'string' ? capabilityId : undefined,
        category: typeof category === 'string' ? category as JobCapabilityCategory : undefined,
        status: typeof status === 'string' ? status as JobStatus : undefined
      }).filter(job => canAccessJob(req, job.requester));
      res.json({ jobs });
    } catch (error: any) {
      logger.error('Failed to list capability jobs', { error: error.message });
      res.status(500).json({ error: 'Failed to list capability jobs' });
    }
  });

  // --- CF-10 Evaluation, Observability & Promotion Endpoints ---

  // POST /api/capabilities/evaluations/run - Run evaluation suite
  router.post('/evaluations/run', async (req: Request, res: Response) => {
    try {
      const { domains } = req.body || {};
      if (domains !== undefined && (!Array.isArray(domains) || domains.some(domain => !validDomains.has(domain)))) {
        return res.status(400).json({ error: 'domains must contain only supported evaluation domain identifiers' });
      }
      const profile = resolveDeploymentMode();
      const result = await evalSuite.runSuite({
        domains: Array.isArray(domains) ? domains as EvaluationDomain[] : undefined,
        profile
      });
      res.json({ result });
    } catch (error: any) {
      logger.error('Failed to run capability evaluation suite', { error: error.message });
      res.status(500).json({ error: 'Failed to run evaluation suite' });
    }
  });

  // GET /api/capabilities/metrics/dashboard - Observability & SLO metrics
  router.get('/metrics/dashboard', (_req: Request, res: Response) => {
    try {
      const dashboard = obsService.getDashboardSummary();
      res.json({ dashboard });
    } catch (error: any) {
      logger.error('Failed to fetch observability dashboard', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch observability dashboard' });
    }
  });

  // GET /api/capabilities/support-bundle - Scrubbed diagnostic support bundle
  router.get('/support-bundle', (_req: Request, res: Response) => {
    try {
      const bundle = obsService.generateSupportBundle();
      res.json({ bundle });
    } catch (error: any) {
      logger.error('Failed to generate diagnostic support bundle', { error: error.message });
      res.status(500).json({ error: 'Failed to generate diagnostic support bundle' });
    }
  });

  // GET /api/capabilities/repository-findings - Evidence-backed CF-03 data for the 2D/table views
  router.get('/repository-findings', (req: Request, res: Response) => {
    try {
      const requestedMax = Number(req.query.maxFiles || 1000);
      const maxFiles = Number.isFinite(requestedMax) ? Math.min(3000, Math.max(1, Math.trunc(requestedMax))) : 1000;
      const analyzer = new RepositoryFindingsAnalyzer(new ApprovedRepositoryGateway(workspaceRoot));
      res.json(analyzer.analyze({ maxFiles }));
    } catch (error: any) {
      logger.error('Failed to analyze repository findings', { error: error.message });
      res.status(500).json({ error: 'Failed to analyze repository findings' });
    }
  });

  // POST /api/capabilities/promotions/evaluate - Evaluate promotion readiness
  router.post('/promotions/evaluate', async (req: Request, res: Response) => {
    try {
      const { capabilityId, targetMaturity } = req.body || {};
      if (!capabilityId || !targetMaturity) {
        return res.status(400).json({ error: 'capabilityId and targetMaturity are required' });
      }
      if (!validMaturities.has(targetMaturity)) {
        return res.status(400).json({ error: 'targetMaturity is invalid' });
      }

      const evaluation = await promotionEngine.evaluatePromotion(capabilityId, targetMaturity);
      res.json({ evaluation });
    } catch (error: any) {
      logger.error('Failed to evaluate capability promotion', { error: error.message });
      res.status(500).json({ error: 'Failed to evaluate capability promotion' });
    }
  });

  router.get('/promotions/decisions', (_req: Request, res: Response) => {
    res.json({ decisions: promotionEngine.getDecisionRecords() });
  });

  // POST /api/capabilities/promotions/promote - Execute capability promotion
  router.post('/promotions/promote', async (req: Request, res: Response) => {
    try {
      const { capabilityId, targetMaturity, rationale, confirmedScope } = req.body || {};
      if (!capabilityId || !targetMaturity) {
        return res.status(400).json({ error: 'capabilityId and targetMaturity are required' });
      }
      if (!validMaturities.has(targetMaturity)) {
        return res.status(400).json({ error: 'targetMaturity is invalid' });
      }
      const requiredScope = `PROMOTE_CAPABILITY:${capabilityId}:${targetMaturity}`;
      if (confirmedScope !== requiredScope) {
        return res.status(400).json({ error: `Exact-scope confirmation must match '${requiredScope}'` });
      }

      const role = resolveUserRole(req);
      const requester = req.user?.userId || 'CapabilityHub Operator';

      const result = await promotionEngine.executePromotion({
        capabilityId,
        targetMaturity,
        promotedBy: requester,
        rationale: rationale || 'Promoted via CapabilityHub Promotion Gate',
        userRole: role
      });

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (error: any) {
      logger.error('Failed to execute capability promotion', { error: error.message });
      res.status(500).json({ error: 'Failed to execute capability promotion' });
    }
  });

  // POST /api/capabilities/promotions/rollback - Execute capability rollback
  router.post('/promotions/rollback', async (req: Request, res: Response) => {
    try {
      const { capabilityId, rollbackMaturity, reason, confirmedScope } = req.body || {};
      if (!capabilityId || !rollbackMaturity || !reason) {
        return res.status(400).json({ error: 'capabilityId, rollbackMaturity, and reason are required' });
      }
      if (!validMaturities.has(rollbackMaturity)) {
        return res.status(400).json({ error: 'rollbackMaturity is invalid' });
      }
      const requiredScope = `ROLLBACK_CAPABILITY:${capabilityId}:${rollbackMaturity}`;
      if (confirmedScope !== requiredScope) {
        return res.status(400).json({ error: `Exact-scope confirmation must match '${requiredScope}'` });
      }

      const role = resolveUserRole(req);
      const operator = req.user?.userId || 'CapabilityHub Operator';

      const result = await promotionEngine.executeRollback({
        capabilityId,
        rollbackMaturity,
        reason,
        operator,
        userRole: role
      });
      if (!result.success) return res.status(400).json({ error: result.message });
      res.json(result);
    } catch (error: any) {
      logger.error('Failed to execute capability rollback', { error: error.message });
      res.status(500).json({ error: 'Failed to execute capability rollback' });
    }
  });

  // GET /api/capabilities/:id - Get specific capability
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const profile = resolveDeploymentMode();
      const role = resolveUserRole(req);
      const capability = registry.getCapabilityById(req.params.id, profile, role);
      if (!capability) {
        return res.status(404).json({ error: `Capability '${req.params.id}' not found` });
      }
      res.json({ capability });
    } catch (error: any) {
      logger.error('Failed to get capability', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to get capability' });
    }
  });

  // POST /api/capabilities/:id/action - Execute an action on a capability
  router.post('/:id/action', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { actionId, confirmedScope } = req.body || {};
      if (!actionId) {
        return res.status(400).json({ error: 'actionId is required' });
      }

      const role = resolveUserRole(req);
      const result = await registry.executeAction(req.params.id, actionId, {
        confirmedScope,
        requester: req.user?.userId || 'anonymous',
        userRole: role
      });
      obsService.recordTelemetry({
        capabilityId: req.params.id,
        operation: actionId,
        durationMs: Date.now() - startedAt,
        success: result.success,
        errorCode: result.success ? undefined : 'CAPABILITY_ACTION_FAILED',
        userRole: role,
        privacyMode: resolveDeploymentMode() === 'hosted' ? 'local_disabled' : 'prefer_local',
        auditCorrelationId: result.job?.auditDigest || `capability-action-${Date.now()}`
      });

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (error: any) {
      logger.error('Failed to execute capability action', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to execute capability action' });
    }
  });

  // POST /api/capabilities/jobs/:id/cancel - Cancel a job
  router.post('/jobs/:id/cancel', (req: Request, res: Response) => {
    try {
      const { reason } = req.body || {};
      const job = jobManager.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: `Job '${req.params.id}' not found.` });
      if (!canAccessJob(req, job.requester)) return res.status(403).json({ error: 'Job access denied.' });
      const success = jobManager.cancelJob(req.params.id, reason);
      if (!success) {
        return res.status(400).json({ error: `Could not cancel job '${req.params.id}' (not found or already finished).` });
      }
      res.json({ success: true, job: jobManager.getJob(req.params.id) });
    } catch (error: any) {
      logger.error('Failed to cancel job', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  });

  // POST /api/capabilities/jobs/:id/confirm - Confirm exact scope for a pending job
  router.post('/jobs/:id/confirm', (req: Request, res: Response) => {
    try {
      const { confirmedScope } = req.body || {};
      if (!confirmedScope) {
        return res.status(400).json({ error: 'confirmedScope is required' });
      }
      const job = jobManager.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: `Job '${req.params.id}' not found.` });
      if (!canAccessJob(req, job.requester)) return res.status(403).json({ error: 'Job access denied.' });

      const success = jobManager.confirmExactScope(req.params.id, confirmedScope);
      if (!success) {
        return res.status(400).json({ error: `Scope confirmation failed for job '${req.params.id}'. Scope did not match or job is not pending approval.` });
      }

      res.json({ success: true, job: jobManager.getJob(req.params.id) });
    } catch (error: any) {
      logger.error('Failed to confirm job scope', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to confirm job scope' });
    }
  });

  // --- PX-02 Operator API Endpoints (PX02-T13) ---
  const sdk = CapabilitySDK.getInstance();

  // GET /api/capabilities/artifacts/:id - Retrieve artifact metadata
  router.get('/artifacts/:id', (req: Request, res: Response) => {
    try {
      const role = resolveUserRole(req);
      const requester = {
        userId: req.user?.userId || 'anonymous',
        isAdmin: role === 'admin'
      };
      const artifact = sdk.artifacts.getArtifactMetadata(req.params.id, requester);
      if (!artifact) {
        return res.status(404).json({ error: `Artifact '${req.params.id}' not found or access denied` });
      }
      res.json({ artifact });
    } catch (error: any) {
      logger.error('Failed to get artifact metadata', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to get artifact metadata' });
    }
  });

  // GET /api/capabilities/jobs/:id - Get specific job details
  router.get('/jobs/:id', (req: Request, res: Response) => {
    try {
      const job = jobManager.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: `Job '${req.params.id}' not found` });
      }
      if (!canAccessJob(req, job.requester)) return res.status(403).json({ error: 'Job access denied.' });
      res.json({ job });
    } catch (error: any) {
      logger.error('Failed to get job', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to get job' });
    }
  });

  // POST /api/capabilities/jobs/:id/approve - Approve pending job with digest
  router.post('/jobs/:id/approve', (req: Request, res: Response) => {
    try {
      const { approvalDigest } = req.body || {};
      const job = jobManager.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: `Job '${req.params.id}' not found` });
      }
      if (!canAccessJob(req, job.requester)) return res.status(403).json({ error: 'Job access denied.' });
      const role = resolveUserRole(req);
      if (role !== 'admin' && role !== 'developer') {
        return res.status(403).json({ error: 'Only developers or admins can approve capability jobs' });
      }
      if (typeof approvalDigest !== 'string' || !approvalDigest) {
        return res.status(400).json({ error: 'approvalDigest is required' });
      }
      const success = jobManager.confirmExactScope(req.params.id, approvalDigest);
      res.json({ success, job: jobManager.getJob(req.params.id) });
    } catch (error: any) {
      logger.error('Failed to approve job', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to approve job' });
    }
  });

  // POST /api/capabilities/:id/preflight - Run preflight check
  router.post('/:id/preflight', async (req: Request, res: Response) => {
    try {
      const snapshot = await sdk.health.runDiagnostics(req.params.id);
      res.json({ preflight: snapshot });
    } catch (error: any) {
      logger.error('Failed preflight check', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed preflight check' });
    }
  });

  // POST /api/capabilities/:id/test - Run capability test/canary
  router.post('/:id/test', async (req: Request, res: Response) => {
    try {
      const role = resolveUserRole(req);
      const result = await registry.executeAction(req.params.id, 'test_run', {
        requester: req.user?.userId || 'Operator',
        userRole: role
      });
      res.json(result);
    } catch (error: any) {
      logger.error('Failed to test capability', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to test capability' });
    }
  });

  // POST /api/capabilities/:id/enable - Enable capability
  router.post('/:id/enable', (req: Request, res: Response) => {
    try {
      const role = resolveUserRole(req);
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required to enable capabilities' });
      }
      if (!registry.restoreCapabilityPolicy(req.params.id)) {
        return res.status(404).json({ error: `Capability '${req.params.id}' not found` });
      }
      res.json({ success: true, message: `Capability '${req.params.id}' enabled.` });
    } catch (error: any) {
      logger.error('Failed to enable capability', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to enable capability' });
    }
  });

  // POST /api/capabilities/:id/disable - Disable capability
  router.post('/:id/disable', (req: Request, res: Response) => {
    try {
      const role = resolveUserRole(req);
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required to disable capabilities' });
      }
      const requiredScope = `DISABLE_CAPABILITY:${req.params.id}`;
      if (req.body?.confirmedScope !== requiredScope) {
        return res.status(400).json({ error: `Exact-scope confirmation must match '${requiredScope}'` });
      }
      if (!registry.disableCapability(req.params.id)) {
        return res.status(404).json({ error: `Capability '${req.params.id}' not found` });
      }
      res.json({ success: true, message: `Capability '${req.params.id}' disabled.` });
    } catch (error: any) {
      logger.error('Failed to disable capability', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to disable capability' });
    }
  });

  return router;
}
