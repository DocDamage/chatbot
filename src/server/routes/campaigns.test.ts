import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../core/database/Database';
import { CampaignService } from '../../core/campaign/CampaignService';
import { CampaignRepository } from '../../core/campaign/CampaignRepository';
import { createCampaignRouter } from './campaigns';
import { AuthService } from '../../core/auth/AuthService';
import { errorHandler } from '../../middleware/errorHandler';

describe('authenticated campaign HTTP routes', () => {
  const originalSecret = process.env.JWT_SECRET;
  let directory: string, database: Database, app: express.Express;
  const token = (id: string) => new AuthService().generateToken({ id, roles: ['admin', 'developer'] });
  beforeEach(async () => {
    process.env.JWT_SECRET = 'campaign-http-test-secret-at-least-32-characters';
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-http-'));
    database = new Database({ type: 'sqlite', filePath: path.join(directory, 'state.db') }); await database.initialize();
    const service = new CampaignService(new CampaignRepository(database), { generate: async () => ({ content: '{"narration":"Welcome.","scene":"Inn","recap":"Arrived."}', model: 'test', tokensUsed: 0 }), getModelName: () => 'test' });
    app = express(); app.use(express.json()); app.use('/api/campaigns', createCampaignRouter({ campaignService: service })); app.use(errorHandler);
  });
  afterEach(async () => {
    await database.close();
    if (!path.resolve(directory).startsWith(path.join(path.resolve(os.tmpdir()), 'campaign-http-'))) throw new Error('Unsafe test cleanup');
    fs.rmSync(directory, { recursive: true, force: true });
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  });
  it('requires auth, validates IDs and isolates owners', async () => {
    await request(app).get('/api/campaigns').expect(401);
    const auth = `Bearer ${token('alice')}`;
    const created = await request(app).post('/api/campaigns').set('Authorization', auth).send({ name: 'Coast' }).expect(201);
    await request(app).get('/api/campaigns/not-an-id').set('Authorization', auth).expect(400);
    await request(app).get(`/api/campaigns/${created.body.id}?view=dm`).set('Authorization', `Bearer ${token('bob')}`).expect(404);
  });
  it('imports hidden records and exports secrets only on an explicit owner DM view', async () => {
    const auth = `Bearer ${token('alice')}`;
    const imported = await request(app).post('/api/campaigns/import').set('Authorization', auth).send({ format: 'dmt', data: { world_name: 'Coast', entities: { a: { name: 'Hidden patron', categorySlug: 'npcs', dmNotes: 'TOP_SECRET' } } } }).expect(201);
    expect(JSON.stringify(imported.body)).not.toContain('TOP_SECRET'); expect(imported.body.entities).toEqual([]);
    const publicExport = await request(app).get(`/api/campaigns/${imported.body.id}/export`).set('Authorization', auth).expect(200);
    expect(JSON.stringify(publicExport.body)).not.toContain('TOP_SECRET');
    const dmExport = await request(app).get(`/api/campaigns/${imported.body.id}/export?view=dm`).set('Authorization', auth).expect(200);
    expect(JSON.stringify(dmExport.body)).toContain('TOP_SECRET');
  });
});
