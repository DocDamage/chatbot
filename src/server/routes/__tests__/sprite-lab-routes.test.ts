import express from 'express';
import request from 'supertest';
import { createSpriteLabRouter } from '../sprite-lab';
import { SpriteLabPlanService } from '../../../core/sprite-lab/SpriteLabPlanService';
import { InternalSpriteImageAdapter } from '../../../core/sprite-lab/InternalSpriteImageAdapter';
import { SpriteExternalToolAdapter } from '../../../core/sprite-lab/SpriteExternalToolAdapter';

describe('sprite lab routes', () => {
  beforeEach(() => {
    jest.spyOn(SpriteLabPlanService.prototype, 'getStatus').mockResolvedValue({ ready: true } as any);
    jest.spyOn(SpriteLabPlanService.prototype, 'planWorkflow').mockResolvedValue({ planned: true } as any);
    jest.spyOn(SpriteExternalToolAdapter.prototype, 'planRun').mockResolvedValue({ planned: true } as any);
    jest.spyOn(SpriteExternalToolAdapter.prototype, 'run').mockResolvedValue({ status: 'completed' } as any);
    jest.spyOn(InternalSpriteImageAdapter.prototype, 'sliceGrid').mockResolvedValue({ frames: 2 } as any);
    jest.spyOn(InternalSpriteImageAdapter.prototype, 'extractPalette').mockResolvedValue({ colors: [] } as any);
    jest.spyOn(InternalSpriteImageAdapter.prototype, 'createBasicManifest').mockResolvedValue({ frames: [] } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('covers status, validation, planning, guarded execution, and internal adapters', async () => {
    const app = express();
    app.use(express.json());
    app.use(createSpriteLabRouter({}, process.cwd()));

    await request(app).get('/api/sprite-lab/status').expect(200);
    await request(app).post('/api/sprite-lab/plan').send({}).expect(400);
    await request(app).post('/api/sprite-lab/plan').send({ workflow: 'slice', inputPath: 'input.png', outputTarget: 'out' }).expect(200);
    await request(app).post('/api/sprite-lab/external/plan').send({}).expect(400);
    await request(app).post('/api/sprite-lab/external/plan').send({ backend: 'aseprite', workflow: 'slice', inputPath: 'input.png', options: { dryRun: true } }).expect(200);
    await request(app).post('/api/sprite-lab/external/run').send({ backend: 'aseprite', workflow: 'slice', inputPath: 'input.png' }).expect(400);
    await request(app).post('/api/sprite-lab/external/run').send({ backend: 'aseprite', workflow: 'slice', inputPath: 'input.png', approvedByUser: true, cwd: process.cwd() }).expect(200);
    await request(app).post('/api/sprite-lab/internal/slice-grid').send({}).expect(400);
    await request(app).post('/api/sprite-lab/internal/slice-grid').send({ inputPath: 'input.png', outputDir: 'out', frameWidth: 16, frameHeight: 16 }).expect(200);
    await request(app).post('/api/sprite-lab/internal/palette').send({}).expect(400);
    await request(app).post('/api/sprite-lab/internal/palette').send({ inputPath: 'input.png', outputPath: 'palette.json', maxColors: 8 }).expect(200);
    await request(app).post('/api/sprite-lab/internal/manifest').send({}).expect(400);
    await request(app).post('/api/sprite-lab/internal/manifest').send({ inputPath: 'input.png', outputPath: 'manifest.json', animationName: 'idle' }).expect(200);
  });
});
