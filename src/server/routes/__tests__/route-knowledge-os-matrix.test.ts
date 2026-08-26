import express from 'express';
import request from 'supertest';
import { createKnowledgeOsRouter } from '../knowledge-os';

describe('HTTP route decision matrices - Knowledge OS Router', () => {
  it('GET /api/knowledge-os/summary handles all services present and missing', async () => {
    const mockServices = {
      entityLinkingService: { stats: jest.fn().mockResolvedValue({ total: 10, byType: { concept: 10 } }) },
      knowledgeGraphIndexer: { stats: jest.fn().mockResolvedValue({ nodes: 20, edges: 30 }) },
      privateMemoryStore: { stats: jest.fn().mockResolvedValue({ total: 5, approved: 4, pending: 1 }) },
      governanceEvidenceService: { listReports: jest.fn().mockResolvedValue([{ id: 'rep-1' }]) },
      documentManager: { getStats: jest.fn().mockResolvedValue({ total: 100 }) },
    };

    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter(mockServices));

    const fullRes = await request(app).get('/api/knowledge-os/summary').expect(200);
    expect(fullRes.body.entities.total).toBe(10);
    expect(fullRes.body.graph.nodes).toBe(20);
    expect(fullRes.body.memory.total).toBe(5);
    expect(fullRes.body.governance.recentReportCount).toBe(1);

    const emptyApp = express();
    emptyApp.use(express.json());
    emptyApp.use(createKnowledgeOsRouter({}));

    const emptyRes = await request(emptyApp).get('/api/knowledge-os/summary').expect(200);
    expect(emptyRes.body.entities.total).toBe(0);
    expect(emptyRes.body.graph.nodes).toBe(0);
    expect(emptyRes.body.memory.total).toBe(0);
    expect(emptyRes.body.governance.recentReportCount).toBe(0);
  });

  it('handles entities endpoints (link, search, stats) and error validations', async () => {
    const mockEntityService = {
      link: jest.fn().mockReturnValue({ entities: [{ id: 'e1' }] }),
      linkAndPersist: jest.fn().mockResolvedValue({ entities: [{ id: 'e1', persisted: true }] }),
      searchEntities: jest.fn().mockResolvedValue([{ id: 'e1' }]),
      stats: jest.fn().mockResolvedValue({ total: 1 }),
    };

    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({ entityLinkingService: mockEntityService }));

    // Link validations
    await request(app).post('/api/knowledge-os/entities/link').send({ text: '' }).expect(400);

    // Link without persist
    await request(app).post('/api/knowledge-os/entities/link').send({ text: 'quantum computing' }).expect(200);
    expect(mockEntityService.link).toHaveBeenCalledWith('quantum computing');

    // Link with persist
    await request(app).post('/api/knowledge-os/entities/link').send({ text: 'quantum computing', persist: true }).expect(200);
    expect(mockEntityService.linkAndPersist).toHaveBeenCalledWith('quantum computing');

    // Search validations
    await request(app).get('/api/knowledge-os/entities/search?q=%20%20').expect(400);
    await request(app).get('/api/knowledge-os/entities/search?q=quantum&limit=200').expect(200);
    expect(mockEntityService.searchEntities).toHaveBeenCalledWith('quantum', 100);

    // Stats
    await request(app).get('/api/knowledge-os/entities/stats').expect(200);
    expect(mockEntityService.stats).toHaveBeenCalled();
  });

  it('handles graph/build and import/repositories endpoints', async () => {
    const mockGraphIndexer = {
      build: jest.fn().mockResolvedValue({ nodes: [{ id: 'n1' }], edges: [] }),
      persist: jest.fn().mockResolvedValue({ saved: true }),
    };
    const mockImporter = {
      importRepo: jest.fn().mockResolvedValue({ success: true, repo: 'test/repo' }),
    };

    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      knowledgeGraphIndexer: mockGraphIndexer,
      githubRepoKnowledgeImporter: mockImporter,
    }));

    // Build with options & persist
    const buildRes = await request(app)
      .post('/api/knowledge-os/graph/build')
      .send({
        includeRepo: false,
        includeRag: false,
        query: 'test graph',
        maxFiles: 600,
        maxChunks: 2000,
        persist: true
      })
      .expect(200);
    expect(buildRes.body).toHaveProperty('persisted');
    expect(mockGraphIndexer.build).toHaveBeenCalledWith(expect.objectContaining({
      includeRepo: false,
      includeRag: false,
      query: 'test graph',
      maxFiles: 500,
      maxChunks: 1000
    }));

    // Graph build without indexer
    const uninitApp = express();
    uninitApp.use(express.json());
    uninitApp.use(createKnowledgeOsRouter({}));
    await request(uninitApp).post('/api/knowledge-os/graph/build').send({}).expect(503);

    // Import repositories validation
    await request(app)
      .post('/api/knowledge-os/import/repositories')
      .send({ repositories: [{ owner: '', repo: 'repo' }] })
      .expect(400);

    // Import valid repository
    const impRes = await request(app)
      .post('/api/knowledge-os/import/repositories')
      .send({
        repositories: [{ owner: 'owner1', repo: 'repo1', branch: 'main', category: 'code', notes: 'test note' }],
        ingestToRag: true
      })
      .expect(200);
    expect(impRes.body.results.length).toBe(1);
    expect(mockImporter.importRepo).toHaveBeenCalled();
  });

  it('handles wiki endpoints (pages, ingest)', async () => {
    const mockWiki = {
      write: jest.fn().mockReturnValue({ slug: 'test-page', title: 'Test Page', content: 'Page content' }),
      read: jest.fn().mockReturnValue({ slug: 'test-page', title: 'Test Page', content: 'Page content', frontmatter: { domain: 'code', authority: 'high', visibility: 'public' } }),
      list: jest.fn().mockReturnValue([
        { slug: 'p1', title: 'P1', content: 'Content 1', frontmatter: {} }
      ]),
    };
    const mockDocManager = {
      addText: jest.fn().mockResolvedValue([{ id: 'c1' }]),
    };

    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      localKnowledgeWiki: mockWiki,
      documentManager: mockDocManager,
    }));

    // Write page validation
    await request(app).post('/api/knowledge-os/wiki/pages').send({ slug: '', title: '', content: '' }).expect(400);

    // Write page success
    const writeRes = await request(app)
      .post('/api/knowledge-os/wiki/pages')
      .send({ slug: 'test-page', title: 'Test Page', content: 'Page content', frontmatter: { tag: 'unit' } })
      .expect(200);
    expect(writeRes.body).toHaveProperty('page');

    // Ingest specific page
    const ingestSingle = await request(app)
      .post('/api/knowledge-os/wiki/ingest')
      .send({ slug: 'test-page', generateEmbeddings: false })
      .expect(200);
    expect(ingestSingle.body.pages).toBe(1);

    // Ingest all pages
    const ingestAll = await request(app)
      .post('/api/knowledge-os/wiki/ingest')
      .send({})
      .expect(200);
    expect(ingestAll.body.pages).toBe(1);

    // Ingest without documentManager
    const uninitApp = express();
    uninitApp.use(express.json());
    uninitApp.use(createKnowledgeOsRouter({ localKnowledgeWiki: mockWiki }));
    await request(uninitApp).post('/api/knowledge-os/wiki/ingest').send({}).expect(503);
  });

  it('handles private memory, database, and governance endpoints', async () => {
    const mockMemory = {
      remember: jest.fn().mockResolvedValue({ id: 'mem-1', content: 'Memory text' }),
      recall: jest.fn().mockResolvedValue([{ id: 'mem-1' }]),
      approve: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue({ id: 'mem-1', status: 'approved' }),
      stats: jest.fn().mockResolvedValue({ total: 1 }),
    };
    const mockDbAgent = {
      ask: jest.fn().mockResolvedValue({ answer: 'DB answer' }),
      queryReadOnly: jest.fn().mockResolvedValue({ rows: [{ count: 42 }] }),
      schemaSummary: jest.fn().mockReturnValue({ tables: ['users', 'items'] }),
    };
    const mockGov = {
      createReport: jest.fn().mockResolvedValue({ id: 'rep-1' }),
      listReports: jest.fn().mockResolvedValue([{ id: 'rep-1' }]),
      runGoldenTasks: jest.fn().mockResolvedValue({ passed: 5, failed: 0 }),
    };

    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      privateMemoryStore: mockMemory,
      safeDatabaseQuestionAgent: mockDbAgent,
      governanceEvidenceService: mockGov,
    }));

    // Memory remember validation & success
    await request(app).post('/api/knowledge-os/memory/remember').send({ content: '' }).expect(400);
    await request(app)
      .post('/api/knowledge-os/memory/remember')
      .send({
        content: 'Remember this fact',
        tags: ['important'],
        confidence: 0.9,
        importance: 0.8,
        visibility: 'shared',
        requiresApproval: true,
        expiresAt: '2027-01-01'
      })
      .expect(200);
    expect(mockMemory.remember).toHaveBeenCalled();

    // Memory recall
    await request(app).get('/api/knowledge-os/memory/recall?q=fact&userId=user1&includePending=true&limit=50').expect(200);
    expect(mockMemory.recall).toHaveBeenCalledWith('fact', expect.objectContaining({ userId: 'user1', includePending: true, limit: 50 }));

    // Memory approval (approved vs rejected)
    await request(app).post('/api/knowledge-os/memory/mem-1/approval').send({ status: 'approved' }).expect(200);
    await request(app).post('/api/knowledge-os/memory/mem-1/approval').send({ status: 'rejected' }).expect(200);

    // Memory stats
    await request(app).get('/api/knowledge-os/memory/stats?userId=user1').expect(200);

    // DB ask validation & success
    await request(app).post('/api/knowledge-os/db/ask').send({ question: '' }).expect(400);
    await request(app).post('/api/knowledge-os/db/ask').send({ question: 'How many rows?' }).expect(200);

    // DB query validation & success
    await request(app).post('/api/knowledge-os/db/query').send({ sql: '' }).expect(400);
    await request(app).post('/api/knowledge-os/db/query').send({ sql: 'SELECT 1', params: [1] }).expect(200);

    // DB schema
    await request(app).get('/api/knowledge-os/db/schema').expect(200);

    // Governance evidence validation & success
    await request(app).post('/api/knowledge-os/governance/evidence').send({ request: '', answer: '' }).expect(400);
    await request(app).post('/api/knowledge-os/governance/evidence').send({ request: 'req', answer: 'ans', sources: ['s1'] }).expect(200);
    await request(app).get('/api/knowledge-os/governance/evidence?limit=10').expect(200);

    // Governance golden tasks
    await request(app).post('/api/knowledge-os/governance/golden-tasks').send({ tasks: ['t1'], answers: { t1: 'a1' } }).expect(200);
  });
});
