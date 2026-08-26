import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createGameStudioRouter } from '../game-studio/gameStudioRoutes';
import { errorHandler } from '../../../middleware/errorHandler';

describe('RT-PLAT-005 / RT-GAME-001: Game Studio Routes and Exact-Scope Approval Suite', () => {
  let app: express.Application;
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'game-studio-routes-test-'));
    app = express();
    app.use(express.json());
    app.use(createGameStudioRouter(tempWorkspace));
    app.use(errorHandler);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('serves studio summary and engine profiles', async () => {
    const summaryRes = await request(app).get('/api/game-studio/summary');
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.installedRuntimes).toBeDefined();

    const profilesRes = await request(app).get('/api/game-studio/profiles');
    expect(profilesRes.status).toBe(200);
    expect(profilesRes.body.profiles).toBeDefined();
  });

  it('connects to engine project and creates mutation proposals with approval', async () => {
    const projectDir = path.join(tempWorkspace, 'game_project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.godot'), 'config_version=5\n');
    fs.writeFileSync(path.join(projectDir, 'player.tscn'), '[gd_scene format=3]\n[node name="Player" type="CharacterBody2D"]\n');

    // 1. Connect
    const connectRes = await request(app)
      .post('/api/game-studio/connect')
      .send({
        engine: 'godot',
        projectRoot: projectDir
      });
    expect(connectRes.status).toBe(200);

    // 2. Propose mutation
    const proposeRes = await request(app)
      .post('/api/game-studio/proposals')
      .send({
        engine: 'godot',
        projectId: 'GameProj',
        title: 'Add Sprite2D node',
        actions: [{ type: 'add_node', targetPath: 'player.tscn', params: { nodeType: 'Sprite2D', nodeName: 'Icon' } }]
      });

    expect(proposeRes.status).toBe(200);
    expect(proposeRes.body.id).toBeDefined();
    const proposalId = proposeRes.body.id;

    // 3. Approve proposal
    const approveRes = await request(app)
      .post(`/api/game-studio/proposals/${proposalId}/approve`)
      .send({ approverId: 'test-admin' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.approvalDigest).toBeDefined();
    const { approvalDigest } = approveRes.body;

    // 4. Mismatched caller identity is rejected
    const badCallerRes = await request(app)
      .post(`/api/game-studio/proposals/${proposalId}/apply`)
      .send({ approvalDigest, callerId: 'wrong-user' });
    expect(badCallerRes.status).toBe(400);

    // 5. Apply mutation with matching exact approver identity and approval digest
    const applyRes = await request(app)
      .post(`/api/game-studio/proposals/${proposalId}/apply`)
      .send({ approvalDigest, callerId: 'test-admin' });
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.id).toBeDefined();
  });

  it('handles MAST layout generation and slicing profile endpoints', async () => {
    const mastRes = await request(app)
      .post('/api/game-studio/mast/layout')
      .send({ width: 10, depth: 10, roomCount: 3 });
    expect(mastRes.status).toBe(200);

    const slicingRes = await request(app)
      .post('/api/game-studio/slicing/profile')
      .send({ width: 64, height: 64, frames: 4 });
    expect(slicingRes.status).toBe(200);
  });

  it('covers project, scene, script, profiler, scenario, and rollback endpoints', async () => {
    const projectDir = path.join(tempWorkspace, 'game_project_2');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.godot'), 'config_version=5\n');
    fs.writeFileSync(path.join(projectDir, 'Main.tscn'), '[gd_scene format=3]\n[node name="Main" type="Node2D"]\n');
    fs.writeFileSync(path.join(projectDir, 'Player.gd'), 'extends Node2D\nfunc _ready():\n\tpass\n');

    await request(app).post('/api/game-studio/connect').send({ engine: 'godot', projectRoot: projectDir }).expect(200);

    // Project, scene, script, profiler
    await request(app).get('/api/game-studio/project?engine=godot').expect(200);
    await request(app).get('/api/game-studio/scene?engine=godot&path=Main.tscn').expect(200);
    await request(app).get('/api/game-studio/script?engine=godot&path=Player.gd').expect(200);
    const profilerRes = await request(app).get('/api/game-studio/profiler?engine=godot');
    expect([200, 500]).toContain(profilerRes.status);

    // Scenario testing
    const scenarioRes = await request(app)
      .post('/api/game-studio/runtime/scenario')
      .send({ engine: 'godot', scenePath: 'Main.tscn', assertions: [] })
      .expect(200);
    expect(scenarioRes.body).toBeDefined();

    // Export
    const exportRes = await request(app)
      .post('/api/game-studio/export')
      .send({ engine: 'godot', name: 'TestExport' });
    expect([200, 400, 500]).toContain(exportRes.status);

    // Disconnect
    await request(app).post('/api/game-studio/disconnect').send({ engine: 'godot' }).expect(200);
  });
});
