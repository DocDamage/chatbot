import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameStudioRouter } from '../game-studio/gameStudioRoutes';
import { errorHandler } from '../../../middleware/errorHandler';
import { createSessionFixture } from '../../../core/gaming/project/__tests__/SessionFixture';

jest.mock('../../../core/native-runtime', () => ({
  ...jest.requireActual('../../../core/native-runtime'),
  discoverLocalRuntimes: jest.fn(() => ({ ollamaEndpoint: 'http://127.0.0.1:11434' }))
}));

describe('RT-PLAT-005 / RT-GAME-001: Game Studio routes with enrolled session approval', () => {
  let app: express.Application, root: string, sessionId: string;
  let fixture: Awaited<ReturnType<typeof createSessionFixture>>;
  const install = (target: express.Application, backendFactory = fixture.bridgeFactory) => {
    target.use(express.json());
    target.use((req, _res, next) => { req.user = { userId: req.header('x-fixture-user') || 'local-operator', roles: ['developer'] }; next(); });
    target.use(createGameStudioRouter(root, { projectRegistry: fixture.registry, bridgeFactory: backendFactory }), errorHandler);
  };
  const connect = async (directory: string, engine: 'godot' | 'unity' | 'unreal' = 'godot') => {
    const enrolled = await fixture.enroll(directory, engine);
    const result = await request(app).post('/api/game-studio/connect').send({ projectId: enrolled.projectId, engine }).expect(200);
    sessionId = result.body.sessionId; return result.body;
  };
  const post = (route: string, body = {}) => request(app).post(`/api/game-studio${route}`).send({ sessionId, ...body });
  const get = (route: string) => request(app).get(`/api/game-studio${route}`).query({ sessionId });
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-studio-routes-test-')); sessionId = '';
    fixture = await createSessionFixture(root); app = express(); install(app);
  });
  afterEach(async () => { await fixture.close(); jest.restoreAllMocks(); expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });

  it('serves studio summary and engine profiles', async () => {
    const summary = await request(app).get('/api/game-studio/summary').expect(200);
    expect(summary.body.installedRuntimes).toBeDefined();
    expect(summary.body.mutationCapabilities.godot).toContain('add_node');
    expect(summary.body.mutationCapabilities.godot).not.toContain('remove_node');
    const profiles = await request(app).get('/api/game-studio/profiles').expect(200);
    expect(profiles.body.profiles).toBeDefined();
  });

  it('rejects unsupported batches and stale inputs through real scoped proposal/apply routes', async () => {
    fs.writeFileSync(path.join(root, 'Main.tscn'), '[gd_scene format=3]\n[node name="Main" type="Node"]\n');
    await connect(root);
    const first = { type: 'create_scene', targetPath: 'First.tscn', params: {} };
    const proposed = await post('/proposals', { actions: [first, { type: 'remove_node', targetPath: 'Main.tscn', params: {} }],
      requesterId: 'spoofed', approverId: 'spoofed', status: 'approved', approvalDigest: 'spoofed' }).expect(200);
    expect(proposed.body).toMatchObject({ requesterId: 'local-operator', status: 'proposed', projectScope: { sessionId } });
    const approval = await post(`/proposals/${proposed.body.id}/approve`).expect(200);
    await post(`/proposals/${proposed.body.id}/apply`, { approvalDigest: approval.body.approvalDigest }).expect(400);
    expect(fs.existsSync(path.join(root, 'First.tscn'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'Main.tscn'), 'utf8')).toContain('Main');
    const stale = await post('/proposals', { actions: [first, { type: 'add_node', targetPath: 'Main.tscn', params: { nodeName: 'Player' } }] }).expect(200);
    const staleApproval = await post(`/proposals/${stale.body.id}/approve`).expect(200);
    fs.appendFileSync(path.join(root, 'Main.tscn'), '# external edit');
    const rejected = await post(`/proposals/${stale.body.id}/apply`, { approvalDigest: staleApproval.body.approvalDigest }).expect(400);
    expect(JSON.stringify(rejected.body)).toContain('modified since proposal');
    expect(fs.existsSync(path.join(root, 'First.tscn'))).toBe(false);
  });

  it('never publishes empty or absent injected backend assertions as passing', async () => {
    const runScenario = jest.fn();
    const configured = await createSessionFixture(path.join(root, 'backend-fixture'), { runScenario });
    // The helper creates its SQLite parent; the enrolled project stays inside the approved root.
    try {
      const custom = express(); custom.use(express.json(), (req, _res, next) => { req.user = { userId: 'local-operator' }; next(); });
      custom.use(createGameStudioRouter(root, { projectRegistry: configured.registry, bridgeFactory: configured.bridgeFactory }), errorHandler);
      const project = await configured.enroll(path.join(root, 'backend-fixture/game'));
      const connected = await request(custom).post('/api/game-studio/connect').send({ projectId: project.projectId }).expect(200);
      runScenario.mockResolvedValueOnce({ passed: true, assertions: [], scenarioName: 'fixture', durationMs: 1, capturedLogs: [] });
      const empty = await request(custom).post('/api/game-studio/runtime/scenario').send({ sessionId: connected.body.sessionId, assertions: [] }).expect(200);
      expect(empty.body.passed).toBe(false);
      runScenario.mockResolvedValueOnce(undefined);
      await request(custom).post('/api/game-studio/runtime/scenario').send({ sessionId: connected.body.sessionId, assertions: [{ type: 'node_exists', target: 'Player', expected: true }] }).expect(500);
    } finally { await configured.close(); }
  });

  it('connects an enrolled project and applies an identity-bound approved mutation', async () => {
    const directory = path.join(root, 'game_project'); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'project.godot'), 'config_version=5\n');
    fs.writeFileSync(path.join(directory, 'player.tscn'), '[gd_scene format=3]\n[node name="Player" type="CharacterBody2D"]\n');
    const connected = await connect(directory);
    const proposed = await post('/proposals', { engine: 'godot', projectId: connected.projectId, title: 'Add Sprite2D node',
      actions: [{ type: 'add_node', targetPath: 'player.tscn', params: { nodeType: 'Sprite2D', nodeName: 'Icon' } }] }).expect(200);
    const approval = await post(`/proposals/${proposed.body.id}/approve`, { approverId: 'body-spoof' }).expect(200);
    expect(approval.body.approverId).toBe('local-operator');
    await request(app).post(`/api/game-studio/proposals/${proposed.body.id}/apply`).set('x-fixture-user', 'wrong-user')
      .send({ sessionId, approvalDigest: approval.body.approvalDigest, callerId: 'local-operator' }).expect(404);
    const applied = await post(`/proposals/${proposed.body.id}/apply`, { approvalDigest: approval.body.approvalDigest }).expect(200);
    expect(applied.body.id).toBeDefined();
    expect(fs.readFileSync(path.join(directory, 'player.tscn'), 'utf8')).toContain('Icon');
  });

  it('retains MAST layout and slicing endpoints', async () => {
    await request(app).post('/api/game-studio/mast/layout').send({ width: 10, depth: 10, roomCount: 3 }).expect(200);
    await request(app).post('/api/game-studio/slicing/profile').send({ width: 64, height: 64, frames: 4 }).expect(200);
  });

  it('retains inspection, unavailable-native reporting, rollback, asset cooking and separate engine connections', async () => {
    const directory = path.join(root, 'game_project_2'); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'Main.tscn'), '[gd_scene format=3]\n[node name="Main" type="Node2D"]\n');
    fs.writeFileSync(path.join(directory, 'Player.gd'), 'extends Node2D\nfunc _ready():\n\tpass\n');
    await connect(directory);
    await get('/project').expect(200); await get('/scene?path=Main.tscn').expect(200); await get('/script?path=Player.gd').expect(200);
    await get('/profiler').expect(500);
    const scenario = await post('/runtime/scenario', { scenePath: 'Main.tscn', assertions: [] }).expect(500);
    expect(JSON.stringify(scenario.body)).toContain('GODOT_RUNTIME_BACKEND_UNAVAILABLE');
    await post('/export', { name: 'TestExport' }).expect(500);
    await post('/transactions/tx_123/rollback').expect(200);
    const custom = express(); custom.use(express.json(), createGameStudioRouter(root, { assetCookerExecutor: {
      cook: async options => ({ success: true, processedAssets: 5, targetPlatform: 'linux', outputArtifactPath: options.outputDirectory } as any)
    } }), errorHandler);
    await request(custom).post('/api/game-studio/asset-cook').send({ configRoot: root, targetPlatform: 'linux', dirtyOnly: false }).expect(200);
    await request(app).post('/api/game-studio/slicing/profile').send({ width: 32, height: 32, mode: 'grid' }).expect(200);
    const godotSession = sessionId;
    await connect(path.join(root, 'unity'), 'unity'); await post('/disconnect').expect(200);
    await connect(path.join(root, 'unreal'), 'unreal'); await post('/disconnect').expect(200);
    sessionId = godotSession; await post('/disconnect').expect(200);
  });
});
