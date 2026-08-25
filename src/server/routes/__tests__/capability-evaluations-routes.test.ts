import express from 'express';
import request from 'supertest';
import { createCapabilityRouter } from '../capabilities';
import { CapabilityRegistry } from '../../../core/capabilities/CapabilityRegistry';
import { CapabilityObservabilityService } from '../../../core/capabilities/observability/CapabilityObservabilityService';
import { CapabilityJobManager } from '../../../core/capabilities/CapabilityJobManager';
import { CapabilityEvaluationSuite } from '../../../core/capabilities/evaluation/CapabilityEvaluationSuite';
import { CapabilityPromotionEngine } from '../../../core/capabilities/promotion/CapabilityPromotionEngine';

describe('Capability Evaluation, Promotion and Metrics API Routes (CF-10)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.headers['x-test-no-user'] === 'true') return next();
      req.user = {
        userId: 'capability-route-test',
        roles: [String(req.headers['x-test-role'] || 'developer')]
      };
      next();
    });
    app.use('/api/capabilities', createCapabilityRouter());
    CapabilityRegistry.getInstance().clearOverrides();
    CapabilityJobManager.getInstance().clear();
    CapabilityObservabilityService.getInstance().resetTelemetry();
    delete process.env.CF_ACCESSIBILITY_CERTIFIED;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CF_ACCESSIBILITY_CERTIFIED;
  });

  it('lists capabilities for authenticated roles and safely defaults anonymous callers to user', async () => {
    const admin = await request(app).get('/api/capabilities').set('x-test-role', 'admin');
    expect(admin.status).toBe(200);
    expect(admin.body.userRole).toBe('admin');
    expect(admin.body.count).toBe(admin.body.capabilities.length);

    const anonymous = await request(app).get('/api/capabilities').set('x-test-no-user', 'true');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.userRole).toBe('user');
  });

  it('gets individual capabilities, reports missing IDs, and lists filtered jobs', async () => {
    const found = await request(app).get('/api/capabilities/browser_jobs');
    expect(found.status).toBe(200);
    expect(found.body.capability.id).toBe('browser_jobs');

    const missing = await request(app).get('/api/capabilities/not-real');
    expect(missing.status).toBe(404);

    const manager = CapabilityJobManager.getInstance();
    manager.registerJob({
      id: 'route-job', capabilityId: 'browser_jobs', category: 'browser',
      title: 'Route job fixture', requester: 'route-test'
    });
    const jobs = await request(app)
      .get('/api/capabilities/jobs/list')
      .query({ capabilityId: 'browser_jobs', category: 'browser', status: 'running' });
    expect(jobs.status).toBe(200);
    expect(jobs.body.jobs).toHaveLength(1);

    const arrayQuery = await request(app).get('/api/capabilities/jobs/list?category=browser&category=video_localization');
    expect(arrayQuery.status).toBe(200);
  });

  it('POST /api/capabilities/evaluations/run executes evaluation suite and returns digest', async () => {
    const res = await request(app)
      .post('/api/capabilities/evaluations/run')
      .send({ domains: ['path_containment_and_secret_denial', 'deterministic_game_replay'] });

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.id).toMatch(/^eval-run-/);
    expect(res.body.result.sha256Digest).toHaveLength(64);
    expect(res.body.result.overallScore).toBeGreaterThanOrEqual(0.8);
  });

  it('runs the default evaluation domain set when no request body is supplied', async () => {
    const res = await request(app).post('/api/capabilities/evaluations/run');
    expect(res.status).toBe(200);
    expect(res.body.result.totalChecks).toBeGreaterThanOrEqual(10);
  });

  it('GET /api/capabilities/metrics/dashboard returns live SLO and error budget dashboard', async () => {
    const res = await request(app).get('/api/capabilities/metrics/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.dashboard).toBeDefined();
    expect(res.body.dashboard.slos.length).toBeGreaterThanOrEqual(3);
    expect(res.body.dashboard.latencyPercentiles).toBeDefined();
  });

  it('GET /api/capabilities/support-bundle returns scrubbed support bundle with SHA-256 digest', async () => {
    const res = await request(app).get('/api/capabilities/support-bundle');

    expect(res.status).toBe(200);
    expect(res.body.bundle).toBeDefined();
    expect(res.body.bundle.bundleId).toMatch(/^bundle-/);
    expect(res.body.bundle.sha256Digest).toHaveLength(64);
    expect(res.body.bundle.sanitizedLogs).toBeDefined();
  });

  it('POST /api/capabilities/promotions/evaluate returns gate criteria evaluation', async () => {
    const res = await request(app)
      .post('/api/capabilities/promotions/evaluate')
      .send({ capabilityId: 'repo_architecture', targetMaturity: 'PRODUCTION_PREVIEW' });

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toBeDefined();
    expect(res.body.evaluation.isEligible).toBe(false);
    expect(res.body.evaluation.gateCriteria.length).toBeGreaterThanOrEqual(2);
  });

  it('lists promotion decision records', async () => {
    const res = await request(app).get('/api/capabilities/promotions/decisions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.decisions)).toBe(true);
  });

  it('POST /api/capabilities/promotions/promote executes promotion when user has developer/admin role', async () => {
    process.env.CF_ACCESSIBILITY_CERTIFIED = 'true';
    CapabilityObservabilityService.getInstance().recordTelemetry({
      capabilityId: 'repo_architecture', operation: 'route-promotion-test', durationMs: 10, success: true,
      auditCorrelationId: 'route-promotion-test-correlation', privacyMode: 'prefer_local'
    });
    const res = await request(app)
      .post('/api/capabilities/promotions/promote')
      .set('x-test-role', 'admin')
      .send({
        capabilityId: 'repo_architecture',
        targetMaturity: 'PRODUCTION_PREVIEW',
        rationale: 'Passed full CF-10 verification',
        confirmedScope: 'PROMOTE_CAPABILITY:repo_architecture:PRODUCTION_PREVIEW'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.decisionRecord).toBeDefined();
    expect(res.body.decisionRecord.sha256Digest).toHaveLength(64);
  });

  it('POST /api/capabilities/promotions/rollback executes rollback for degraded capability', async () => {
    CapabilityRegistry.getInstance().updateCapabilityMaturity('repo_architecture', 'PRODUCTION_PREVIEW');
    const res = await request(app)
      .post('/api/capabilities/promotions/rollback')
      .set('x-test-role', 'admin')
      .send({
        capabilityId: 'repo_architecture',
        rollbackMaturity: 'LOCAL_ONLY_EXPERIMENTAL',
        reason: 'Automated rollback triggered',
        confirmedScope: 'ROLLBACK_CAPABILITY:repo_architecture:LOCAL_ONLY_EXPERIMENTAL'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Rollback completed');
  });

  it('validates required promotion and rollback fields, maturities, and exact scopes', async () => {
    const missingPromotion = await request(app).post('/api/capabilities/promotions/promote').send({});
    expect(missingPromotion.status).toBe(400);
    const badPromotionMaturity = await request(app).post('/api/capabilities/promotions/promote').send({
      capabilityId: 'repo_architecture', targetMaturity: 'INVALID'
    });
    expect(badPromotionMaturity.status).toBe(400);
    const badPromotionScope = await request(app).post('/api/capabilities/promotions/promote').send({
      capabilityId: 'repo_architecture', targetMaturity: 'PRODUCTION_PREVIEW', confirmedScope: 'WRONG'
    });
    expect(badPromotionScope.status).toBe(400);

    const missingRollback = await request(app).post('/api/capabilities/promotions/rollback').send({});
    expect(missingRollback.status).toBe(400);
    const badRollbackMaturity = await request(app).post('/api/capabilities/promotions/rollback').send({
      capabilityId: 'repo_architecture', rollbackMaturity: 'INVALID', reason: 'fixture'
    });
    expect(badRollbackMaturity.status).toBe(400);
    const badRollbackScope = await request(app).post('/api/capabilities/promotions/rollback').send({
      capabilityId: 'repo_architecture', rollbackMaturity: 'LOCAL_ONLY_EXPERIMENTAL',
      reason: 'fixture', confirmedScope: 'WRONG'
    });
    expect(badRollbackScope.status).toBe(400);
  });

  it('returns policy failures from promotion and rollback engines', async () => {
    const promotion = await request(app)
      .post('/api/capabilities/promotions/promote')
      .set('x-test-role', 'user')
      .send({
        capabilityId: 'repo_architecture', targetMaturity: 'PRODUCTION_PREVIEW',
        confirmedScope: 'PROMOTE_CAPABILITY:repo_architecture:PRODUCTION_PREVIEW'
      });
    expect(promotion.status).toBe(400);
    expect(promotion.body.error).toContain('authority');

    CapabilityRegistry.getInstance().updateCapabilityMaturity('repo_architecture', 'PRODUCTION_PREVIEW');
    const rollback = await request(app)
      .post('/api/capabilities/promotions/rollback')
      .set('x-test-role', 'user')
      .send({
        capabilityId: 'repo_architecture', rollbackMaturity: 'LOCAL_ONLY_EXPERIMENTAL', reason: 'fixture',
        confirmedScope: 'ROLLBACK_CAPABILITY:repo_architecture:LOCAL_ONLY_EXPERIMENTAL'
      });
    expect(rollback.status).toBe(400);
    expect(rollback.body.error).toContain('authority');
  });

  it('executes capability actions, records failures, and validates action IDs', async () => {
    const missingAction = await request(app).post('/api/capabilities/browser_jobs/action').send({});
    expect(missingAction.status).toBe(400);

    const success = await request(app)
      .post('/api/capabilities/lattice_gamedev/action')
      .send({ actionId: 'test_run', requester: 'route-fixture' });
    expect(success.status).toBe(200);
    expect(success.body.success).toBe(true);

    const failed = await request(app)
      .post('/api/capabilities/repository_findings/action')
      .set('x-test-no-user', 'true')
      .send({ actionId: 'test_run' });
    expect(failed.status).toBe(400);
    expect(failed.body.error).toContain('does not yet have a verified diagnostic handler');
  });

  it('cancels jobs and confirms exact-scope pending jobs with failure guards', async () => {
    const manager = CapabilityJobManager.getInstance();
    manager.registerJob({
      id: 'cancel-route-job', capabilityId: 'browser_jobs', category: 'browser',
      title: 'Cancel route fixture', requester: 'route-test'
    });
    let res = await request(app).post('/api/capabilities/jobs/cancel-route-job/cancel').send({ reason: 'fixture cancel' });
    expect(res.status).toBe(200);
    expect(res.body.job.fallbackReason).toBe('fixture cancel');
    res = await request(app).post('/api/capabilities/jobs/cancel-route-job/cancel').send({});
    expect(res.status).toBe(400);

    manager.registerJob({
      id: 'confirm-route-job', capabilityId: 'typed_agent_teams', category: 'agent_teams',
      title: 'Confirm route fixture', requester: 'route-test', requiresExactScopeConfirmation: true,
      confirmationScope: 'ROUTE_SCOPE'
    });
    res = await request(app).post('/api/capabilities/jobs/confirm-route-job/confirm').send({});
    expect(res.status).toBe(400);
    res = await request(app).post('/api/capabilities/jobs/confirm-route-job/confirm').send({ confirmedScope: 'WRONG' });
    expect(res.status).toBe(400);
    res = await request(app).post('/api/capabilities/jobs/confirm-route-job/confirm').send({ confirmedScope: 'ROUTE_SCOPE' });
    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('running');
  });

  it('does not accept a caller-controlled x-user-role header as promotion authority', async () => {
    const res = await request(app)
      .post('/api/capabilities/promotions/promote')
      .set('x-test-role', 'user')
      .set('x-user-role', 'admin')
      .send({
        capabilityId: 'repo_architecture',
        targetMaturity: 'PRODUCTION_PREVIEW',
        rationale: 'spoofed role attempt',
        confirmedScope: 'PROMOTE_CAPABILITY:repo_architecture:PRODUCTION_PREVIEW'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('does not have authority');
  });

  it('rejects unknown evaluation domains and maturity values', async () => {
    const badDomain = await request(app)
      .post('/api/capabilities/evaluations/run')
      .send({ domains: ['not_a_domain'] });
    expect(badDomain.status).toBe(400);

    const badMaturity = await request(app)
      .post('/api/capabilities/promotions/evaluate')
      .send({ capabilityId: 'repo_architecture', targetMaturity: 'SUPER_STABLE' });
    expect(badMaturity.status).toBe(400);

    const missingEvaluationFields = await request(app)
      .post('/api/capabilities/promotions/evaluate')
      .send({ capabilityId: 'repo_architecture' });
    expect(missingEvaluationFields.status).toBe(400);
  });

  it('clamps repository finding limits and handles non-numeric values', async () => {
    const tiny = express();
    tiny.use(express.json());
    tiny.use('/api/capabilities', createCapabilityRouter(process.cwd()));
    const low = await request(tiny).get('/api/capabilities/repository-findings?maxFiles=0');
    expect(low.status).toBe(200);
    const fallback = await request(tiny).get('/api/capabilities/repository-findings?maxFiles=not-a-number');
    expect(fallback.status).toBe(200);
  });

  it('returns stable 500 responses when internal services throw', async () => {
    const registry = CapabilityRegistry.getInstance();
    jest.spyOn(registry, 'getCapabilities').mockImplementationOnce(() => { throw new Error('list fixture'); });
    expect((await request(app).get('/api/capabilities')).status).toBe(500);

    jest.spyOn(CapabilityJobManager.getInstance(), 'listJobs').mockImplementationOnce(() => { throw new Error('jobs fixture'); });
    expect((await request(app).get('/api/capabilities/jobs/list')).status).toBe(500);

    jest.spyOn(CapabilityEvaluationSuite.getInstance(), 'runSuite').mockRejectedValueOnce(new Error('eval fixture'));
    expect((await request(app).post('/api/capabilities/evaluations/run').send({})).status).toBe(500);

    const observability = CapabilityObservabilityService.getInstance();
    jest.spyOn(observability, 'getDashboardSummary').mockImplementationOnce(() => { throw new Error('dashboard fixture'); });
    expect((await request(app).get('/api/capabilities/metrics/dashboard')).status).toBe(500);
    jest.spyOn(observability, 'generateSupportBundle').mockImplementationOnce(() => { throw new Error('bundle fixture'); });
    expect((await request(app).get('/api/capabilities/support-bundle')).status).toBe(500);

    const promotion = CapabilityPromotionEngine.getInstance();
    jest.spyOn(promotion, 'evaluatePromotion').mockRejectedValueOnce(new Error('promotion fixture'));
    expect((await request(app).post('/api/capabilities/promotions/evaluate').send({
      capabilityId: 'repo_architecture', targetMaturity: 'PRODUCTION_PREVIEW'
    })).status).toBe(500);
    jest.spyOn(promotion, 'executePromotion').mockRejectedValueOnce(new Error('execute fixture'));
    expect((await request(app).post('/api/capabilities/promotions/promote').set('x-test-role', 'admin').send({
      capabilityId: 'repo_architecture', targetMaturity: 'PRODUCTION_PREVIEW',
      confirmedScope: 'PROMOTE_CAPABILITY:repo_architecture:PRODUCTION_PREVIEW'
    })).status).toBe(500);
    jest.spyOn(promotion, 'executeRollback').mockRejectedValueOnce(new Error('rollback fixture'));
    expect((await request(app).post('/api/capabilities/promotions/rollback').set('x-test-role', 'admin').send({
      capabilityId: 'repo_architecture', rollbackMaturity: 'LOCAL_ONLY_EXPERIMENTAL', reason: 'fixture',
      confirmedScope: 'ROLLBACK_CAPABILITY:repo_architecture:LOCAL_ONLY_EXPERIMENTAL'
    })).status).toBe(500);

    jest.spyOn(registry, 'getCapabilityById').mockImplementationOnce(() => { throw new Error('get fixture'); });
    expect((await request(app).get('/api/capabilities/browser_jobs')).status).toBe(500);
    jest.spyOn(registry, 'executeAction').mockRejectedValueOnce(new Error('action fixture'));
    expect((await request(app).post('/api/capabilities/browser_jobs/action').send({ actionId: 'test_run' })).status).toBe(500);

    jest.spyOn(CapabilityJobManager.getInstance(), 'cancelJob').mockImplementationOnce(() => { throw new Error('cancel fixture'); });
    expect((await request(app).post('/api/capabilities/jobs/job/cancel').send({})).status).toBe(500);
    jest.spyOn(CapabilityJobManager.getInstance(), 'confirmExactScope').mockImplementationOnce(() => { throw new Error('confirm fixture'); });
    expect((await request(app).post('/api/capabilities/jobs/job/confirm').send({ confirmedScope: 'scope' })).status).toBe(500);
  });
});
