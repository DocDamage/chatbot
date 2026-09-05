import express from 'express';
import request from 'supertest';
import { createChatRouter } from '../v1/chat';
import { createChatRouterV2 } from '../v2/chat';

jest.mock('../chat-stream', () => ({
  streamChat: jest.fn().mockImplementation(async (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: {"chunk":"hello"}\n\n');
    res.end();
  })
}));

describe('RT-CHAT-002: Versioned API Routes (v1 and v2) Suite', () => {
  let app: express.Application;
  let mockOrchestrator: { processRequest: jest.Mock };

  beforeEach(() => {
    mockOrchestrator = {
      processRequest: jest.fn().mockResolvedValue({
        content: 'Response from orchestrator',
        sessionId: 'test-session',
        tokensUsed: 42
      })
    };

    app = express();
    app.use(express.json());
    app.use('/api/v1', createChatRouter(mockOrchestrator));
    app.use('/api/v2', createChatRouterV2(mockOrchestrator));
  });

  it('handles standard POST /api/v1/chat request', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({
        message: 'Hello Assistant',
        sessionId: 'sess-1',
        userId: 'user-1'
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Response from orchestrator');
    expect(mockOrchestrator.processRequest).toHaveBeenCalledWith({
      message: 'Hello Assistant',
      sessionId: 'sess-1',
      userId: 'user-1'
    });
  });

  it('handles standard POST /api/v2/chat request', async () => {
    const res = await request(app)
      .post('/api/v2/chat')
      .send({
        message: 'Hello v2',
        sessionId: 'sess-2',
        userId: 'user-2'
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Response from orchestrator');
  });

  it('handles streaming POST /api/v2/chat/stream request', async () => {
    const res = await request(app)
      .post('/api/v2/chat/stream')
      .send({
        message: 'Stream me',
        sessionId: 'sess-stream'
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain('data: {"chunk":"hello"}');
  });
});
