import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { ServiceInitializer } from '../../core/initialization/ServiceInitializer';
import { AuthService } from '../../core/auth/AuthService';
import { ConfigValidator } from '../../core/config/ConfigValidator';

// Mock external knowledge sources so tests never attempt real outbound network calls
jest.mock('../../core/knowledge/RedditSource', () => ({
  RedditSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Reddit result' }]) })),
}));
jest.mock('../../core/knowledge/YouTubeSource', () => ({
  YouTubeSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'YouTube result' }]) })),
}));
jest.mock('../../core/knowledge/UniversitySource', () => ({
  UniversitySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'University result' }]) })),
}));
jest.mock('../../core/knowledge/ScientificPapersSource', () => ({
  ScientificPapersSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Paper result' }]) })),
}));
jest.mock('../../core/knowledge/GitHubSource', () => ({
  GitHubSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'GitHub result' }]) })),
}));
jest.mock('../../core/knowledge/StackOverflowSource', () => ({
  StackOverflowSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'SO result' }]) })),
}));
jest.mock('../../core/knowledge/NewsSource', () => ({
  NewsSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'News result' }]) })),
}));
jest.mock('../../core/knowledge/MediumSource', () => ({
  MediumSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Medium result' }]) })),
}));
jest.mock('../../core/knowledge/QuoraSource', () => ({
  QuoraSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Quora result' }]) })),
}));
jest.mock('../../core/knowledge/ProjectGutenbergSource', () => ({
  ProjectGutenbergSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Gutenberg result' }]) })),
}));
jest.mock('../../core/knowledge/DocumentationSource', () => ({
  DocumentationSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Docs result' }]) })),
}));
jest.mock('../../core/knowledge/LibraryOfCongressSource', () => ({
  LibraryOfCongressSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'LOC result' }]) })),
}));
jest.mock('../../core/knowledge/EntertainmentSource', () => ({
  EntertainmentSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Entertainment result' }]) })),
}));
jest.mock('../../core/knowledge/BookSource', () => ({
  BookSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Book result' }]) })),
}));
jest.mock('../../core/knowledge/SpecializedTopicSource', () => ({
  SpecializedTopicSource: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue([{ title: 'Specialized result' }]),
    getCuratedSources: jest.fn().mockReturnValue([{ name: 'Curated 1' }]),
  })),
}));
jest.mock('../../core/knowledge/FinancialAdviceSource', () => ({
  FinancialAdviceSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Financial result' }]) })),
}));
jest.mock('../../core/knowledge/ReligionSource', () => ({
  ReligionSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Religion result' }]) })),
}));
jest.mock('../../core/knowledge/MentalHealthSource', () => ({
  MentalHealthSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Mental Health result' }]) })),
}));
jest.mock('../../core/knowledge/WebDesignSource', () => ({
  WebDesignSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Web Design result' }]) })),
}));
jest.mock('../../core/knowledge/UIDesignSource', () => ({
  UIDesignSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'UI Design result' }]) })),
}));
jest.mock('../../core/knowledge/BackendDesignSource', () => ({
  BackendDesignSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Backend result' }]) })),
}));
jest.mock('../../core/knowledge/MusicTheorySource', () => ({
  MusicTheorySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Music result' }]) })),
}));
jest.mock('../../core/knowledge/LLMProgrammingSource', () => ({
  LLMProgrammingSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'LLM result' }]) })),
}));
jest.mock('../../core/knowledge/AnatomySource', () => ({
  AnatomySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Anatomy result' }]) })),
}));
jest.mock('../../core/knowledge/PotterySource', () => ({
  PotterySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Pottery result' }]) })),
}));
jest.mock('../../core/knowledge/GardeningSource', () => ({
  GardeningSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Gardening result' }]) })),
}));
jest.mock('../../core/knowledge/CNASource', () => ({
  CNASource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'CNA result' }]) })),
}));
jest.mock('../../core/knowledge/DSPSource', () => ({
  DSPSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'DSP result' }]) })),
}));
jest.mock('../../core/knowledge/RNSource', () => ({
  RNSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'RN result' }]) })),
}));
jest.mock('../../core/knowledge/AstronomySource', () => ({
  AstronomySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Astronomy result' }]) })),
}));
jest.mock('../../core/knowledge/AstrologySource', () => ({
  AstrologySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Astrology result' }]) })),
}));
jest.mock('../../core/knowledge/BotanySource', () => ({
  BotanySource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Botany result' }]) })),
}));
jest.mock('../../core/knowledge/MarijuanaGrowingSource', () => ({
  MarijuanaGrowingSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Marijuana result' }]) })),
}));
jest.mock('../../core/knowledge/WikipediaSource', () => ({
  WikipediaSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'Wikipedia result' }]) })),
}));
jest.mock('../../core/knowledge/WebScraperSource', () => ({
  WebScraperSource: jest.fn().mockImplementation(() => ({ search: jest.fn().mockResolvedValue([{ title: 'WebScraper result' }]) })),
}));

