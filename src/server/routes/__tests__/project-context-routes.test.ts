import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createGameStudioRouter } from '../game-studio/gameStudioRoutes';
import { createCodingToolsRouter } from '../coding-tools';
import { createSessionFixture } from '../../../core/gaming/project/__tests__/SessionFixture';
import { CodingToolsService } from '../../../core/coding/integrations/CodingToolsService';
import { codingToolConfig } from '../../../core/coding/integrations/CodingToolConfig';
import { AiderAdapter } from '../../../core/coding/integrations/AiderAdapter';
import { createProjectFilePolicy } from '../../../core/gaming/project/ProjectFilePolicy';
import { AuthService } from '../../../core/auth/AuthService';
import { requireAuth, requireRole } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../core/native-runtime/RuntimeDiscovery', () => ({ discoverLocalRuntimes: () => ({ ollamaEndpoint: '' }) }));
jest.mock('../../../core/observability/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('G01.3 real HTTP project source/context policy', () => {
  let root: string, app: express.Express, auth: AuthService;
  let fixture: Awaited<ReturnType<typeof createSessionFixture>>;
  const priorSecret = process.env.JWT_SECRET, owner = { ownerId: 'alice', tenantId: 'local' };
  const write = (name: string, value: string) => { const full = path.join(root, name); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, value); };
  const token = (id = 'alice', role = 'developer') => auth.generateToken({ id, roles: [role] });
  const post = (projectId: string, body: object, id = 'alice') => request(app).post(`/api/game-studio/projects/${projectId}/context`).auth(token(id), { type: 'bearer' }).send(body);
  beforeEach(async () => {
    process.env.JWT_SECRET = 'project-context-tests-signing-value-with-enough-characters'; auth = new AuthService();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-context-http-')); fixture = await createSessionFixture(root);
    app = express(); app.use(express.json(), requireAuth, requireRole('developer', 'admin'));
    app.use(createGameStudioRouter(root, { projectRegistry: fixture.registry, bridgeFactory: fixture.bridgeFactory }), errorHandler);
  });
  afterEach(async () => {
    await fixture.close(); jest.restoreAllMocks(); if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret;
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true });
  });

  it('follows scene/script/resource context under an authenticated enrollment and rejects root/kind/owner spoofing', async () => {
    const project = await fixture.enroll(path.join(root, 'godot'), 'godot', owner);
    write('godot/Main.tscn', '[gd_scene format=3]\n[ext_resource path="res://Player.gd" type="Script" id="1"]\n[node name="SCENE_CANARY" type="Node"]\nscript=ExtResource("1")\n');
    write('godot/Player.gd', '\ufeffextends Node\r\nconst Fixture = preload("res://Item.tres")\r\n'); write('godot/Item.tres', '[gd_resource type="Resource" format=3]\n[resource]\n');
    write('godot/.godot/imported/Cache.gd', 'PRIVATE_CACHE_CANARY'); write('godot/secrets/Private.gd', 'PRIVATE_SECRET_CANARY');
    write('other/Foreign.gd', 'FOREIGN_PROJECT_CANARY');
    await request(app).post(`/api/game-studio/projects/${project.projectId}/context`).send({ files: ['Main.tscn'] }).expect(401);
    await request(app).get(`/api/game-studio/projects/${project.projectId}/files`).auth(token('alice', 'user'), { type: 'bearer' }).expect(403);
    await post(project.projectId, { files: ['Main.tscn'], ownerId: 'alice' }, 'bob').expect(404);
    const response = await post(project.projectId, { files: ['Main.tscn'], projectRoot: path.join(root, 'other'), kind: 'rom', ownerId: 'bob', tenantId: 'foreign' }).expect(200);
    expect(response.headers['cache-control']).toBe('no-store'); expect(response.body.editable).toEqual([]);
    expect(response.body.readOnly.map((f: any) => f.path)).toEqual(expect.arrayContaining(['Main.tscn', 'Player.gd', 'Item.tres']));
    expect(response.body.summary.find((f: any) => f.path === 'Main.tscn')).toMatchObject({ role: 'read_only', fileRole: 'editable-text' });
    const player = response.body.readOnly.find((f: any) => f.path === 'Player.gd');
    expect(player.sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'godot/Player.gd'))).digest('hex'));
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_CACHE_CANARY|PRIVATE_SECRET_CANARY|FOREIGN_PROJECT_CANARY/);
    const search = await request(app).get(`/api/game-studio/projects/${project.projectId}/files/search?q=SCENE_CANARY`).auth(token(), { type: 'bearer' }).expect(200);
    expect(search.body.matches[0].path).toBe('Main.tscn');
    const before = response.body.contextDigest; write('godot/Player.gd', 'extends Node\n# changed source\n');
    const next = await post(project.projectId, { files: ['Main.tscn'] }).expect(200); expect(next.body.contextDigest).not.toBe(before);
    expect(next.body.projectScope).toMatchObject({ projectId: project.projectId, profileRevision: 1, profileDigest: project.profile.profileDigest });
  });

  it('makes MZ database context usable while runtime enrollment stays explicitly blocked and data/core remain read-only', async () => {
    write('mz/Game.rmmzproject', 'RPGMZ 1.0'); write('mz/js/rmmz_core.js', 'Utils.RPGMAKER_NAME = "MZ"; Utils.RPGMAKER_VERSION = "1.9.0";');
    write('mz/js/plugins.js', 'var $plugins = [{"name":"Checkpoint","status":true,"parameters":{}}];'); write('mz/js/plugins/Checkpoint.js', '// authored implementation');
    write('mz/data/Actors.json', '[null,{"id":1,"classId":1,"name":"MZ_ACTOR_CANARY"}]'); write('mz/data/Classes.json', '[null,{"id":1}]'); write('mz/save/slot.json', 'SAVE_CANARY');
    const project = await fixture.registry.enroll(owner, path.join(root, 'mz'), 'rpg-maker-mz'); expect(project.profile.resolution).toBe('blocked');
    const response = await post(project.projectId, { files: ['data/Actors.json', 'js/plugins.js'] }).expect(200);
    expect(response.body.editable).toEqual([]); expect(response.body.readOnly.map((f: any) => f.path)).toContain('data/Classes.json');
    expect(response.body.summary.find((f: any) => f.path === 'data/Actors.json').fileRole).toBe('structured-data');
    expect(response.body.dependencies.edges).toContainEqual(expect.objectContaining({ kind: 'mz-plugin-order:0:enabled', to: 'js/plugins/Checkpoint.js' }));
    const files = await request(app).get(`/api/game-studio/projects/${project.projectId}/files`).auth(token(), { type: 'bearer' }).expect(200);
    expect(files.body.files.find((f: any) => f.path === 'data/Actors.json')).toMatchObject({ textReadable: true, genericTextEditable: false });
    expect(files.body.files.some((f: any) => f.path.startsWith('save/'))).toBe(false);
    await request(app).post('/api/game-studio/connect').auth(token(), { type: 'bearer' }).send({ projectId: project.projectId }).expect(409);
  });

  it('admits only the Unreal module Private source exception through discovery, search and context', async () => {
    const project = await fixture.enroll(path.join(root, 'unreal'), 'unreal', owner);
    write('unreal/Source/Game/Private/Player.cpp', '#include "Player.h"\n// UNREAL_SOURCE_CANARY'); write('unreal/Source/Game/Public/Player.h', '// header');
    write('unreal/Source/Game/Private/secrets.cpp', 'UNREAL_SECRET_CANARY'); write('unreal/Intermediate/Generated.cpp', 'GENERATED_CANARY'); write('unreal/Content/World.umap', 'BINARY_ASSET_CANARY');
    const context = await post(project.projectId, { files: ['Source/Game/Private/Player.cpp'] }).expect(200);
    expect(context.body.readOnly.map((f: any) => f.path)).toContain('Source/Game/Public/Player.h');
    expect(JSON.stringify(context.body)).not.toMatch(/UNREAL_SECRET_CANARY|GENERATED_CANARY|BINARY_ASSET_CANARY/);
    const search = await request(app).get(`/api/game-studio/projects/${project.projectId}/files/search?q=UNREAL_SOURCE_CANARY`).auth(token(), { type: 'bearer' }).expect(200);
    expect(search.body.matches[0].path).toBe('Source/Game/Private/Player.cpp');
    await post(project.projectId, { files: ['Content/World.umap'] }).expect(403);
  });

  it('rejects changed profiles, binary capture, malformed requests, links and out-of-root source paths', async () => {
    const project = await fixture.enroll(path.join(root, 'godot'), 'godot', owner);
    write('godot/Main.gd', 'extends Node\n'); write('outside/Foreign.gd', 'FOREIGN');
    fs.symlinkSync(path.join(root, 'outside'), path.join(root, 'godot/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await post(project.projectId, { files: [] }).expect(400); await post(project.projectId, { files: ['Main.gd'], automaticContext: 'yes' }).expect(400);
    for (const file of ['../outside/Foreign.gd', 'linked/Foreign.gd', 'Main.gd:stream', '.env']) {
      const response = await post(project.projectId, { files: [file] }); expect(response.status).toBeGreaterThanOrEqual(400);
    }
    fs.appendFileSync(path.join(root, 'godot/project.godot'), '# changed descriptor');
    await post(project.projectId, { files: ['Main.gd'] }).expect(409);
  });

  it('passes scoped ROM assembly/include context through the existing coding route without reading binary bytes or changing the default policy', async () => {
    write('rom/data/main.asm', 'incsrc "levels.inc"\nincbin "original.sfc"\n'); write('rom/data/levels.inc', 'LevelTable:\n db $01\n'); write('rom/data/original.sfc', 'ROM_BYTES_NEVER_CAPTURED');
    const config = { ...codingToolConfig(root), enabled: true, dataRoot: path.join(root, 'coding-jobs') };
    // Server-trusted source-only policy injection. ROM enrollment/native execution remain later gates.
    const tools = new CodingToolsService(path.join(root, 'rom'), config, createProjectFilePolicy('rom'));
    const propose = jest.spyOn(AiderAdapter.prototype, 'propose').mockResolvedValue({ provider: 'fixture', operations: [] } as any);
    const codingApp = express(); codingApp.use(express.json(), requireAuth, requireRole('developer', 'admin'));
    codingApp.use('/api/code/tools', createCodingToolsRouter(tools), errorHandler);
    try {
      const result = await request(codingApp).post('/api/code/tools/propose').auth(token(), { type: 'bearer' }).send({ files: ['data/main.asm'], message: 'Review level table', projectRoot: root, kind: 'godot' }).expect(200);
      expect(result.body.selection.files).toContainEqual(expect.objectContaining({ path: 'data/main.asm', role: 'editable', fileRole: 'editable-text' }));
      expect(result.body.selection.files).toContainEqual(expect.objectContaining({ path: 'data/levels.inc', role: 'read_only' }));
      expect(JSON.stringify(propose.mock.calls)).not.toContain('ROM_BYTES_NEVER_CAPTURED');
      expect(result.body.selection.omissions).toContainEqual(expect.objectContaining({ path: 'data/original.sfc' }));
      expect(tools.getJob('alice', result.body.runId)).toMatchObject({ result: { selection: { dependencies: { edges: expect.any(Array) } } } });
      expect(fs.readFileSync(path.join(root, 'rom/data/levels.inc'), 'utf8')).toContain('$01');
    } finally { tools.shutdown(); }
  });
});
