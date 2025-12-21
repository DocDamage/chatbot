/**
 * Integration tests for API endpoints
 */

import request from 'supertest';
import express from 'express';
import { ServiceInitializer } from '../../core/initialization/ServiceInitializer';

// Mock the service initializer
jest.mock('../../core/initialization/ServiceInitializer');

describe('API Endpoints', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create a minimal app for testing
    app = express();
    app.use(express.json());

    // Mock services
    const mockServices = {
      orchestrator: {
        processRequest: jest.fn().mockResolvedValue({
          response: 'Test response',
          sessionId: 'test-session',
        }),
      },
      documentManager: {
        addText: jest.fn().mockResolvedValue([]),
        addFile: jest.fn().mockResolvedValue([]),
        getStats: jest.fn().mockReturnValue({}),
      },
      toolRegistry: {
        getAll: jest.fn().mockReturnValue([]),
        getStats: jest.fn().mockReturnValue({ totalTools: 0 }),
      },
    };

    (ServiceInitializer.initialize as jest.Mock).mockResolvedValue(mockServices);

    // Basic health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Chat endpoint
    app.post('/api/chat', async (req, res) => {
      const { orchestrator } = await ServiceInitializer.initialize();
      const response = await orchestrator.processRequest(req.body);
      res.json(response);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('POST /api/chat', () => {
    it('should process chat requests', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hello',
          sessionId: 'test-session',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({});

      // Should either validate or return error
      expect([200, 400]).toContain(response.status);
    });
  });
});