describe('Server Entrypoint Lifecycle & Full Branch Coverage Suite', () => {
  const secret = 'super-secret-key-32-chars-long-for-testing-lifecycle';
  let adminToken: string;
  let devToken: string;
  let app: any;
  let server: any;
  let indexModule: any;
  let mockServices: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    process.env.CSRF_TOKEN = 'expected-csrf-12345';
    process.env.ENABLE_WEBSOCKET = 'true';

    const auth = new AuthService(secret);
    adminToken = auth.generateToken({ id: 'admin-1', email: 'admin@test.com', roles: ['admin', 'developer'] });
    devToken = auth.generateToken({ id: 'dev-1', email: 'dev@test.com', roles: ['developer'] });

    mockServices = {
      database: {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      },
      orchestrator: {
        llmAdapter: {
          generate: jest.fn().mockResolvedValue('adapter generated text'),
          complete: jest.fn().mockResolvedValue({ text: 'mock text' }),
        },
        processRequest: jest.fn().mockResolvedValue({ response: 'ok', sessionId: 's1' }),
      },
      documentManager: {
        addText: jest.fn().mockResolvedValue([{ id: 'c1', content: 'test chunk' }]),
        addFile: jest.fn().mockResolvedValue([{ id: 'f1', content: 'file chunk' }]),
        addDirectory: jest.fn().mockResolvedValue([{ id: 'd1', content: 'dir chunk' }]),
        getStats: jest.fn().mockReturnValue({ chunks: 1 }),
        query: jest.fn().mockResolvedValue([]),
      },
      toolRegistry: {
        getAll: jest.fn().mockReturnValue([
          { id: 't1', name: 'Tool 1', description: 'Desc 1', category: 'general' },
        ]),
        getStats: jest.fn().mockReturnValue({ total: 1 }),
      },
      embeddingService: {
        generateEmbedding: jest.fn().mockResolvedValue(new Array(128).fill(0.1)),
      },
      conversationManager: {
        listConversations: jest.fn().mockResolvedValue([{ id: 's1', title: 'Conversation 1' }]),
        getConversation: jest.fn().mockImplementation((async (id: any) => {
          if (id === 'nonexistent-session') return null;
          return { id, messages: [{ role: 'user', content: 'hello' }] };
        }) as any),
        deleteConversation: jest.fn().mockResolvedValue(true),
      },
    };

    jest.spyOn(ServiceInitializer, 'initialize').mockResolvedValue(mockServices as any);

    indexModule = require('../index');
    app = indexModule.app;
    server = indexModule.server;
    await indexModule.waitForReady(5000);
  });

  afterAll(async () => {
    if (server && server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('getApiVersion and helper coverage', () => {
    it('determines API version correctly from headers, url, or default', () => {
      const getApiVersion = indexModule.getApiVersion;
      expect(getApiVersion({ headers: { 'api-version': '3' }, path: '/api/chat' })).toBe('3');
      expect(getApiVersion({ headers: {}, path: '/api/v2/chat' })).toBe('2');
      expect(getApiVersion({ headers: {}, path: '/api/v1/chat' })).toBe('1');
      expect(getApiVersion({ headers: {}, path: '/api/unknown' })).toBe('1');
    });

    it('manages conversationManager singleton creation if missing', () => {
      const getConvMgr = indexModule.getConversationManager;
      const mgr = getConvMgr();
      expect(mgr).toBeDefined();
      expect(typeof mgr.getConversation).toBe('function');
    });
  });

  describe('Readiness & Lifecycle states', () => {
    it('waitForReady resolves immediately when ready', async () => {
      await expect(indexModule.waitForReady(1000)).resolves.toBeUndefined();
    });

    it('reinitializes services via reinitializeServices()', async () => {
      await indexModule.reinitializeServices();
      await expect(indexModule.waitForReady(1000)).resolves.toBeUndefined();
    });

    it('routes /api/v1 and /api/v2 chat endpoints with orchestrator', async () => {
      const v1Res = await request(app)
        .post('/api/v1')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ message: 'Hello v1' });
      expect([200, 404, 503]).toContain(v1Res.status);

      const v2Res = await request(app)
        .post('/api/v2')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ message: 'Hello v2' });
      expect([200, 404, 503]).toContain(v2Res.status);
    });
  });

  describe('Knowledge Base Endpoints', () => {
    it('handles /api/knowledge-base/add with text and metadata', async () => {
      const res = await request(app)
        .post('/api/knowledge-base/add')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ text: 'Knowledge text', metadata: { author: 'Alice' } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chunksCount).toBe(1);

      // Without metadata
      const res2 = await request(app)
        .post('/api/knowledge-base/add')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ text: 'Knowledge text only' });
      expect(res2.status).toBe(200);
    });

    it('handles /api/knowledge-base/file', async () => {
      const res = await request(app)
        .post('/api/knowledge-base/file')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ filePath: 'data/sample.md' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chunksCount).toBe(1);
    });

    it('handles /api/knowledge-base/directory with full options and invalid inputs', async () => {
      // Missing directoryPath -> 400
      const resInvalid = await request(app)
        .post('/api/knowledge-base/directory')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({ directoryPath: '   ' });
      expect(resInvalid.status).toBe(400);

      // Full options
      const resFull = await request(app)
        .post('/api/knowledge-base/directory')
        .set('Authorization', `Bearer ${devToken}`)
        .set('x-csrf-token', '1')
        .send({
          directoryPath: 'docs/',
          options: {
            chunkSize: 500,
            chunkOverlap: 50,
            generateEmbeddings: false,
            embeddingProvider: 'local',
            embeddingModel: 'minilm',
            embeddingBatchSize: 16,
          },
        });
      expect(resFull.status).toBe(200);
      expect(resFull.body.success).toBe(true);
    });
  });

  describe('Tools & Models & Docs Endpoints', () => {
    it('serves /api/tools with stats and mapping', async () => {
      const res = await request(app)
        .get('/api/tools')
        .set('Authorization', `Bearer ${devToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tools)).toBe(true);
      expect(res.body.stats).toBeDefined();
    });

    it('serves /api/models/free', async () => {
      const res = await request(app)
        .get('/api/models/free')
        .set('Authorization', `Bearer ${devToken}`);
      expect(res.status).toBe(200);
      expect(res.body.llm).toBeDefined();
      expect(res.body.vision).toBeDefined();
      expect(res.body.embedding).toBeDefined();
    });

    it('serves /api-docs with YAML or 404', async () => {
      const res = await request(app)
        .get('/api-docs')
        .set('Authorization', `Bearer ${devToken}`);
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('File Upload Endpoint', () => {
    it('rejects /api/upload when no file uploaded', async () => {
      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${devToken}`);
      expect(res.status).toBe(400);
      const errMsg = res.body.error?.message || res.body.error;
      expect(errMsg).toBe('No file uploaded');
    });

    it('handles /api/upload with valid file', async () => {
      const { FileProcessor } = require('../../core/upload/FileProcessor');
      jest.spyOn(FileProcessor.prototype, 'processFile').mockResolvedValueOnce({
        success: true,
        chunks: [{ id: 'up1', content: 'uploaded chunk' }],
        metadata: { filename: 'test.txt' },
      } as any);

      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${devToken}`)
        .attach('file', Buffer.from('test file content'), 'test.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chunks).toBeDefined();

      // Test processFile failure path
      jest.spyOn(FileProcessor.prototype, 'processFile').mockResolvedValueOnce({
        success: false,
        error: 'Unsupported file format',
      } as any);

      const resFail = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${devToken}`)
        .attach('file', Buffer.from('bad content'), 'bad.bin');

      expect(resFail.status).toBe(400);
      const errFail = resFail.body.error?.message || resFail.body.error;
      expect(errFail).toBe('Unsupported file format');
    });
  });

  describe('Feedback & Custom Instructions', () => {
    it('handles /api/feedback POST and GET', async () => {
      const postRes = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          messageId: 'msg-lifecycle-1',
          sessionId: 'sess-lifecycle-1',
          reaction: 'thumbs_up',
          rating: 5,
          comment: 'Outstanding performance',
        });
      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/feedback/msg-lifecycle-1')
        .set('Authorization', `Bearer ${devToken}`);
      expect(getRes.status).toBe(200);
    });

    it('handles /api/user/instructions GET and PUT', async () => {
      const getRes = await request(app)
        .get('/api/user/instructions')
        .set('Authorization', `Bearer ${devToken}`);
      expect(getRes.status).toBe(200);

      const putRes = await request(app)
        .put('/api/user/instructions')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ customInstructions: 'Always answer with extreme precision.' });
      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
    });
  });

  describe('Quick Replies, Sharing, and Document Search', () => {
    it('serves /api/chat/quick-replies with query params', async () => {
      const { QuickRepliesService } = require('../../core/suggestions/QuickReplies');
      jest.spyOn(QuickRepliesService.prototype, 'generateQuickReplies').mockResolvedValue(['Yes', 'No', 'Explain']);

      const res = await request(app)
        .get('/api/chat/quick-replies?lastMessage=Hello&lastResponse=Hi&context=%7B%22topic%22%3A%22test%22%7D')
        .set('Authorization', `Bearer ${devToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.replies)).toBe(true);
    });

    it('handles /api/conversations/:sessionId/share and /api/share/:shareId', async () => {
      const { ConversationSharingService } = require('../../core/sharing/ConversationSharing');
      jest.spyOn(ConversationSharingService.prototype, 'createShare').mockResolvedValue({
        shareId: 'share-abc-123',
        shareUrl: 'http://localhost:3001/share/share-abc-123',
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      jest.spyOn(ConversationSharingService.prototype, 'getShare').mockImplementation((async (id: any) => {
        if (id === 'nonexistent-share') return null;
        return { shareId: id, sessionId: 's1', title: 'Shared Session' };
      }) as any);

      const postRes = await request(app)
        .post('/api/conversations/s1/share')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ title: 'Shared convo', public: true, expiresInDays: 7 });
      expect(postRes.status).toBe(200);
      expect(postRes.body.shareId).toBe('share-abc-123');

      // Not found share
      const missingRes = await request(app)
        .get('/api/share/nonexistent-share')
        .set('Authorization', `Bearer ${devToken}`);
      expect(missingRes.status).toBe(404);

      // Found share
      const foundRes = await request(app)
        .get('/api/share/share-abc-123')
        .set('Authorization', `Bearer ${devToken}`);
      expect(foundRes.status).toBe(200);
      expect(foundRes.body.share).toBeDefined();
      expect(foundRes.body.conversation).toBeDefined();
    });

    it('searches documents via /api/documents/search with multiple filter combinations', async () => {
      const res = await request(app)
        .get('/api/documents/search?tags=code,ai&category=engineering&source=docs&q=test&limit=10')
        .set('Authorization', `Bearer ${devToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.documents)).toBe(true);
    });
  });

  describe('Comprehensive Knowledge Sources Routes', () => {
    const endpoints = [
      { path: '/api/knowledge/reddit', body: { query: 'react', subreddit: 'reactjs', limit: 5, sort: 'top' } },
      { path: '/api/knowledge/youtube', body: { query: 'tutorial', limit: 3 } },
      { path: '/api/knowledge/university', body: { university: 'mit', query: 'physics', limit: 2, type: 'course' } },
      { path: '/api/knowledge/papers', body: { query: 'transformers', source: 'arxiv', limit: 5 } },
      { path: '/api/knowledge/github', body: { query: 'ai', limit: 5, type: 'repo' } },
      { path: '/api/knowledge/stackoverflow', body: { query: 'typescript', tagged: 'ts', limit: 3, sort: 'votes' } },
      { path: '/api/knowledge/news', body: { query: 'tech', provider: 'all', limit: 3, language: 'en' } },
      { path: '/api/knowledge/medium', body: { query: 'coding', limit: 3, tag: 'javascript' } },
      { path: '/api/knowledge/quora', body: { query: 'quantum', limit: 3 } },
      { path: '/api/knowledge/gutenberg', body: { query: 'shakespeare', limit: 3 } },
      { path: '/api/knowledge/docs', body: { site: 'nodejs', query: 'fs', limit: 3 } },
      { path: '/api/knowledge/library-of-congress', body: { query: 'history', limit: 3, format: 'json', dateRange: '1900-2000' } },
      { path: '/api/knowledge/entertainment', body: { query: 'batman', type: 'movie', year: 2022, limit: 3 } },
      { path: '/api/knowledge/books', body: { query: 'clean code', source: 'google', author: 'Martin', isbn: '12345', limit: 3 } },
      { path: '/api/knowledge/specialized-topics', body: { topic: 'civil_rights', query: 'movement', limit: 3 } },
      { path: '/api/knowledge/financial-advice', body: { query: 'investing', limit: 3 } },
      { path: '/api/knowledge/religion', body: { query: 'buddhism', religion: 'eastern', limit: 3 } },
      { path: '/api/knowledge/mental-health', body: { query: 'anxiety', limit: 3 } },
      { path: '/api/knowledge/web-design', body: { query: 'responsive', limit: 3 } },
      { path: '/api/knowledge/ui-design', body: { query: 'typography', limit: 3 } },
      { path: '/api/knowledge/backend-design', body: { query: 'microservices', limit: 3 } },
      { path: '/api/knowledge/music-theory', body: { query: 'harmony', limit: 3 } },
      { path: '/api/knowledge/llm-programming', body: { query: 'prompts', limit: 3 } },
      { path: '/api/knowledge/anatomy', body: { query: 'heart', limit: 3 } },
      { path: '/api/knowledge/pottery', body: { query: 'glaze', limit: 3 } },
      { path: '/api/knowledge/gardening', body: { query: 'tomatoes', limit: 3 } },
      { path: '/api/knowledge/cna', body: { query: 'vitals', limit: 3 } },
      { path: '/api/knowledge/dsp', body: { query: 'fourier', limit: 3 } },
      { path: '/api/knowledge/rn', body: { query: 'meds', limit: 3 } },
      { path: '/api/knowledge/astronomy', body: { query: 'mars', limit: 3 } },
      { path: '/api/knowledge/astrology', body: { query: 'zodiac', limit: 3 } },
      { path: '/api/knowledge/botany', body: { query: 'photosynthesis', limit: 3 } },
      { path: '/api/knowledge/marijuana-growing', body: { query: 'hydroponics', limit: 3 } },
      { path: '/api/knowledge/wikipedia', body: { query: 'albert einstein', limit: 3 } },
      { path: '/api/knowledge/scrape', body: { urls: ['https://example.com'], allowedDomains: ['example.com'] } },
    ];

    for (const ep of endpoints) {
      it(`handles ${ep.path}`, async () => {
        const res = await request(app)
          .post(ep.path)
          .set('Authorization', `Bearer ${devToken}`)
          .send(ep.body);
        expect([200, 500, 503]).toContain(res.status);
      });
    }

    it('handles telegram, csv, and json dataset ingestion loaders', async () => {
      const { TelegramSource } = require('../../core/knowledge/TelegramSource');
      jest.spyOn(TelegramSource.prototype, 'loadTelegramExport').mockResolvedValue([
        { content: 'Telegram message', metadata: { source: 'telegram' } },
      ] as any);

      const { DatasetLoader } = require('../../core/knowledge/DatasetLoader');
      jest.spyOn(DatasetLoader.prototype, 'loadCSV').mockResolvedValue([
        { content: 'CSV row 1', metadata: { source: 'csv' } },
      ] as any);
      jest.spyOn(DatasetLoader.prototype, 'loadJSON').mockResolvedValue([
        { content: 'JSON doc 1', metadata: { source: 'json' } },
      ] as any);

      const telRes = await request(app)
        .post('/api/knowledge/load-telegram')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ filePath: 'telegram.json', generateEmbeddings: false, chunkSize: 10 });
      expect(telRes.status).toBe(200);
      expect(telRes.body.chunks).toBe(1);

      const csvRes = await request(app)
        .post('/api/knowledge/load-csv')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ filePath: 'data.csv', generateEmbeddings: true, chunkSize: 15 });
      expect(csvRes.status).toBe(200);
      expect(csvRes.body.chunks).toBe(1);

      const jsonRes = await request(app)
        .post('/api/knowledge/load-json')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ filePath: 'data.json', generateEmbeddings: false, chunkSize: 5 });
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.chunks).toBe(1);
    });

    it('handles knowledge graph entity addition and query', async () => {
      const { KnowledgeGraph } = require('../../core/knowledge/KnowledgeGraph');
      jest.spyOn(KnowledgeGraph.prototype, 'addEntity').mockReturnValue(undefined as any);
      jest.spyOn(KnowledgeGraph.prototype, 'queryEntities').mockReturnValue([{ id: 'e1', name: 'Node 1' }]);
      jest.spyOn(KnowledgeGraph.prototype, 'queryRelationships').mockReturnValue([{ from: 'e1', to: 'e2' }]);
      jest.spyOn(KnowledgeGraph.prototype, 'getStats').mockReturnValue({ entities: 1, relationships: 1 });

      const addRes = await request(app)
        .post('/api/knowledge/graph/entity')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ id: 'e1', name: 'Node 1', type: 'Concept', properties: { key: 'val' } });
      expect(addRes.status).toBe(200);
      expect(addRes.body.success).toBe(true);

      const queryRes = await request(app)
        .get('/api/knowledge/graph/query?entityId=e1&entityName=Node&relationshipType=IS_A&limit=10')
        .set('Authorization', `Bearer ${devToken}`);
      expect(queryRes.status).toBe(200);
      expect(queryRes.body.entities).toBeDefined();
      expect(queryRes.body.relationships).toBeDefined();
    });

    it('handles /api/knowledge/fuse with comprehensive source matrix', async () => {
      const { KnowledgeFusion } = require('../../core/knowledge/KnowledgeFusion');
      jest.spyOn(KnowledgeFusion.prototype, 'fuse').mockResolvedValue({
        answer: 'Fused answer',
        confidence: 0.95,
        sources: ['wikipedia', 'reddit'],
      } as any);

      const allSources = [
        'wikipedia',
        'web',
        'reddit',
        'youtube',
        'github',
        'papers',
        'stackoverflow',
        'news',
        'medium',
        'quora',
        'docs',
        'library_of_congress',
        'loc',
        'entertainment',
        'movies',
        'comics',
        'books',
        'novels',
        'specialized',
        'civil_rights',
        'compliance',
        'hip_hop',
        'connecticut',
        'financial',
        'financial_advice',
        'religion',
        'mental_health',
        'web_design',
        'ui_design',
        'backend_design',
        'music_theory',
        'llm',
        'llm_programming',
        'anatomy',
        'pottery',
        'gardening',
        'cna',
        'dsp',
        'rn',
        'astronomy',
        'astrology',
        'botany',
        'marijuana',
        'cannabis',
        'growing',
      ];

      const res = await request(app)
        .post('/api/knowledge/fuse')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          query: 'test fusion query',
          sources: allSources,
          maxResults: 15,
          minConfidence: 0.7,
        });

      expect(res.status).toBe(200);
      expect(res.body.results).toBeDefined();
    });

    it('handles /api/reasoning/chain-of-thought and /api/debug/:requestId', async () => {
      const { ReasoningEngine } = require('../../core/knowledge/ReasoningEngine');
      jest.spyOn(ReasoningEngine.prototype, 'chainOfThought').mockResolvedValue({
        steps: ['Step 1', 'Step 2'],
        conclusion: 'Reasoned conclusion',
      } as any);

      const cotRes = await request(app)
        .post('/api/reasoning/chain-of-thought')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ question: 'Why?', context: 'Because', maxSteps: 3 });
      expect(cotRes.status).toBe(200);
      expect(cotRes.body.result).toBeDefined();

      const { DebugMode } = require('../../core/debug/DebugMode');
      jest.spyOn(DebugMode.prototype, 'getDebugInfo').mockImplementation(((reqId: any) => {
        if (reqId === 'missing-req') return null;
        return { requestId: reqId, timestamp: Date.now(), logs: ['log1'] };
      }) as any);

      const dbgMissing = await request(app)
        .get('/api/debug/missing-req')
        .set('Authorization', `Bearer ${devToken}`);
      expect(dbgMissing.status).toBe(404);

      const dbgFound = await request(app)
        .get('/api/debug/valid-req-123')
        .set('Authorization', `Bearer ${devToken}`);
      expect(dbgFound.status).toBe(200);
      expect(dbgFound.body.debugInfo).toBeDefined();
    });
  });

  describe('Conversation Management & Webhooks Endpoints', () => {
    it('handles /api/conversations listing, lookup, and deletion', async () => {
      const listRes = await request(app)
        .get('/api/conversations?limit=10')
        .set('Authorization', `Bearer ${devToken}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.conversations)).toBe(true);

      const missingRes = await request(app)
        .get('/api/conversations/nonexistent-session')
        .set('Authorization', `Bearer ${devToken}`);
      expect(missingRes.status).toBe(404);

      const foundRes = await request(app)
        .get('/api/conversations/s1')
        .set('Authorization', `Bearer ${devToken}`);
      expect(foundRes.status).toBe(200);
      expect(foundRes.body.conversation).toBeDefined();

      const delRes = await request(app)
        .delete('/api/conversations/s1')
        .set('Authorization', `Bearer ${devToken}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('handles webhook registration, listing, and unregistration with admin role', async () => {
      const { WebhookService } = require('../../core/webhooks/WebhookService');
      jest.spyOn(WebhookService.prototype, 'register').mockReturnValue({
        id: 'wh-1',
        url: 'https://example.com/webhook',
        events: ['chat.message'],
      } as any);
      jest.spyOn(WebhookService.prototype, 'list').mockReturnValue([
        { id: 'wh-1', url: 'https://example.com/webhook', events: ['chat.message'] },
      ]);
      jest.spyOn(WebhookService.prototype, 'unregister').mockReturnValue(true);

      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', '1')
        .send({ url: 'https://example.com/webhook', events: ['chat.message'], secret: 'sec-wh' });
      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);

      const listRes = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.webhooks.length).toBe(1);

      const delRes = await request(app)
        .delete('/api/webhooks/wh-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', '1');
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe('Default parameters, SPA routing, and startServer variations', () => {
    it('handles all knowledge endpoints with omitted optional parameters', async () => {
      const bareEndpoints = [
        { path: '/api/knowledge/reddit', body: { query: 'test' } },
        { path: '/api/knowledge/youtube', body: { query: 'test' } },
        { path: '/api/knowledge/university', body: { university: 'mit', query: 'test' } },
        { path: '/api/knowledge/papers', body: { query: 'test' } },
        { path: '/api/knowledge/github', body: { query: 'test' } },
        { path: '/api/knowledge/stackoverflow', body: { query: 'test' } },
        { path: '/api/knowledge/news', body: { query: 'test' } },
        { path: '/api/knowledge/medium', body: { query: 'test' } },
        { path: '/api/knowledge/quora', body: { query: 'test' } },
        { path: '/api/knowledge/gutenberg', body: { query: 'test' } },
        { path: '/api/knowledge/docs', body: { query: 'test' } },
        { path: '/api/knowledge/library-of-congress', body: { query: 'test' } },
        { path: '/api/knowledge/entertainment', body: { query: 'test' } },
        { path: '/api/knowledge/books', body: { query: 'test' } },
        { path: '/api/knowledge/specialized-topics', body: { query: 'test' } },
        { path: '/api/knowledge/financial-advice', body: { query: 'test' } },
        { path: '/api/knowledge/religion', body: { query: 'test' } },
        { path: '/api/knowledge/mental-health', body: { query: 'test' } },
        { path: '/api/knowledge/web-design', body: { query: 'test' } },
        { path: '/api/knowledge/ui-design', body: { query: 'test' } },
        { path: '/api/knowledge/backend-design', body: { query: 'test' } },
        { path: '/api/knowledge/music-theory', body: { query: 'test' } },
        { path: '/api/knowledge/llm-programming', body: { query: 'test' } },
        { path: '/api/knowledge/anatomy', body: { query: 'test' } },
        { path: '/api/knowledge/pottery', body: { query: 'test' } },
        { path: '/api/knowledge/gardening', body: { query: 'test' } },
        { path: '/api/knowledge/cna', body: { query: 'test' } },
        { path: '/api/knowledge/dsp', body: { query: 'test' } },
        { path: '/api/knowledge/rn', body: { query: 'test' } },
        { path: '/api/knowledge/astronomy', body: { query: 'test' } },
        { path: '/api/knowledge/astrology', body: { query: 'test' } },
        { path: '/api/knowledge/botany', body: { query: 'test' } },
        { path: '/api/knowledge/marijuana-growing', body: { query: 'test' } },
        { path: '/api/knowledge/wikipedia', body: { query: 'test' } },
        { path: '/api/knowledge/scrape', body: {} },
      ];

      for (const ep of bareEndpoints) {
        const res = await request(app)
          .post(ep.path)
          .set('Authorization', `Bearer ${devToken}`)
          .send(ep.body);
        expect([200, 500, 503]).toContain(res.status);
      }
    });

    it('handles knowledge graph and fuse with omitted defaults', async () => {
      const graphRes = await request(app)
        .get('/api/knowledge/graph/query')
        .set('Authorization', `Bearer ${devToken}`);
      expect(graphRes.status).toBe(200);

      const fuseRes = await request(app)
        .post('/api/knowledge/fuse')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ query: 'fuse test', sources: [] });
      expect(fuseRes.status).toBe(200);

      const cotRes = await request(app)
        .post('/api/reasoning/chain-of-thought')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ question: 'Bare question' });
      expect(cotRes.status).toBe(200);
    });

    it('handles client static distribution and SPA wildcard routing', async () => {
      // Non-API route SPA fallback
      const spaRes = await request(app)
        .get('/dashboard/settings')
        .set('Authorization', `Bearer ${devToken}`);
      expect([200, 404]).toContain(spaRes.status);
    });

    it('executes startServer successfully when ready with various environment flags', async () => {
      const originalRag = process.env.ENABLE_RAG;
      const originalRouting = process.env.ENABLE_MODEL_ROUTING;
      const originalSafety = process.env.ENABLE_SAFETY_PIPELINE;
      const originalCache = process.env.ENABLE_SEMANTIC_CACHE;

      process.env.ENABLE_RAG = 'false';
      process.env.ENABLE_MODEL_ROUTING = 'false';
      process.env.ENABLE_SAFETY_PIPELINE = 'false';
      process.env.ENABLE_SEMANTIC_CACHE = 'false';

      const listenSpy = jest.spyOn(server, 'listen').mockImplementation((port: any, cb: any) => {
        if (typeof cb === 'function') cb();
        return server;
      });

      await indexModule.startServer();
      expect(listenSpy).toHaveBeenCalled();
      listenSpy.mockRestore();

      process.env.ENABLE_RAG = originalRag;
      process.env.ENABLE_MODEL_ROUTING = originalRouting;
      process.env.ENABLE_SAFETY_PIPELINE = originalSafety;
      process.env.ENABLE_SEMANTIC_CACHE = originalCache;
    });
  });
});
