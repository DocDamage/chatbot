import express from 'express';
import request from 'supertest';
import axios from 'axios';
import { registerHealthRoutes } from './healthRoutes';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createApp(overrides: Partial<{
  startupState: 'initializing' | 'ready' | 'failed';
  startupError: string | undefined;
  orchestrator: any;
  services: any;
}> = {}) {
  const app = express();
  registerHealthRoutes(app, {
    getStartupState: () => overrides.startupState || 'ready',
    getStartupError: () => overrides.startupError,
    getOrchestrator: () => overrides.orchestrator ?? {},
    getServices: () => overrides.services || {
      ragService: {},
      toolRegistry: {},
      visionAdapter: {},
      initialization: {
        optional: {
          rag: { status: 'ready' }
        }
      }
    },
  });
  return app;
}

describe('health readiness routes', () => {
  const originalUseOllama = process.env.USE_OLLAMA;

  afterEach(() => {
    jest.resetAllMocks();
    if (originalUseOllama === undefined) {
      delete process.env.USE_OLLAMA;
    } else {
      process.env.USE_OLLAMA = originalUseOllama;
    }
  });

  it('returns ready with subsystem details when startup completed', async () => {
    const response = await request(createApp()).get('/health/ready').expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      services: {
        orchestrator: true,
        rag: true,
        tools: true,
        vision: true,
      },
    });
    expect(response.body.services.optional.rag.status).toBe('ready');
  });

  it('returns not ready while startup is still initializing', async () => {
    const response = await request(createApp({ startupState: 'initializing', orchestrator: undefined }))
      .get('/health/ready')
      .expect(503);

    expect(response.body).toEqual({ status: 'not ready' });
  });

  it('returns failed readiness with the startup error when initialization fails', async () => {
    const response = await request(createApp({ startupState: 'failed', startupError: 'boot failed' }))
      .get('/health/ready')
      .expect(503);

    expect(response.body).toEqual({ status: 'failed', error: 'boot failed' });
  });

  it('marks general health degraded when an external dependency check fails after readiness', async () => {
    process.env.USE_OLLAMA = 'true';
    mockedAxios.get.mockRejectedValue(new Error('ollama down'));

    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.ollama).toBe('unhealthy');
    expect(response.body.startup.state).toBe('ready');
  });
});
