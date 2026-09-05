import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createSpriteStudioRouter } from '../sprite-studio/spriteStudioRoutes';

describe('RT-PLAT-005 / RT-SPRITE-001: Sprite Studio Routes Suite', () => {
  let app: express.Application;
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-studio-routes-test-'));
    app = express();
    app.use(express.json());
    app.use(createSpriteStudioRouter(tempWorkspace));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('serves presets and built-in palettes and creates new presets', async () => {
    const presetsRes = await request(app).get('/api/sprite-studio/presets');
    expect(presetsRes.status).toBe(200);
    expect(Array.isArray(presetsRes.body.presets)).toBe(true);

    const badPresetRes = await request(app).post('/api/sprite-studio/presets').send({});
    expect(badPresetRes.status).toBe(400);

    const createPresetRes = await request(app)
      .post('/api/sprite-studio/presets')
      .send({ id: 'custom-test-preset', name: 'Custom Test Preset' });
    expect(createPresetRes.status).toBe(200);
    expect(createPresetRes.body.preset.id).toBe('custom-test-preset');

    const palettesRes = await request(app).get('/api/sprite-studio/palettes');
    expect(palettesRes.status).toBe(200);
    expect(Array.isArray(palettesRes.body.palettes)).toBe(true);
  });

  it('validates pixels object correctly', async () => {
    const badDimension = await request(app)
      .post('/api/sprite-studio/pipeline/process')
      .send({ pixels: { width: -1, height: 2, data: [] } });
    expect(badDimension.status).toBe(400);

    const badDataLen = await request(app)
      .post('/api/sprite-studio/pipeline/process')
      .send({ pixels: { width: 2, height: 2, data: [1, 2, 3] } });
    expect(badDataLen.status).toBe(400);

    const missingPixels = await request(app)
      .post('/api/sprite-studio/grid/detect')
      .send({});
    expect(missingPixels.status).toBe(400);

    const missingBgPixels = await request(app)
      .post('/api/sprite-studio/background/remove')
      .send({});
    expect(missingBgPixels.status).toBe(400);
  });

  it('processes image pipeline and grid detection', async () => {
    // 2x2 RGBA test image (16 numbers)
    const testPixels = {
      width: 2,
      height: 2,
      data: [
        255, 0, 0, 255,   0, 255, 0, 255,
        0, 0, 255, 255,   255, 255, 255, 255
      ]
    };

    // 1. Pipeline process
    const pipelineRes = await request(app)
      .post('/api/sprite-studio/pipeline/process')
      .send({ pixels: testPixels });

    expect(pipelineRes.status).toBe(200);
    expect(pipelineRes.body.success).toBe(true);

    // 2. Grid detect
    const gridRes = await request(app)
      .post('/api/sprite-studio/grid/detect')
      .send({ pixels: testPixels, mode: 'auto' });

    expect(gridRes.status).toBe(200);

    // 3. Background remove
    const bgRes = await request(app)
      .post('/api/sprite-studio/background/remove')
      .send({ pixels: testPixels });

    expect(bgRes.status).toBe(200);
  });

  it('handles batch sessions lifecycle', async () => {
    const badBatch = await request(app).post('/api/sprite-studio/batch/create').send({});
    expect(badBatch.status).toBe(400);

    const testFile = path.join(tempWorkspace, 'test_sprite.png');
    fs.writeFileSync(testFile, 'dummy');

    const createRes = await request(app)
      .post('/api/sprite-studio/batch/create')
      .send({ inputPaths: ['test_sprite.png'] });

    expect(createRes.status).toBe(200);
    const sessionId = createRes.body.id;

    const getRes = await request(app).get(`/api/sprite-studio/batch/${sessionId}`);
    expect(getRes.status).toBe(200);

    const notFoundRes = await request(app).get('/api/sprite-studio/batch/non-existent-session-id');
    expect(notFoundRes.status).toBe(404);

    const cancelRes = await request(app).post(`/api/sprite-studio/batch/${sessionId}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
  });

  it('validates and executes engine handoff with exact-scope approval', async () => {
    const missingFields = await request(app)
      .post('/api/sprite-studio/engine-handoff')
      .send({});
    expect(missingFields.status).toBe(400);

    const testPixels = {
      width: 2,
      height: 2,
      data: [
        255, 0, 0, 255,   0, 255, 0, 255,
        0, 0, 255, 255,   255, 255, 255, 255
      ]
    };

    // Step 1: Request handoff without approval -> receives requiredApprovalDigest
    const handoffRes = await request(app)
      .post('/api/sprite-studio/engine-handoff')
      .send({
        spriteName: 'hero_idle',
        pixels: testPixels,
        options: {
          engine: 'godot',
          targetProjectRoot: tempWorkspace,
          approvedByUser: false
        }
      });
    expect(handoffRes.status).toBe(200);
    expect(handoffRes.body.success).toBe(false);
    expect(handoffRes.body.error).toContain('EXACT_SCOPE_APPROVAL_REQUIRED');
    const digest = handoffRes.body.requiredApprovalDigest;
    expect(digest).toBeDefined();

    // Step 2: Re-request handoff with user approval and matching digest
    const approvedRes = await request(app)
      .post('/api/sprite-studio/engine-handoff')
      .send({
        spriteName: 'hero_idle',
        pixels: testPixels,
        options: {
          engine: 'godot',
          targetProjectRoot: tempWorkspace,
          approvedByUser: true,
          approvalDigest: digest
        }
      });
    expect(approvedRes.status).toBe(200);
    expect(approvedRes.body.success).toBe(true);
    expect(approvedRes.body.targetFiles.length).toBeGreaterThan(0);
  });
});
