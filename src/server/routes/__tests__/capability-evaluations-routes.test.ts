import express from 'express';
import request from 'supertest';
import { createCapabilityRouter } from '../capabilities';
import { CapabilityRegistry } from '../../../core/capabilities/CapabilityRegistry';
import { CapabilityObservabilityService } from '../../../core/capabilities/observability/CapabilityObservabilityService';

describe('Capability Evaluation, Promotion and Metrics API Routes (CF-10)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = {
        userId: 'capability-route-test',
        roles: [String(req.headers['x-test-role'] || 'developer')]
      };
      next();
    });
    app.use('/api/capabilities', createCapabilityRouter());
    CapabilityRegistry.getInstance().clearOverrides();
    CapabilityObservabilityService.getInstance().resetTelemetry();
    delete process.env.CF_ACCESSIBILITY_CERTIFIED;
  });

  afterEach(() => delete process.env.CF_ACCESSIBILITY_CERTIFIED);

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
  });
});
