import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { ConversationManager } from '../../core/conversation/ConversationManager';
import { createLegacyChatHandlers } from './legacy-chat';

describe('legacy chat knowledge miss contract', () => {
  it('saves Markdown plans and returns implement-mode actions from plan mode', async () => {
    const app = express();
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-plan-route-'));
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
      workspaceRoot,
    }));

    await request(app)
      .post('/api/chat')
      .send({
        message: 'Implement a file explorer panel',
        sessionId: 'plan-session',
        mode: 'plan',
      })
      .expect(200)
      .expect(response => {
        expect(response.body.savedMarkdown).toBe(true);
        expect(response.body.suggestedNextMode).toBe('implement');
        expect(response.body.planPath).toMatch(/plans\//);
        expect(fs.existsSync(path.join(workspaceRoot, response.body.planPath))).toBe(true);
        expect(response.body.actions).toEqual(expect.arrayContaining([
          expect.objectContaining({ type: 'switch_mode', mode: 'implement' }),
          expect.objectContaining({ type: 'open_plan' }),
        ]));
      });

    expect(orchestrator.processRequest).not.toHaveBeenCalled();
  });

  it('returns a debug-mode switch prompt for stack traces outside debug mode', async () => {
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
        message: 'TypeError: Cannot read properties of undefined',
        sessionId: 'debug-session',
        mode: 'ask',
      })
      .expect(200)
      .expect(response => {
        expect(response.body.response).toContain('Switch to Debug');
        expect(response.body.modeSwitch.targetMode).toBe('debug');
      });
  });

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
          domain: 'ask',
          proposedWebQuery: 'What changed in the newest Godot release?',
          suggestedNextAction: 'search_online',
        }));
      });

    expect(orchestrator.processRequest).not.toHaveBeenCalled();
  });

  it('prefers local library answers over broad history routing for book questions', async () => {
    const app = express();
    const conversationManager = new ConversationManager();
    const orchestrator = {
      processRequest: jest.fn(),
    };
    const ragDocumentStore = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'hobbit-chunk-0',
          content: 'The Hobbit is a tale of high adventure. A reluctant partner in this perilous quest is Bilbo Baggins.',
          metadata: {
            source: 'books/The Hobbit.epub',
            title: 'The Hobbit'
          }
        },
        score: 1,
        retrievalMethod: 'keyword'
      }])
    };

    app.use(express.json());
    app.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => ({ ragDocumentStore }),
      getOrchestrator: () => orchestrator,
      waitForReady: jest.fn().mockResolvedValue(undefined),
      getConversationManager: () => conversationManager,
    }));

    await request(app)
      .post('/api/chat')
      .send({
        message: 'What happens in The Hobbit?',
        sessionId: 'book-route-session',
        mode: 'ask',
      })
      .expect(200)
      .expect(response => {
        expect(response.body.model).toBe('local-knowledge-base');
        expect(response.body.mode).toBe('ask');
        expect(response.body.response).toContain('Bilbo Baggins');
        expect(response.body.nlu.route).toBe('history');
      });

    expect(orchestrator.processRequest).not.toHaveBeenCalled();
  });

  it('routes music-industry history to pop-culture instead of generic year retrieval', async () => {
    const app = express();
    const conversationManager = new ConversationManager();
    const orchestrator = { processRequest: jest.fn() };
    const popCultureGeniusAgent = {
      ask: jest.fn().mockResolvedValue({
        response: 'Music-industry context for 1997.',
        sources: ['Official Charts']
      })
    };
    const ragDocumentStore = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1997-general-chunk-0',
          content: 'Domain: general\n1997 was a common year with many events.',
          metadata: {
            source: 'knowledge-base-public/general/wikipedia-summaries/1997.md',
            title: '1997.md'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    app.use(express.json());
    app.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => ({ popCultureGeniusAgent, ragDocumentStore }),
      getOrchestrator: () => orchestrator,
      waitForReady: jest.fn().mockResolvedValue(undefined),
      getConversationManager: () => conversationManager,
    }));

    await request(app)
      .post('/api/chat')
      .send({
        message: 'tell me about the music industry in 1997',
        sessionId: 'music-industry-1997-session',
        mode: 'ask',
      })
      .expect(200)
      .expect(response => {
        expect(response.body.response).toBe('Music-industry context for 1997.');
        expect(response.body.model).toBe('pop-culture-specialist');
        expect(response.body.nlu.normalizedQuery).toBe('tell me about the music industry in 1997');
      });

    expect(popCultureGeniusAgent.ask).toHaveBeenCalledWith('tell me about the music industry in 1997');
    expect(ragDocumentStore.searchKeyword).not.toHaveBeenCalled();
    expect(orchestrator.processRequest).not.toHaveBeenCalled();
  });

  it('routes specialist requests (coding, math, science, knowledge_os, music, creative_writing)', async () => {
    const app = express();
    const conversationManager = new ConversationManager();
    const orchestrator = { processRequest: jest.fn().mockResolvedValue({ response: 'orchestrator response' }) };

    const mathGeniusAgent = { solve: jest.fn().mockResolvedValue({ response: 'E = mc^2', sources: [] }) };
    const marketGeniusAgent = { analyze: jest.fn().mockResolvedValue({ response: 'Bullish trend', sources: [] }) };
    const gameDevGeniusAgent = { answer: jest.fn().mockResolvedValue({ response: 'Use ECS architecture', sources: [] }) };
    const gamingGeniusAgent = { ask: jest.fn().mockResolvedValue({ response: 'Boss guide', sources: [] }) };
    const scienceInventionGeniusAgent = { ask: jest.fn().mockResolvedValue({ response: 'Quantum computing', sources: [] }) };
    const historyGeniusAgent = { ask: jest.fn().mockResolvedValue({ response: 'The Roman Empire fell in 476 AD', sources: [] }) };
    const flStudioControlAgent = { command: jest.fn().mockResolvedValue({ response: 'FL Studio dry run', mode: 'dry_run' }) };
    const musicProductionGeniusAgent = {
      sunoPrompt: jest.fn().mockResolvedValue({ response: 'Suno prompt formatted' }),
      flStudioWorkflow: jest.fn().mockResolvedValue({ response: 'FL Studio workflow' }),
      proToolsWorkflow: jest.fn().mockResolvedValue({ response: 'Pro Tools workflow' }),
      logicWorkflow: jest.fn().mockResolvedValue({ response: 'Logic Pro workflow' }),
      mix: jest.fn().mockResolvedValue({ response: 'Mix master plan' }),
      ask: jest.fn().mockResolvedValue({ response: 'Music response' })
    };
    const codingAgent = { handle: jest.fn().mockResolvedValue({ response: 'Code generated' }) };
    const storyGeniusAgent = { ask: jest.fn().mockResolvedValue({ response: 'Story drafted' }) };

    app.use(express.json());
    app.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => ({
        mathGeniusAgent,
        marketGeniusAgent,
        gameDevGeniusAgent,
        gamingGeniusAgent,
        scienceInventionGeniusAgent,
        historyGeniusAgent,
        flStudioControlAgent,
        musicProductionGeniusAgent,
        codingAgent,
        storyGeniusAgent
      }),
      getOrchestrator: () => orchestrator,
      waitForReady: jest.fn().mockResolvedValue(undefined),
      getConversationManager: () => conversationManager,
    }));

    // Math mode
    const mathRes = await request(app).post('/api/chat').send({ message: 'calculate eigenvalue', sessionId: 's1', mode: 'math' });
    expect(mathRes.body.response).toBe('E = mc^2');

    // Science mode
    const sciRes = await request(app).post('/api/chat').send({ message: 'explain superconductors', sessionId: 's2', mode: 'science' });
    expect(sciRes.body.response).toBe('Quantum computing');

    // History mode
    const histRes = await request(app).post('/api/chat').send({ message: 'fall of Rome', sessionId: 's3', mode: 'history' });
    expect(histRes.body.response).toContain('Roman Empire');

    // FL Studio Control
    const flRes = await request(app).post('/api/chat').send({ message: 'mute track 1', sessionId: 's4', mode: 'fl_studio_control' });
    expect(flRes.body.response).toBe('FL Studio dry run');

    // Suno mode
    const sunoRes = await request(app).post('/api/chat').send({ message: 'synthwave track', sessionId: 's5', mode: 'suno' });
    expect(sunoRes.body.response).toBe('Suno prompt formatted');

    // FL Studio mode
    const flwRes = await request(app).post('/api/chat').send({ message: 'sidechain bass', sessionId: 's6', mode: 'fl_studio' });
    expect(flwRes.body.response).toBe('FL Studio workflow');

    // Pro Tools mode
    const ptRes = await request(app).post('/api/chat').send({ message: 'vocal bus routing', sessionId: 's7', mode: 'pro_tools' });
    expect(ptRes.body.response).toBe('Pro Tools workflow');

    // Logic mode
    const logicRes = await request(app).post('/api/chat').send({ message: 'drum machine designer', sessionId: 's8', mode: 'logic' });
    expect(logicRes.body.response).toBe('Logic Pro workflow');

    // Mix Master mode
    const mixRes = await request(app).post('/api/chat').send({ message: 'mastering chain', sessionId: 's9', mode: 'mix_master' });
    expect(mixRes.body.response).toBe('Mix master plan');

    // Creative writing mode
    const storyRes = await request(app).post('/api/chat').send({ message: 'Write a sci-fi opening', sessionId: 's10', mode: 'creative_writing' });
    expect(storyRes.body.response).toContain('Draft Scene');

    // Roleplay mode
    const roleplayRes = await request(app).post('/api/chat').send({ message: 'Greetings traveler', sessionId: 's10-rp', mode: 'roleplay' });
    expect(roleplayRes.body.response).toBeDefined();

    // Coding mode
    const codingRes = await request(app).post('/api/chat').send({ message: 'write a function', sessionId: 's11', mode: 'coding' });
    expect(codingRes.body.response).toBe('Code generated');

    // Generic agents: legal, health, security, business, philosophy, language, geography, engineering
    const genericMock = { ask: jest.fn().mockResolvedValue({ response: 'Generic agent response' }) };
    const genericApp = express();
    genericApp.use(express.json());
    genericApp.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => ({
        legalCivicGeniusAgent: genericMock,
        healthGeniusAgent: genericMock,
        securityGeniusAgent: genericMock,
        businessGeniusAgent: genericMock,
        philosophyGeniusAgent: genericMock,
        languageGeniusAgent: genericMock,
        geoCultureGeniusAgent: genericMock,
        engineeringGeniusAgent: genericMock,
        mixGeniusAgent: { plan: jest.fn().mockResolvedValue({ response: 'Mix planned' }) }
      }),
      getOrchestrator: () => orchestrator,
      waitForReady: jest.fn().mockResolvedValue(undefined),
      getConversationManager: () => conversationManager,
    }));

    for (const mode of ['legal', 'health', 'security', 'business', 'philosophy', 'language', 'geography', 'engineering', 'mix_master']) {
      const res = await request(genericApp).post('/api/chat').send({ message: `Query for ${mode}`, sessionId: `s-${mode}`, mode });
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    }

    // Fallback to general orchestrator
    const orchRes = await request(app).post('/api/chat').send({ message: 'generic message', sessionId: 's12', mode: 'agent' });
    expect(orchRes.body.response).toBe('orchestrator response');
  });
});
