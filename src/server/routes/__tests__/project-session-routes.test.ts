import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameStudioRouter } from '../game-studio/gameStudioRoutes';
import { errorHandler } from '../../../middleware/errorHandler';
import { createSessionFixture } from '../../../core/gaming/project/__tests__/SessionFixture';
import { scenarioBinding } from '../../../core/gaming/engine/NativeScenarioEvidence';

jest.mock('../../../core/native-runtime/RuntimeDiscovery', () => ({ discoverLocalRuntimes: () => ({ ollamaEndpoint: '' }) }));

describe('G01.2 HTTP project sessions with SQLite enrollment', () => {
  let root: string, app: express.Express;
  let fixture: Awaited<ReturnType<typeof createSessionFixture>>;
  let runScenario: jest.Mock;
  const owner = { ownerId: 'alice', tenantId: 'local' };
  const api = (route: string, body: object, actor = 'alice') => request(app).post(`/api/game-studio${route}`).set('x-fixture-user', actor).send(body);
  const get = (route: string, actor = 'alice') => request(app).get(`/api/game-studio${route}`).set('x-fixture-user', actor);
  const connect = async (name: string, actor = owner) => {
    const project = await fixture.enroll(path.join(root, name), 'godot', actor);
    return (await api('/connect', { projectId: project.projectId }, actor.ownerId).expect(200)).body;
  };
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-session-routes-'));
    runScenario = jest.fn(async (projectRoot, options, assertions) => ({ scenarioName: 'fixture', durationMs: 1, passed: true,
      evidence: scenarioBinding('godot', projectRoot, options.scenePath || '', assertions, options.scopeDigest), capturedLogs: [],
      assertions: assertions.map((item: any) => ({ ...item, actual: item.expected, passed: true })) }));
    fixture = await createSessionFixture(root, { runScenario }); app = express(); app.use(express.json());
    app.use((req, _res, next) => { const userId = req.header('x-fixture-user'); if (userId) req.user = { userId }; next(); });
    app.use(createGameStudioRouter(root, { projectRegistry: fixture.registry, bridgeFactory: fixture.bridgeFactory }), errorHandler);
  });
  afterEach(async () => {
    await fixture.close(); jest.restoreAllMocks(); expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true });
  });

  it('requires an authenticated enrollment and explicit session; cannot select a root or runtime through request spoofing', async () => {
    await request(app).post('/api/game-studio/connect').send({ projectId: 'unknown' }).expect(401);
    await api('/connect', { engine: 'godot', projectRoot: root }).expect(400);
    await get('/project?engine=godot').expect(400);
    const session = await connect('one');
    const wrong = await api('/connect', { projectId: session.projectId, engine: 'unity' }).expect(400);
    expect(wrong.body.error.code).toBe('PROJECT_ENGINE_MISMATCH');
    const same = await api('/connect', { projectId: session.projectId, projectRoot: path.join(root, 'elsewhere'), versionOverride: 'fake', executablePath: 'fake' }).expect(200);
    expect(same.body).toMatchObject({ sessionId: session.sessionId, projectPath: path.join(root, 'one'), version: '4.7.1.stable.official.fixture' });
    await get(`/project?sessionId=${session.sessionId}&engine=unity`).expect(400);
    await get(`/project?sessionId=${session.sessionId}&projectId=foreign`).expect(400);
    const unconfigured = express(); unconfigured.use(express.json(), (req, _res, next) => { req.user = { userId: 'alice' }; next(); });
    unconfigured.use(createGameStudioRouter(root), errorHandler);
    await request(unconfigured).post('/api/game-studio/connect').send({ projectId: session.projectId }).expect(503);
  });

  it('isolates concurrent same-engine roots, grants and rollback stores through the production router', async () => {
    const [a, b] = await Promise.all([connect('one'), connect('two')]);
    for (const [name, value] of [['one', 'First'], ['two', 'Second']]) fs.writeFileSync(path.join(root, name, 'Main.tscn'), `[gd_scene format=3]\n[node name="${value}" type="Node"]\n`);
    const scenes = await Promise.all([a, b].map(s => get(`/scene?sessionId=${s.sessionId}&path=Main.tscn`).expect(200)));
    expect(scenes.map(r => r.body.rootNode.name)).toEqual(['First', 'Second']);
    const proposals = await Promise.all([a, b].map((s, i) => api('/proposals', { sessionId: s.sessionId, requesterId: 'bob', tenantId: 'foreign', projectScope: { sessionId: 'spoofed' },
      actions: [{ type: 'create_script', targetPath: 'Created.gd', params: { content: `extends Node\n# ${i}\n` } }] }).expect(200)));
    expect(proposals[0].body).toMatchObject({ requesterId: 'alice', tenantId: 'local', projectScope: { sessionId: a.sessionId, runtimeId: a.runtimeId } });
    const approvals = await Promise.all(proposals.map((p, i) => api(`/proposals/${p.body.id}/approve`, { sessionId: [a, b][i].sessionId, approverId: 'bob' }).expect(200)));
    expect(approvals[0].body.approverId).toBe('alice');
    await api(`/proposals/${proposals[0].body.id}/apply`, { sessionId: b.sessionId, approvalDigest: approvals[0].body.approvalDigest }).expect(404);
    await api(`/proposals/${proposals[0].body.id}/apply`, { sessionId: a.sessionId, approvalDigest: approvals[0].body.approvalDigest, callerId: 'alice' }, 'bob').expect(404);
    expect((await get('/sessions', 'bob').expect(200)).body.sessions).toEqual([]);
    const transactions = await Promise.all(proposals.map((p, i) => api(`/proposals/${p.body.id}/apply`, { sessionId: [a, b][i].sessionId, approvalDigest: approvals[i].body.approvalDigest }).expect(200)));
    expect(fs.readFileSync(path.join(root, 'one/Created.gd'), 'utf8')).toContain('# 0');
    expect(fs.readFileSync(path.join(root, 'two/Created.gd'), 'utf8')).toContain('# 1');
    expect((await api(`/transactions/${transactions[0].body.id}/rollback`, { sessionId: b.sessionId }).expect(200)).body.success).toBe(false);
    await api(`/transactions/${transactions[0].body.id}/rollback`, { sessionId: a.sessionId }).expect(200);
    expect(fs.existsSync(path.join(root, 'one/Created.gd'))).toBe(false); expect(fs.existsSync(path.join(root, 'two/Created.gd'))).toBe(true);
  });

  it('locks the physical project across owners, rejects late evidence after profile drift and keeps other projects responsive', async () => {
    const a = await connect('one'); const b = await connect('one', { ...owner, ownerId: 'bob' }); const other = await connect('two');
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const paused = new Promise<void>(resolve => { release = resolve; });
    const implementation = runScenario.getMockImplementation()!;
    runScenario.mockImplementationOnce(async (...args) => { entered(); await paused; return implementation(...args); });
    const pending = api('/runtime/scenario', { sessionId: a.sessionId, assertions: [{ type: 'node_exists', target: 'Player', expected: true }] }).then(r => r);
    await ready;
    try {
      const busy = await get(`/project?sessionId=${b.sessionId}`, 'bob').expect(409); expect(busy.body.error.code).toBe('PROJECT_BUSY');
      await get(`/project?sessionId=${other.sessionId}`).expect(200);
      await api(`/projects/${a.projectId}/refresh`, { expectedRevision: 1 }).expect(409);
      fs.appendFileSync(path.join(root, 'one/project.godot'), '# external profile drift\n');
    } finally { release(); }
    expect((await pending).status).toBe(409);
    const refreshed = await api(`/projects/${a.projectId}/refresh`, { expectedRevision: 1, selectedRuntimeId: 'fixture-godot' }).expect(200);
    expect(refreshed.body.revision).toBe(2);
    await get(`/sessions/${a.sessionId}`).expect(409);
    const replacement = await api('/connect', { projectId: a.projectId }).expect(200); expect(replacement.body.sessionId).not.toBe(a.sessionId);
    await api('/disconnect', { sessionId: a.sessionId }).expect(200);
  });
});
