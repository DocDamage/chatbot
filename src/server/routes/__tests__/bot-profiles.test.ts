/**
 * Integration Tests for Bot Profiles Routes (CRK-P02-T05)
 *
 * Verifies profile listing, retrieval, creation, version rollback, and context resolution.
 */

import express from 'express';
import request from 'supertest';
import { createBotProfileRouter } from '../bot-profiles';
import { BotProfileRepository } from '../../../core/profiles/BotProfileRepository';
import { DEFAULT_BOT_PROFILE } from '../../../core/profiles/DefaultBotProfile';

describe('Bot Profiles API Routes (CRK-P02-T05)', () => {
  let app: express.Application;
  let repo: BotProfileRepository;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    repo = new BotProfileRepository();
    await repo.saveProfile(DEFAULT_BOT_PROFILE, 'test-seed');
    app.use('/api/bot-profiles', createBotProfileRouter(repo));
  });

  it('GET /api/bot-profiles lists active bot profiles', async () => {
    const res = await request(app).get('/api/bot-profiles');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((p: any) => p.id === 'default')).toBe(true);
  });

  it('GET /api/bot-profiles/:id returns profile details or 404 for missing', async () => {
    const res = await request(app).get('/api/bot-profiles/default');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('default');

    const notFound = await request(app).get('/api/bot-profiles/missing-profile');
    expect(notFound.status).toBe(404);
  });

  it('POST /api/bot-profiles creates a new profile and tracks audit history', async () => {
    const newProfile = {
      id: 'math-assistant',
      name: 'Mathematics Genius',
      responseStyle: 'detailed',
    };

    const res = await request(app)
      .post('/api/bot-profiles')
      .send({ profile: newProfile, author: 'tester' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('math-assistant');
    expect(res.body.data.version).toBe(1);

    const versionsRes = await request(app).get('/api/bot-profiles/math-assistant/versions');
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.data).toHaveLength(1);
    expect(versionsRes.body.data[0].author).toBe('tester');
  });

  it('POST /api/bot-profiles/:id/rollback reverts profile to specified version', async () => {
    await repo.saveProfile({ id: 'test-bot', name: 'Name V1', responseStyle: 'adaptive' }, 'v1-author');
    await repo.saveProfile({ id: 'test-bot', name: 'Name V2', responseStyle: 'concise' }, 'v2-author');

    const rollbackRes = await request(app)
      .post('/api/bot-profiles/test-bot/rollback')
      .send({ version: 1, author: 'admin-tester' });

    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.data.version).toBe(3);
    expect(rollbackRes.body.data.responseStyle).toBe('adaptive');
  });

  it('POST /api/bot-profiles/resolve returns resolved profile based on context', async () => {
    const res = await request(app)
      .post('/api/bot-profiles/resolve')
      .send({ requestProfileId: 'default' });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('default');
  });
});
