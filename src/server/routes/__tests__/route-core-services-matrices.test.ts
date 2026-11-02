import express from 'express';
import request from 'supertest';
import { createGamingRouter } from '../gaming';
import { registerSettingsRoutes } from '../settings';
import setupRouter from '../setup';
import { createMusicProductionGeniusRouter } from '../music';
import { AuthService } from '../../../core/auth/AuthService';

import { apiKeyManager } from '../../../core/config/APIKeyManager';

describe('HTTP route decision matrices - Core & Support Services', () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-routes-123456';
    process.env.API_KEY_ENCRYPTION_SECRET = '01234567890123456789012345678901';
    (apiKeyManager as any).encryptionSecret = '01234567890123456789012345678901';
    const authService = new AuthService();
    authToken = `Bearer ${authService.generateToken({ id: 'user-admin', email: 'admin@example.com', roles: ['admin'] })}`;
  });

  describe('Gaming Router', () => {
    it('handles ask, playbooks listing, and playbook generation variations', async () => {
      const mockAgent = {
        ask: jest.fn().mockResolvedValue({ answer: 'Gaming advice' })
      };

      const app = express();
      app.use(express.json());
      app.use(createGamingRouter({ gamingGeniusAgent: mockAgent }));

      // Ask endpoint
      await request(app).post('/api/gaming/ask').send({ query: 'optimal loadout' }).expect(200);
      expect(mockAgent.ask).toHaveBeenCalledWith('optimal loadout');

      // Uninitialized agent
      const uninitApp = express();
      uninitApp.use(express.json());
      uninitApp.use(createGamingRouter({}));
      await request(uninitApp).post('/api/gaming/ask').send({ query: 'test' }).expect(503);

      // Playbooks list
      const listRes = await request(app).get('/api/gaming/playbooks').expect(200);
      expect(listRes.body.playbooks.length).toBeGreaterThan(0);

      // Playbook creation validation
      await request(app).post('/api/gaming/playbook').send({ goal: '', kind: 'design_review' }).expect(400);
      await request(app).post('/api/gaming/playbook').send({ goal: 'Make RPG', kind: 'invalid_kind' }).expect(400);

      // Playbook creation with all options
      const playRes = await request(app)
        .post('/api/gaming/playbook')
        .send({
          goal: 'Build an inventory system',
          kind: 'asset_pipeline',
          engine: 'Godot',
          genre: 'RPG',
          targetPlatform: 'PC',
          constraints: ['2D', 'Pixel Art']
        })
        .expect(200);
      expect(playRes.body).toHaveProperty('kind', 'asset_pipeline');

      // Engine endpoint
      await request(app).post('/api/gaming/engine').send({ goal: '' }).expect(400);
      const engRes = await request(app)
        .post('/api/gaming/engine')
        .send({ goal: 'Select 3D engine', genre: 'Action', targetPlatform: 'Mobile', constraints: ['Free'] })
        .expect(200);
      expect(engRes.body).toHaveProperty('kind', 'engine_selection');

      // Assets endpoint
      await request(app).post('/api/gaming/assets').send({ goal: '' }).expect(400);
      const assetRes = await request(app)
        .post('/api/gaming/assets')
        .send({ goal: 'Generate sprite sheets', engine: 'Unity', genre: 'Platformer', targetPlatform: 'Switch' })
        .expect(200);
      expect(assetRes.body).toHaveProperty('kind', 'asset_pipeline');

      // Prompts endpoint
      await request(app).post('/api/gaming/prompts').send({ goal: '' }).expect(400);
      const promptRes = await request(app)
        .post('/api/gaming/prompts')
        .send({ goal: 'Write dialogue for NPC', engine: 'Unreal' })
        .expect(200);
      expect(promptRes.body).toHaveProperty('kind', 'prompt_pack');
    });
  });

  describe('Settings Routes exhaustiveness', () => {
    it('covers all provider status masks and provider validations', async () => {
      const app = express();
      app.use(express.json());
      const reinit = jest.fn().mockResolvedValue(undefined);
      registerSettingsRoutes(app, {
        adminOnly: [],
        reinitializeServices: reinit,
        getOrchestrator: () => ({ ready: true })
      });

      // GET settings with short and long secrets
      process.env.OPENAI_API_KEY = 'short';
      process.env.ANTHROPIC_API_KEY = 'verylongsecretkey12345';
      const getRes = await request(app).get('/api/settings').expect(200);
      expect(getRes.body.secrets.OPENAI_API_KEY.preview).toBe('********');
      expect(getRes.body.secrets.ANTHROPIC_API_KEY.preview).toContain('...');

      // PUT settings with all providers
      await request(app).put('/api/settings').send({ provider: 'ollama' }).expect(200);
      await request(app).put('/api/settings').send({ provider: 'template' }).expect(200);
      await request(app).put('/api/settings').send({ provider: 'openai', OPENAI_API_KEY: 'sk-12345' }).expect(200);
      await request(app).put('/api/settings').send({ provider: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-12345' }).expect(200);
    });
  });

  describe('Setup Routes', () => {
    it('handles providers, free, setup wizard, key configuration, status, and guide', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/setup', setupRouter);

      // GET providers
      const provRes = await request(app)
        .get('/api/setup/providers')
        .set('Authorization', authToken)
        .expect(200);
      expect(provRes.body).toHaveProperty('providers');

      // GET free providers
      const freeRes = await request(app)
        .get('/api/setup/providers/free')
        .set('Authorization', authToken)
        .expect(200);
      expect(freeRes.body).toHaveProperty('providers');

      // GET provider wizard - valid & invalid
      await request(app)
        .get('/api/setup/provider/non-existent-provider')
        .set('Authorization', authToken)
        .expect(404);

      await request(app)
        .get('/api/setup/provider/groq')
        .set('Authorization', authToken)
        .expect(200);

      // POST key without key
      await request(app)
        .post('/api/setup/key/groq')
        .set('Authorization', authToken)
        .send({})
        .expect(400);

      // DELETE key
      await request(app)
        .delete('/api/setup/key/groq')
        .set('Authorization', authToken)
        .expect(200);

      // GET status
      await request(app)
        .get('/api/setup/status')
        .set('Authorization', authToken)
        .expect(200);

      // GET guide
      await request(app)
        .get('/api/setup/guide')
        .set('Authorization', authToken)
        .expect(200);

      // POST import without content
      await request(app)
        .post('/api/setup/import')
        .set('Authorization', authToken)
        .send({})
        .expect(400);

      // POST import with content
      await request(app)
        .post('/api/setup/import')
        .set('Authorization', authToken)
        .send({ envContent: 'GROQ_API_KEY=test-key\n' })
        .expect(200);
    });
  });

  describe('Music Production Genius Router', () => {
    it('handles all music production endpoints', async () => {
      const mockMusicAgent = {
        ask: jest.fn().mockResolvedValue({ response: 'Music response', guardrails: ['g1'] }),
        sunoPrompt: jest.fn().mockResolvedValue({ response: 'Suno response', guardrails: ['g1'] }),
        flStudioWorkflow: jest.fn().mockResolvedValue({ response: 'FL response', guardrails: ['g1'] }),
        proToolsWorkflow: jest.fn().mockResolvedValue({ response: 'PT response', guardrails: ['g1'] }),
        logicWorkflow: jest.fn().mockResolvedValue({ response: 'Logic response', guardrails: ['g1'] }),
        master: jest.fn().mockResolvedValue({ response: 'Master response', guardrails: ['g1'] }),
        arrangement: jest.fn().mockResolvedValue({ response: 'Arrangement response', guardrails: ['g1'] }),
        dawTranslate: jest.fn().mockResolvedValue({ response: 'Translate response', guardrails: ['g1'] }),
      };

      const app = express();
      app.use(express.json());
      app.use(createMusicProductionGeniusRouter({ musicProductionGeniusAgent: mockMusicAgent }));

      await request(app).post('/api/music/ask').send({ query: 'chords' }).expect(200);
      await request(app).post('/api/music/suno').send({ query: 'synthpop' }).expect(200);
      await request(app).post('/api/music/fl-studio').send({ query: 'mixer' }).expect(200);
      await request(app).post('/api/music/pro-tools').send({ query: 'audio track' }).expect(200);
      await request(app).post('/api/music/logic').send({ query: 'smart tempo' }).expect(200);
      await request(app).post('/api/music/master').send({ query: 'limiter' }).expect(200);
      await request(app).post('/api/music/arrangement').send({ query: 'intro verse chorus' }).expect(200);
      await request(app).post('/api/music/daw-translate').send({ query: 'fl to ableton' }).expect(200);

      expect(mockMusicAgent.ask).toHaveBeenCalledWith('chords');
      expect(mockMusicAgent.sunoPrompt).toHaveBeenCalledWith('synthpop');
      expect(mockMusicAgent.flStudioWorkflow).toHaveBeenCalledWith('mixer');
      expect(mockMusicAgent.proToolsWorkflow).toHaveBeenCalledWith('audio track');
      expect(mockMusicAgent.logicWorkflow).toHaveBeenCalledWith('smart tempo');
      expect(mockMusicAgent.master).toHaveBeenCalledWith('limiter');
      expect(mockMusicAgent.arrangement).toHaveBeenCalledWith('intro verse chorus');
      expect(mockMusicAgent.dawTranslate).toHaveBeenCalledWith('fl to ableton');
    });
  });
});
