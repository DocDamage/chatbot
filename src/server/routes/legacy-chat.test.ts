import express from 'express';
import request from 'supertest';
import { ConversationManager } from '../../core/conversation/ConversationManager';
import { createLegacyChatHandlers } from './legacy-chat';

describe('legacy chat knowledge miss contract', () => {
  it('returns a typed knowledge miss detail when local knowledge has no coverage', async () => {
    const app = express();
    const conversationManager = new ConversationManager();
    const orchestrator = {
      processRequest: jest.fn(),
    };

    app.use(express.json());
    app.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => ({}),
      getOrchestrator: () => orchestrator,
      waitForReady: jest.fn().mockResolvedValue(undefined),
      getConversationManager: () => conversationManager,
    }));

    await request(app)
      .post('/api/chat')
      .send({
        message: 'What changed in the newest Godot release?',
        sessionId: 'knowledge-miss-session',
        mode: 'ask',
      })
      .expect(200)
      .expect(response => {
        expect(response.body.knowledgeMiss).toBe(true);
        expect(response.body.knowledgeMissDetail).toEqual(expect.objectContaining({
          knowledgeMiss: true,
          type: 'knowledge_miss',
          domain: 'ask',
          proposedWebQuery: 'What changed in the newest Godot release?',
          suggestedNextAction: 'search_online',
        }));
      });

    expect(orchestrator.processRequest).not.toHaveBeenCalled();
  });
});
