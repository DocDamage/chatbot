import request from 'supertest';
import { AuthService } from '../../core/auth/AuthService';

describe('Server Entrypoint Startup Failure & Missing Services Matrix', () => {
  const secret = 'super-secret-key-32-chars-long-for-testing-failures';
  let devToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    process.env.CSRF_TOKEN = 'expected-csrf-12345';
    process.env.ENABLE_WEBSOCKET = 'false';
    process.env.REQUEST_READY_TIMEOUT_MS = '50';

    const auth = new AuthService(secret);
    devToken = auth.generateToken({ id: 'dev-1', email: 'dev@test.com', roles: ['developer', 'admin'] });
  });

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

    jest.isolateModules(() => {
      require('../index');
    });

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

  it('handles missing services gracefully across all service-backed endpoints', async () => {
    // Provide an orchestrator so requireReady() passes immediately, but omit documentManager, toolRegistry, etc.
    jest.doMock('../../core/initialization/ServiceInitializer', () => ({
      ServiceInitializer: {
        initialize: jest.fn().mockResolvedValue({
          orchestrator: {
            processRequest: jest.fn().mockResolvedValue({ response: 'ok' }),
          },
        }),
      },
    }));

    let isolatedApp: any;
    let isolatedModule: any;
    jest.isolateModules(() => {
      isolatedModule = require('../index');
      isolatedApp = isolatedModule.app;
    });

    await isolatedModule.waitForReady(5000);

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
