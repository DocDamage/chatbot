import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthService } from '../../core/auth/AuthService';

describe('Server Entrypoint Startup Failure & Missing Services Matrix', () => {
  const secret = 'super-secret-key-32-chars-long-for-testing-failures';
  let environmentRoot: string;
  let originalEnvironment: Map<string, string | undefined>;
  let devToken: string;

  beforeAll(() => {
    environmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'server-entrypoint-failures-'));
    const emptyDotenv = path.join(environmentRoot, '.env');
    fs.writeFileSync(emptyDotenv, '');
    const isolatedEnvironment: Record<string, string | undefined> = {
      DOTENV_CONFIG_PATH: emptyDotenv,
      NODE_ENV: 'test',
      DEPLOYMENT_MODE: 'test',
      JWT_SECRET: secret,
      CSRF_TOKEN: 'expected-csrf-12345',
      ENABLE_WEBSOCKET: 'false',
      REQUEST_READY_TIMEOUT_MS: '50',
      LLM_PROVIDER: 'template',
      RAG_PERSISTENCE: 'false',
      RAG_RETRIEVAL_MODE: 'memory',
      RAG_GENERATE_EMBEDDINGS: 'false',
      EAGER_KNOWLEDGE_LOAD: 'false',
      BACKGROUND_KNOWLEDGE_LOAD: 'false',
      EAGER_CODING_KNOWLEDGE_LOAD: 'false',
      BACKGROUND_CODING_KNOWLEDGE_LOAD: 'false',
      CODING_TOOLS_ENABLED: 'false',
      REA_ENABLED: 'false',
      ENABLE_RAG: 'false',
      ENABLE_MODEL_ROUTING: 'false',
      ENABLE_SAFETY_PIPELINE: 'false',
      ENABLE_SEMANTIC_CACHE: 'false',
      ENABLE_ENSEMBLE: 'false',
      ENABLE_BASH_EXECUTOR: 'false',
      ENABLE_LOCAL_TOOLS: 'false',
      LOCAL_EXECUTION_ENABLED: 'false',
      ENABLE_REDIS_CACHE: 'false',
      ENABLE_DISK_CACHE: 'false',
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      HUGGINGFACE_API_KEY: undefined,
      OPENAI_COMPATIBLE_API_KEY: undefined,
      OPENAI_COMPATIBLE_BASE_URL: undefined,
      DATABASE_URL: undefined,
      RAG_DATABASE_URL: undefined,
      RAG_SQLITE_PATH: undefined,
      REDIS_URL: undefined,
      OLLAMA_URL: undefined,
      OLLAMA_MODEL: undefined,
      CODING_OLLAMA_MODEL: undefined,
    };
    originalEnvironment = new Map();
    for (const [name, value] of Object.entries(isolatedEnvironment)) {
      originalEnvironment.set(name, process.env[name]);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }

    const auth = new AuthService(secret);
    devToken = auth.generateToken({ id: 'dev-1', email: 'dev@test.com', roles: ['developer', 'admin'] });
  });

  afterAll(() => {
    for (const [name, value] of originalEnvironment) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(environmentRoot, { recursive: true, force: true });
  });

  describe('startup failures', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.restoreAllMocks();
      jest.unmock('../../core/config/ConfigValidator');
      jest.unmock('../../core/initialization/ServiceInitializer');
    });

    it('handles ConfigValidator failure on startup', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      jest.doMock('../../core/config/ConfigValidator', () => ({
        ConfigValidator: {
          getValidatedConfig: jest.fn().mockImplementation(() => {
            throw new Error('Invalid config schema');
          }),
        },
      }));

      expect(() => jest.isolateModules(() => {
        require('../index');
      })).toThrow('Invalid config schema');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it('handles ServiceInitializer rejection on startup', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      jest.doMock('../../core/initialization/ServiceInitializer', () => ({
        ServiceInitializer: {
          initialize: jest.fn().mockRejectedValue(new Error('DB connection failed')),
        },
      }));

      let isolatedIndex: any;
      jest.isolateModules(() => {
        isolatedIndex = require('../index');
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(exitSpy).toHaveBeenCalledWith(1);
      await expect(isolatedIndex.waitForReady(100)).rejects.toThrow('DB connection failed');
      exitSpy.mockRestore();
    });
  });

  describe('missing service endpoints', () => {
    let isolatedApp: any;
    let isolatedModule: any;

    // Cold instrumented imports can take minutes under release I/O contention; keep endpoint assertions at Jest's default timeout.
    beforeAll(async () => {
      jest.resetModules();
      jest.restoreAllMocks();
      jest.unmock('../../core/config/ConfigValidator');
      jest.doMock('../../core/initialization/ServiceInitializer', () => ({
        ServiceInitializer: {
          initialize: jest.fn().mockResolvedValue({
            orchestrator: {
              processRequest: jest.fn().mockResolvedValue({ response: 'ok' }),
            },
          }),
        },
      }));
      jest.isolateModules(() => {
        isolatedModule = require('../index');
        isolatedApp = isolatedModule.app;
      });
      await isolatedModule.waitForReady(5000);
    }, 300000);

    afterAll(() => {
      jest.resetModules();
      jest.unmock('../../core/initialization/ServiceInitializer');
    });

    it('handles missing services gracefully across all service-backed endpoints', async () => {
      // The initializer supplies only an orchestrator, so each service-specific route must fail closed.

      // 1. Knowledge Base endpoints without documentManager
      const addRes = await request(isolatedApp)
        .post('/api/knowledge-base/add')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ text: 'text' });
      expect(addRes.status).toBe(503);

      const fileRes = await request(isolatedApp)
        .post('/api/knowledge-base/file')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ filePath: 'file.md' });
      expect(fileRes.status).toBe(503);

      const dirRes = await request(isolatedApp)
        .post('/api/knowledge-base/directory')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ directoryPath: 'docs' });
      expect(dirRes.status).toBe(503);

      // 2. Tools endpoint without toolRegistry
      const toolsRes = await request(isolatedApp)
        .get('/api/tools')
        .set('Authorization', `Bearer ${devToken}`);
      expect(toolsRes.status).toBe(503);

      // 3. Upload endpoint without documentManager
      const uploadRes = await request(isolatedApp)
        .post('/api/upload')
        .set('Authorization', `Bearer ${devToken}`)
        .attach('file', Buffer.from('content'), 'test.txt');
      expect(uploadRes.status).toBe(503);

      // 4. Telegram, CSV, JSON loaders without documentManager
      const telRes = await request(isolatedApp)
        .post('/api/knowledge/load-telegram')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ filePath: 'telegram.json' });
      expect(telRes.status).toBe(503);

      const csvRes = await request(isolatedApp)
        .post('/api/knowledge/load-csv')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ filePath: 'data.csv' });
      expect(csvRes.status).toBe(503);

      const jsonRes = await request(isolatedApp)
        .post('/api/knowledge/load-json')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ filePath: 'data.json' });
      expect(jsonRes.status).toBe(503);
    });
  });
});
