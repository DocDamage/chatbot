import express from 'express';
import request from 'supertest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ConversationManager } from '../../../core/conversation/ConversationManager';
import { createLegacyChatHandlers } from '../legacy-chat';

describe('HTTP route decision matrices - Legacy Chat Router', () => {
  let conversationManager: ConversationManager;
  let orchestrator: { processRequest: jest.Mock };

  beforeEach(() => {
    conversationManager = new ConversationManager();
    orchestrator = {
      processRequest: jest.fn().mockResolvedValue({
        response: 'Orchestrator answer',
        sources: ['default-source'],
        model: 'orchestrator-model'
      })
    };
  });

  function createTestApp(
    services: any = {},
    readyMock = jest.fn().mockResolvedValue(undefined),
    workspaceRoot = process.cwd()
  ) {
    const app = express();
    app.use(express.json());
    app.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => services,
      getOrchestrator: () => orchestrator,
      waitForReady: readyMock,
      getConversationManager: () => conversationManager,
      workspaceRoot,
    }));
    return app;
  }

  it('validates request payload and checks service readiness timeout', async () => {
    const app = createTestApp();

    // Invalid body (missing message)
    await request(app).post('/api/chat').send({ sessionId: 's1' }).expect(400);

    // Readiness rejected
    const unreadyApp = createTestApp({}, jest.fn().mockRejectedValue(new Error('Service not ready')));
    await request(unreadyApp)
      .post('/api/chat')
      .send({ message: 'Hello', sessionId: 's1' })
      .expect(500);
  });

  it('handles plan mode and mode switch policy requirements', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'chatbot-legacy-plan-'));
    const app = createTestApp({}, jest.fn().mockResolvedValue(undefined), workspaceRoot);

    try {
      // Plan mode creates plan
      const planRes = await request(app)
        .post('/api/chat')
        .send({ message: 'Plan a new authentication feature', sessionId: 's-plan', mode: 'plan' })
        .expect(200);
      expect(planRes.body).toHaveProperty('planId');
      expect(planRes.body.mode).toBe('plan');

      // Mode switch requirement (e.g. ask in code mode or edit in review mode)
      const switchRes = await request(app)
        .post('/api/chat')
        .send({ message: 'implement the login screen code right now', sessionId: 's-sw', mode: 'review' })
        .expect(200);
      expect(switchRes.body).toHaveProperty('modeSwitch');
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('routes creative_writing and roleplay specialist modes', async () => {
    const mockCreative = {
      ask: jest.fn().mockResolvedValue({ response: 'Creative scene draft', sources: [] }),
      roleplayTurn: jest.fn().mockResolvedValue({ response: 'In-character response', sources: [] }),
    };

    const app = createTestApp({ creativeWritingAgent: mockCreative });

    // creative_writing mode
    const res1 = await request(app)
      .post('/api/chat')
      .send({ message: 'Write a scene in a tavern', sessionId: 's1', mode: 'creative_writing' })
      .expect(200);
    expect(res1.body.response).toBe('Creative scene draft');
    expect(mockCreative.ask).toHaveBeenCalled();

    // roleplay mode
    const res2 = await request(app)
      .post('/api/chat')
      .send({ message: 'I draw my sword', sessionId: 's1', mode: 'roleplay' })
      .expect(200);
    expect(res2.body.response).toBe('In-character response');
    expect(mockCreative.roleplayTurn).toHaveBeenCalled();
  });

  it('routes coding mode with authorization and context bundle', async () => {
    const mockCodingAgent = {
      handle: jest.fn().mockResolvedValue({ response: 'Code solution', sources: ['src/app.ts'] })
    };

    const app = createTestApp({ codingAgent: mockCodingAgent });

    const res = await request(app)
      .post('/api/chat')
      .send({
        message: 'Fix the bug in src/index.ts',
        sessionId: 's-code',
        mode: 'coding',
        loadedFiles: [{ path: 'src/index.ts', content: 'const a = 1;' }],
        loadedAudio: [{ path: 'voice.wav' }]
      })
      .expect(200);

    expect(res.body.response).toBe('Code solution');
    expect(res.body).toHaveProperty('codingAuthorization');
    expect(mockCodingAgent.handle).toHaveBeenCalled();
  });

  it('routes knowledge_os mode', async () => {
    const app = createTestApp({
      entityLinkingService: { stats: jest.fn().mockResolvedValue({ total: 0 }) },
      knowledgeGraphIndexer: { stats: jest.fn().mockResolvedValue({ nodes: 0, edges: 0 }) },
      privateMemoryStore: { stats: jest.fn().mockResolvedValue({ total: 0, approved: 0, pending: 0 }) },
      governanceEvidenceService: { listReports: jest.fn().mockResolvedValue([]) },
    });

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'What is the status of knowledge OS?', sessionId: 's-kos', mode: 'knowledge_os' })
      .expect(200);
    expect(res.body).toBeDefined();
  });

  it('routes music production modes (suno, fl_studio, pro_tools, logic, mix_master, music)', async () => {
    const mockMusicAgent = {
      sunoPrompt: jest.fn().mockResolvedValue({ response: 'Suno prompt formatted' }),
      flStudioWorkflow: jest.fn().mockResolvedValue({ response: 'FL workflow instructions' }),
      proToolsWorkflow: jest.fn().mockResolvedValue({ response: 'Pro Tools workflow' }),
      logicWorkflow: jest.fn().mockResolvedValue({ response: 'Logic workflow' }),
      mix: jest.fn().mockResolvedValue({ response: 'Basic mix advice' }),
      ask: jest.fn().mockResolvedValue({ response: 'General music response' }),
    };
    const mockMixGenius = {
      plan: jest.fn().mockResolvedValue({ response: 'Mix genius plan' })
    };
    const mockFlControl = {
      command: jest.fn().mockResolvedValue({ response: 'FL command sent' })
    };

    const app = createTestApp({
      musicProductionGeniusAgent: mockMusicAgent,
      mixGeniusAgent: mockMixGenius,
      flStudioControlAgent: mockFlControl,
    });

    // Suno
    await request(app).post('/api/chat').send({ message: 'synthwave 80s', sessionId: 's-m', mode: 'suno' }).expect(200);
    expect(mockMusicAgent.sunoPrompt).toHaveBeenCalled();

    // FL Studio
    await request(app).post('/api/chat').send({ message: 'piano roll chords', sessionId: 's-m', mode: 'fl_studio' }).expect(200);
    expect(mockMusicAgent.flStudioWorkflow).toHaveBeenCalled();

    // Pro Tools
    await request(app).post('/api/chat').send({ message: 'vocal comping', sessionId: 's-m', mode: 'pro_tools' }).expect(200);
    expect(mockMusicAgent.proToolsWorkflow).toHaveBeenCalled();

    // Logic
    await request(app).post('/api/chat').send({ message: 'drummer track', sessionId: 's-m', mode: 'logic' }).expect(200);
    expect(mockMusicAgent.logicWorkflow).toHaveBeenCalled();

    // mix_master with mixGeniusAgent
    const mixRes = await request(app).post('/api/chat').send({ message: 'mastering chain', sessionId: 's-m', mode: 'mix_master' }).expect(200);
    expect(mixRes.body.response).toBe('Mix genius plan');
    expect(mockMixGenius.plan).toHaveBeenCalled();

    // fl_studio_control
    await request(app).post('/api/chat').send({ message: 'solo the drums', sessionId: 's-m', mode: 'fl_studio_control' }).expect(200);
    expect(mockFlControl.command).toHaveBeenCalled();

    // mix_master without mixGeniusAgent fallback
    const appFallback = createTestApp({ musicProductionGeniusAgent: mockMusicAgent });
    await request(appFallback).post('/api/chat').send({ message: 'eq vocal', sessionId: 's-m', mode: 'mix_master' }).expect(200);
    expect(mockMusicAgent.mix).toHaveBeenCalled();
  });

  it('routes pop_culture, history, and science modes with specialists and music industry check', async () => {
    const mockPop = { ask: jest.fn().mockResolvedValue({ response: 'Pop culture answer', sources: ['s1'] }) };
    const mockHist = { ask: jest.fn().mockResolvedValue({ response: 'History answer', sources: ['s2'] }) };
    const mockSci = { ask: jest.fn().mockResolvedValue({ response: 'Science answer', sources: ['s3'] }) };

    const app = createTestApp({
      popCultureGeniusAgent: mockPop,
      historyGeniusAgent: mockHist,
      scienceInventionGeniusAgent: mockSci,
    });

    // Music industry history question (dates + keywords)
    const musicHistRes = await request(app)
      .post('/api/chat')
      .send({ message: 'Tell me about the music industry in 1995 and record label changes', sessionId: 's-p', mode: 'pop_culture' })
      .expect(200);
    expect(musicHistRes.body.model).toBe('pop-culture-specialist');

    // Pop culture generic
    await request(app).post('/api/chat').send({ message: 'Tell me about Marvel movies', sessionId: 's-p', mode: 'pop_culture' }).expect(200);
    expect(mockPop.ask).toHaveBeenCalled();

    // History generic
    await request(app).post('/api/chat').send({ message: 'Explain the Roman Empire expansion', sessionId: 's-h', mode: 'history' }).expect(200);
    expect(mockHist.ask).toHaveBeenCalled();

    // Science generic
    await request(app).post('/api/chat').send({ message: 'Who invented the transistor in physics?', sessionId: 's-sc', mode: 'science' }).expect(200);
    expect(mockSci.ask).toHaveBeenCalled();
  });

  it('routes specialist genius agents (legal, health, security, business, philosophy, language, geography, engineering, math, market, gamedev, gaming)', async () => {
    const mockAgents = {
      legalCivicGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Legal answer' }) },
      healthGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Health answer' }) },
      securityGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Security answer' }) },
      businessGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Business answer' }) },
      philosophyGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Philosophy answer' }) },
      languageGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Language answer' }) },
      geoCultureGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Geography answer' }) },
      engineeringGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Engineering answer' }) },
      mathGeniusAgent: { solve: jest.fn().mockResolvedValue({ response: 'Math answer' }) },
      marketGeniusAgent: { analyze: jest.fn().mockResolvedValue({ response: 'Market answer' }) },
      gameDevGeniusAgent: { answer: jest.fn().mockResolvedValue({ response: 'GameDev answer' }) },
      gamingGeniusAgent: { ask: jest.fn().mockResolvedValue({ response: 'Gaming answer' }) },
    };

    const app = createTestApp(mockAgents);

    const modes = [
      ['legal', 'review this contract clause', mockAgents.legalCivicGeniusAgent.ask],
      ['health', 'knee pain symptoms', mockAgents.healthGeniusAgent.ask],
      ['security', 'threat model for oauth flow', mockAgents.securityGeniusAgent.ask],
      ['business', 'saas pricing strategy', mockAgents.businessGeniusAgent.ask],
      ['philosophy', 'ethics of ai reasoning', mockAgents.philosophyGeniusAgent.ask],
      ['language', 'translate to spanish', mockAgents.languageGeniusAgent.ask],
      ['geography', 'tokyo cultural customs', mockAgents.geoCultureGeniusAgent.ask],
      ['engineering', 'beam load calculation', mockAgents.engineeringGeniusAgent.ask],
      ['math', 'solve derivative of x^3', mockAgents.mathGeniusAgent.solve],
      ['market', 'competitor analysis', mockAgents.marketGeniusAgent.analyze],
      ['gamedev', 'jump mechanics design', mockAgents.gameDevGeniusAgent.answer],
      ['gaming', 'elden ring speedrun route', mockAgents.gamingGeniusAgent.ask],
    ] as const;

    for (const [mode, msg, mockFn] of modes) {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: msg, sessionId: `s-${mode}`, mode })
        .expect(200);
      expect(res.body.response).toBeTruthy();
      expect(mockFn).toHaveBeenCalled();
    }
  });

  it('handles fallback orchestrator and message payload variations', async () => {
    orchestrator.processRequest.mockResolvedValueOnce({ response: 'Fallback orchestrator string' });
    const app = createTestApp({});

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'General question without specialist', sessionId: 's-orch', mode: 'orchestrator' })
      .expect(200);

    expect(res.body.response).toBe('Fallback orchestrator string');
  });

  it('routes knowledge_os, fl_studio_control, and music mix intent', async () => {
    const mockServices = {
      flStudioControlAgent: {
        command: jest.fn().mockResolvedValue({ response: 'FL Studio dry run command executed' })
      },
      mixGeniusAgent: {
        plan: jest.fn().mockResolvedValue({ response: 'Mix plan generated' })
      },
      musicProductionGeniusAgent: {
        ask: jest.fn().mockResolvedValue({ response: 'Music response' })
      }
    };

    const app = createTestApp(mockServices);

    // FL studio control
    const flRes = await request(app)
      .post('/api/chat')
      .send({ message: 'set tempo to 128', sessionId: 's-fl', mode: 'fl_studio_control' })
      .expect(200);
    expect(flRes.body.response).toContain('FL Studio');

    // Knowledge OS
    const kosRes = await request(app)
      .post('/api/chat')
      .send({ message: 'knowledge search query', sessionId: 's-kos', mode: 'knowledge_os' })
      .expect(200);
    expect(kosRes.body).toBeDefined();

    // Music mix intent
    const mixRes = await request(app)
      .post('/api/chat')
      .send({ message: 'mix vocals and drums', sessionId: 's-mix', mode: 'music' })
      .expect(200);
    expect(mixRes.body).toBeDefined();
  });
});
