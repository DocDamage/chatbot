import express from 'express';
import request from 'supertest';
import { createAgentOperationsRouter, resetAgentOperationsForTests } from '../agent-operations';

describe('Agent Operations routes (PX-06)', () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: 'route-operator', roles: ['developer'] };
    next();
  });
  app.use(createAgentOperationsRouter());

  afterEach(() => resetAgentOperationsForTests());

  it('creates, inspects, pauses, and resumes a bounded managed session', async () => {
    const created = await request(app).post('/api/agent-operations/sessions').send({
      agentId: 'fixture-agent', projectId: 'fixture-project', role: 'reviewer',
      allowedTools: ['read_file'], allowedScopes: ['src/**']
    });
    expect(created.status).toBe(201);
    expect(created.body.session).toMatchObject({
      agentId: 'fixture-agent', ownerId: 'route-operator', projectId: 'fixture-project', role: 'reviewer'
    });
    expect(created.body.session.permissions.requiresApprovalForMutation).toBe(true);

    const sessionId = created.body.session.sessionId;
    const paused = await request(app).post(`/api/agent-operations/sessions/${sessionId}/pause`).send({ reason: 'review' });
    expect(paused.status).toBe(200);
    expect(paused.body.session.state).toBe('paused');

    const resumed = await request(app).post(`/api/agent-operations/sessions/${sessionId}/resume`).send({});
    expect(resumed.status).toBe(200);
    expect(resumed.body.session.state).toBe('active');

    const inspected = await request(app).get(`/api/agent-operations/sessions/${sessionId}`);
    expect(inspected.status).toBe(200);
    expect(inspected.body.events.length).toBeGreaterThanOrEqual(3);
  });

  it('reports project summaries and rejects unsupported roles', async () => {
    const rejected = await request(app).post('/api/agent-operations/sessions').send({ role: 'root', projectId: 'fixture-project' });
    expect(rejected.status).toBe(400);

    const summary = await request(app).get('/api/agent-operations/summary').query({ projectId: 'fixture-project' });
    expect(summary.status).toBe(200);
    expect(summary.body).toMatchObject({ activeSessionCount: 0, totalActiveClaims: 0 });
  });

  it('requires an exact project-bound scope before emergency stop-all', async () => {
    const created = await request(app).post('/api/agent-operations/sessions').send({
      agentId: 'fixture-agent', projectId: 'fixture-project', role: 'implementer'
    });
    expect(created.status).toBe(201);

    const blocked = await request(app).post('/api/agent-operations/stop-all').send({
      projectId: 'fixture-project', confirmedScope: 'STOP_ALL_AGENT_SESSIONS'
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.requiredScope).toBe('STOP_ALL_AGENT_SESSIONS:fixture-project');

    const stopped = await request(app).post('/api/agent-operations/stop-all').send({
      projectId: 'fixture-project', confirmedScope: 'STOP_ALL_AGENT_SESSIONS:fixture-project'
    });
    expect(stopped.status).toBe(200);
    expect(stopped.body.cancelledCount).toBe(1);
  });

  it('returns 404 for unknown sessions', async () => {
    expect((await request(app).get('/api/agent-operations/sessions/missing')).status).toBe(404);
    expect((await request(app).post('/api/agent-operations/sessions/missing/pause').send({})).status).toBe(404);
    expect((await request(app).post('/api/agent-operations/sessions/missing/resume').send({})).status).toBe(404);
  });
});
