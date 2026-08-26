import express from 'express';
import request from 'supertest';
import { createCapabilityRouter } from '../capabilities';

describe('B75-08: Capability Routes Full Decision and Promotion Matrix', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Simulate user / admin roles via middleware
    app.use((req: any, _res, next) => {
      if (req.headers['x-test-role'] === 'admin') {
        req.user = { userId: 'admin-1', roles: ['admin'] };
      } else if (req.headers['x-test-role'] === 'developer') {
        req.user = { userId: 'dev-1', roles: ['developer'] };
      } else {
        req.user = { userId: 'user-1', roles: ['user'] };
      }
      next();
    });
    app.use('/api/capabilities', createCapabilityRouter());
  });

  it('lists capabilities and returns system profile and user role', async () => {
    const res = await request(app)
      .get('/api/capabilities')
      .set('x-test-role', 'developer')
      .expect(200);

    expect(res.body.userRole).toBe('developer');
    expect(Array.isArray(res.body.capabilities)).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('handles evaluation runs and validates domain inputs', async () => {
    // Invalid domain -> 400
    const badRes = await request(app)
      .post('/api/capabilities/evaluations/run')
      .send({ domains: ['invalid_fake_domain_xyz'] })
      .expect(400);
    expect(badRes.body.error).toContain('domains must contain only supported');

    // Valid single domain run
    const goodRes = await request(app)
      .post('/api/capabilities/evaluations/run')
      .send({ domains: ['path_containment_and_secret_denial'] })
      .expect(200);
    expect(goodRes.body.result).toBeDefined();
    expect(goodRes.body.result.overallScore).toBeDefined();
  });

  it('retrieves evaluation decisions and observability metrics', async () => {
    const decisionsRes = await request(app)
      .get('/api/capabilities/promotions/decisions')
      .expect(200);
    expect(Array.isArray(decisionsRes.body.decisions)).toBe(true);

    const obsRes = await request(app)
      .get('/api/capabilities/metrics/dashboard')
      .expect(200);
    expect(obsRes.body.dashboard).toBeDefined();
  });

  it('enforces RBAC gates on promotion and rollback endpoints', async () => {
    // Non-admin attempt -> 400 (rejected by engine)
    const forbiddenPromote = await request(app)
      .post('/api/capabilities/promotions/promote')
      .set('x-test-role', 'developer')
      .send({
        capabilityId: 'browser_jobs',
        targetMaturity: 'PRODUCTION_SUPPORTED',
        confirmedScope: 'PROMOTE_CAPABILITY:browser_jobs:PRODUCTION_SUPPORTED'
      })
      .expect(400);
    expect(forbiddenPromote.body.error).toBeDefined();

    const forbiddenRollback = await request(app)
      .post('/api/capabilities/promotions/rollback')
      .set('x-test-role', 'developer')
      .send({
        capabilityId: 'browser_jobs',
        rollbackMaturity: 'LOCAL_ONLY_EXPERIMENTAL',
        reason: 'Degraded health',
        confirmedScope: 'ROLLBACK_CAPABILITY:browser_jobs:LOCAL_ONLY_EXPERIMENTAL'
      })
      .expect(400);
    expect(forbiddenRollback.body.error).toBeDefined();

    // Admin attempt with missing fields -> 400
    const badAdminPromote = await request(app)
      .post('/api/capabilities/promotions/promote')
      .set('x-test-role', 'admin')
      .send({})
      .expect(400);
    expect(badAdminPromote.body.error).toContain('required');
  });

  it('retrieves single capability by id and handles not found', async () => {
    const capRes = await request(app)
      .get('/api/capabilities/browser_jobs')
      .expect(200);
    expect(capRes.body.capability.id).toBe('browser_jobs');

    const notFoundRes = await request(app)
      .get('/api/capabilities/nonexistent_cap_xyz')
      .expect(404);
    expect(notFoundRes.body.error).toContain('not found');

    // Action execution (missing actionId -> 400)
    await request(app)
      .post('/api/capabilities/browser_jobs/action')
      .send({})
      .expect(400);

    // Job lookup (missing job -> 404)
    await request(app)
      .get('/api/capabilities/jobs/nonexistent_job_123')
      .expect(404);

    // Jobs list
    const jobsList = await request(app)
      .get('/api/capabilities/jobs/list')
      .expect(200);
    expect(Array.isArray(jobsList.body.jobs)).toBe(true);
  });
});
