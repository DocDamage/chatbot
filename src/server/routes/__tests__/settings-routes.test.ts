import express from 'express';
import request from 'supertest';
import { registerSettingsRoutes } from '../settings';

describe('settings routes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  function createApp(reinitializeServices = jest.fn().mockResolvedValue(undefined)) {
    const app = express();
    app.use(express.json());
    registerSettingsRoutes(app, {
      adminOnly: [],
      reinitializeServices,
      getOrchestrator: () => ({ ready: true })
    });
    return { app, reinitializeServices };
  }

  it('returns public settings, masked secret status, and provider state', async () => {
    process.env.LLM_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = '123456789012';
    const response = await request(createApp().app).get('/api/settings').expect(200);
    expect(response.body.settings.LLM_PROVIDER).toBe('gemini');
    expect(response.body.secrets.GEMINI_API_KEY).toEqual({ configured: true, preview: '1234...9012' });
    expect(response.body.status.activeProvider).toBe('gemini');
    expect(response.body.status.model).toBe('ready');
  });

  it('validates every provider requirement and applies valid runtime settings', async () => {
    const app = createApp().app;
    await request(app).put('/api/settings').send({ provider: 'openai' }).expect(400);
    await request(app).put('/api/settings').send({ provider: 'openai-compatible', OPENAI_COMPATIBLE_API_KEY: 'key' }).expect(400);
    await request(app).put('/api/settings').send({ provider: 'openai-compatible', OPENAI_COMPATIBLE_API_KEY: 'key', OPENAI_COMPATIBLE_BASE_URL: 'http://localhost' }).expect(200);
    await request(app).put('/api/settings').send({ provider: 'anthropic' }).expect(400);
    await request(app).put('/api/settings').send({ provider: 'gemini' }).expect(400);
    await request(app).put('/api/settings').send({ provider: 'huggingface' }).expect(400);

    const deps = createApp();
    const response = await request(deps.app).put('/api/settings').send({
      provider: 'gemini',
      GEMINI_API_KEY: 'gemini-secret',
      GEMINI_MODEL: 'gemini-test',
      EMBEDDING_PROVIDER: 'xenova'
    }).expect(200);
    expect(response.body.success).toBe(true);
    expect(process.env.GEMINI_API_KEY).toBe('gemini-secret');
    expect(process.env.USE_OLLAMA).toBe('false');
    expect(process.env.LLM_PROVIDER).toBe('gemini');
    expect(deps.reinitializeServices).toHaveBeenCalled();
  });
});
