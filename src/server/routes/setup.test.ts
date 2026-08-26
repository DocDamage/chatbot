import express from 'express';
import request from 'supertest';
import setupRouter from './setup';
import { AuthService } from '../../core/auth/AuthService';
import { errorHandler } from '../../middleware/errorHandler';
import { apiKeyManager } from '../../core/config/APIKeyManager';

jest.mock('../../core/config/APIKeyManager', () => {
  const original = jest.requireActual('../../core/config/APIKeyManager');
  return {
    ...original,
    apiKeyManager: {
      getAllProviders: jest.fn().mockReturnValue([
        { id: 'openai', name: 'OpenAI', freeModels: [], instructions: ['1. Sign up'] },
        { id: 'gemini', name: 'Google Gemini', freeModels: ['gemini-1.5-flash'], instructions: ['1. Get key'] }
      ]),
      getFreeProviders: jest.fn().mockReturnValue([
        { id: 'gemini', name: 'Google Gemini', freeModels: ['gemini-1.5-flash'], logoEmoji: '✨', freeTier: 'Free 60 RPM', signupUrl: 'https://example.com' }
      ]),
      getConfiguredProviders: jest.fn().mockReturnValue(['openai']),
      getProviderInfo: jest.fn().mockReturnValue({ id: 'openai', name: 'OpenAI', logoEmoji: '🤖' }),
      getStats: jest.fn().mockReturnValue({ total: 2, configured: 1, free: 1 }),
      getSetupWizard: jest.fn().mockImplementation((id: string) => {
        if (id === 'missing') return null;
        return {
          provider: {
            id,
            name: id,
            logoEmoji: '🤖',
            freeTier: 'Free 60 RPM',
            freeModels: ['model-1'],
            instructions: ['1. Step 1'],
            signupUrl: 'https://example.com/signup',
            apiKeyUrl: 'https://example.com/keys',
            docsUrl: 'https://example.com/docs'
          }
        };
      }),
      validateKey: jest.fn().mockImplementation((provider: string, key: string) => {
        if (key === 'invalid-key') return Promise.resolve({ valid: false, error: 'Bad key format' });
        return Promise.resolve({ valid: true, models: ['model-a'] });
      }),
      setKey: jest.fn().mockResolvedValue(undefined),
      removeKey: jest.fn().mockResolvedValue(true),
      generateSetupGuide: jest.fn().mockReturnValue('# Setup Guide\nFollow these steps.'),
      importFromEnv: jest.fn().mockResolvedValue({ imported: 2, errors: [] })
    }
  };
});

describe('setup routes', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalCsrfToken = process.env.CSRF_TOKEN;
  let adminToken: string;
  let developerToken: string;
  let app: express.Express;

  beforeEach(() => {
    process.env.JWT_SECRET = 'setup-route-test-secret-at-least-32-chars';
    process.env.CSRF_TOKEN = 'setup-route-csrf-token';
    const auth = new AuthService();
    adminToken = auth.generateToken({ id: 'admin-user', roles: ['admin'] });
    developerToken = auth.generateToken({ id: 'developer-user', roles: ['developer'] });

    app = express();
    app.use(express.json());
    app.use('/api/setup', setupRouter);
    app.use(errorHandler);
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }

    if (originalCsrfToken === undefined) {
      delete process.env.CSRF_TOKEN;
    } else {
      process.env.CSRF_TOKEN = originalCsrfToken;
    }
  });

  it('requires admin authentication for setup provider metadata', async () => {
    await request(app).get('/api/setup/providers').expect(401);
    await request(app)
      .get('/api/setup/providers')
      .set('Authorization', `Bearer ${developerToken}`)
      .expect(403);

    const response = await request(app)
      .get('/api/setup/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.providers[0]).not.toHaveProperty('key');
  });

  it('lists free tier providers and setup wizard HTML', async () => {
    const freeRes = await request(app)
      .get('/api/setup/providers/free')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(freeRes.body.success).toBe(true);
    expect(freeRes.body.providers.length).toBe(1);

    const wizardRes = await request(app)
      .get('/api/setup/provider/gemini')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(wizardRes.body.success).toBe(true);
    expect(wizardRes.body.embedHtml).toContain('Setup gemini');

    const notFound = await request(app)
      .get('/api/setup/provider/missing')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(notFound.body.error).toBe('Provider not found');
  });

  it('saves, validates, and deletes provider API keys', async () => {
    // Missing key
    const missingRes = await request(app)
      .post('/api/setup/key/openai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
    expect(missingRes.body.error).toBe('API key is required');

    // Invalid key
    const invalidRes = await request(app)
      .post('/api/setup/key/openai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'invalid-key' })
      .expect(200);
    expect(invalidRes.body.success).toBe(false);

    // Valid key
    const validRes = await request(app)
      .post('/api/setup/key/openai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'valid-test-key', model: 'gpt-4' })
      .expect(200);
    expect(validRes.body.success).toBe(true);

    // Delete key
    const delRes = await request(app)
      .delete('/api/setup/key/openai')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(delRes.body.success).toBe(true);
  });

  it('returns setup status, guide, and embed HTML', async () => {
    const statusRes = await request(app)
      .get('/api/setup/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.ready).toBe(true);

    const guideRes = await request(app)
      .get('/api/setup/guide')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(guideRes.body.success).toBe(true);
    expect(guideRes.body.guide).toContain('Setup Guide');

    const embedRes = await request(app)
      .get('/api/setup/embed/gemini')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(embedRes.text).toContain('Setup gemini');

    const missingEmbed = await request(app)
      .get('/api/setup/embed/missing')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(missingEmbed.text).toBe('Provider not found');
  });

  it('imports API keys from environment content', async () => {
    const emptyImport = await request(app)
      .post('/api/setup/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(emptyImport.body.error).toBe('envContent is required');

    const validImport = await request(app)
      .post('/api/setup/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ envContent: 'OPENAI_API_KEY=sk-test\nGEMINI_API_KEY=AIzaSy' })
      .expect(200);

    expect(validImport.body.success).toBe(true);
    expect(validImport.body.imported.imported).toBe(2);
  });

  it('disables plaintext API key export even for admins', async () => {
    const response = await request(app)
      .get('/api/setup/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(410);

    expect(response.body).toEqual({
      success: false,
      error: 'Plaintext API key export is disabled'
    });
  });

  it('requires CSRF for browser-originated state changes', async () => {
    await request(app)
      .post('/api/setup/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', 'session=test')
      .send({ envContent: 'OPENAI_API_KEY=sk-test' })
      .expect(401);
  });
});
