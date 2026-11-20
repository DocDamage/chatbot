import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../../../core/database/Database';
import { GameProjectStore } from '../../../core/gaming/project/GameProjectStore';
import { GameProjectRegistry } from '../../../core/gaming/project/GameProjectRegistry';
import { ProjectRuntimeCatalog } from '../../../core/gaming/project/ProjectRuntimeCatalog';
import { ProjectProfileResolver } from '../../../core/gaming/project/ProjectProfileResolver';
import { createGameStudioRouter } from '../game-studio/gameStudioRoutes';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../core/native-runtime', () => ({
  ...jest.requireActual('../../../core/native-runtime'), discoverLocalRuntimes: jest.fn(() => ({ ollamaEndpoint: 'http://127.0.0.1:11434' }))
}));

describe('G01 authenticated production Game Studio enrollment routes (real SQLite)', () => {
  let root: string, game: string, executable: string, database: Database;
  let app: express.Application, registry: GameProjectRegistry;
  const makeApp = (service?: GameProjectRegistry) => {
    const instance = express(); instance.use(express.json());
    instance.use((req, _res, next) => { const user = req.header('x-fixture-user'); if (user) req.user = { userId: user, roles: ['developer'] }; next(); });
    instance.use(createGameStudioRouter(root, { projectRegistry: service }), errorHandler);
    return instance;
  };
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-enrollment-route-')); game = path.join(root, 'game');
    fs.mkdirSync(game); fs.writeFileSync(path.join(game, 'project.godot'), 'config_version=5\n[application]\nconfig/features=PackedStringArray("4.7")\n');
    executable = path.join(root, 'godot-fixture.exe'); fs.writeFileSync(executable, 'fixture executable');
    const catalog = new ProjectRuntimeCatalog(root, () => [{ engine: 'godot', executablePath: executable }], async () => ({ exitCode: 0, stdout: '4.7.1.stable.official.fixture', stderr: '', durationMs: 1 }));
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'profiles.db') }); await database.initialize();
    registry = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(catalog), 'test'); app = makeApp(registry);
  });
  afterEach(async () => {
    await database.close();
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true });
  });

  it('gets host-inspected choices, enrolls under the authenticated owner and preserves the profile through router/database restart', async () => {
    const inventory = await request(app).get('/api/game-studio/runtimes?engine=godot').set('x-fixture-user', 'alice').expect(200);
    const selectedRuntimeId = inventory.body.runtimes[0].runtimeId;
    const enrolled = await request(app).post('/api/game-studio/projects').set('x-fixture-user', 'alice').send({
      projectRoot: game, engine: 'godot', selectedRuntimeId, ownerId: 'spoofed', tenantId: 'spoofed',
      executablePath: 'untrusted-command.exe', profile: { resolution: 'resolved' }
    }).expect(201);
    expect(enrolled.body).toMatchObject({ ownerId: 'alice', tenantId: 'local', revision: 1, profile: { resolution: 'resolved', runtime: { executablePath: executable } } });
    const id = enrolled.body.projectId;
    await request(app).get(`/api/game-studio/projects/${id}`).set('x-fixture-user', 'bob').expect(404);
    const bob = await request(app).get('/api/game-studio/projects').set('x-fixture-user', 'bob').expect(200);
    expect(bob.body.projects).toEqual([]);
    await database.close(); database = new Database({ type: 'sqlite', filePath: path.join(root, 'profiles.db') }); await database.initialize();
    registry = new GameProjectRegistry(root, new GameProjectStore(database), registry.resolver, 'test'); app = makeApp(registry);
    const restored = await request(app).get(`/api/game-studio/projects/${id}`).set('x-fixture-user', 'alice').expect(200);
    expect(restored.body.profile.profileDigest).toBe(enrolled.body.profile.profileDigest);
    const session = await request(app).post('/api/game-studio/connect').set('x-fixture-user', 'alice').send({ projectId: id }).expect(200);
    expect(session.body).toMatchObject({ projectId: id, version: '4.7.1.stable.official.fixture' });
  });

  it('returns unresolved requirements and revision conflicts without applying project changes', async () => {
    const enrolled = await request(app).post('/api/game-studio/projects').set('x-fixture-user', 'alice').send({ projectRoot: game, engine: 'godot' }).expect(201);
    expect(enrolled.body.profile.resolution).toBe('blocked');
    expect(enrolled.body.profile.blockers[0].code).toBe('RUNTIME_SELECTION_REQUIRED');
    const id = enrolled.body.projectId;
    const wrong = await request(app).post(`/api/game-studio/projects/${id}/refresh`).set('x-fixture-user', 'alice')
      .send({ expectedRevision: 1, expectedVersion: '4.6.1.stable.official.fixture' }).expect(200);
    expect(wrong.body.profile.resolution).toBe('blocked');
    await request(app).post(`/api/game-studio/projects/${id}/refresh`).set('x-fixture-user', 'alice').send({ expectedRevision: 1 }).expect(409);
    fs.appendFileSync(path.join(game, 'project.godot'), '# changed');
    await request(app).get(`/api/game-studio/projects/${id}`).set('x-fixture-user', 'alice').expect(409);
    expect(fs.readdirSync(game)).toEqual(['project.godot']);
  });

  it('requires authentication/persistence and rejects paths outside the workspace or executable-path runtime IDs', async () => {
    await request(app).get('/api/game-studio/projects').expect(401);
    await request(makeApp()).get('/api/game-studio/projects').set('x-fixture-user', 'alice').expect(503);
    await request(app).post('/api/game-studio/projects').set('x-fixture-user', 'alice').send({ engine: 'godot', projectRoot: os.tmpdir() }).expect(400);
    await request(app).post('/api/game-studio/projects').set('x-fixture-user', 'alice').send({ engine: 'godot', projectRoot: game, expectedVersion: ' bad ' }).expect(400);
    const unresolved = await request(app).post('/api/game-studio/projects').set('x-fixture-user', 'alice').send({ engine: 'godot', projectRoot: game, selectedRuntimeId: executable }).expect(201);
    expect(unresolved.body.profile.resolution).toBe('blocked');
  });
});
