import express from 'express';
import request from 'supertest';
import { createKnowledgeOsRouter } from '../knowledge-os';

describe('knowledge OS routes', () => {
  it('links entities through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      entityLinkingService: {
        link: jest.fn().mockReturnValue({ entities: [{ normalized: 'fl_studio' }], facets: { software: ['fl_studio'] } })
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/entities/link')
      .send({ text: 'Use FL Studio' });

    expect(response.status).toBe(200);
    expect(response.body.facets.software).toContain('fl_studio');
  });

  it('persists linked entities when requested', async () => {
    const linkAndPersist = jest.fn().mockResolvedValue({ entities: [{ normalized: 'knowledge_graph' }], facets: { concepts: ['knowledge_graph'] } });
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      entityLinkingService: {
        linkAndPersist,
        link: jest.fn()
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/entities/link')
      .send({ text: 'knowledge graph', persist: true });

    expect(response.status).toBe(200);
    expect(linkAndPersist).toHaveBeenCalledWith('knowledge graph');
  });

  it('caps entity search limits', async () => {
    const searchEntities = jest.fn().mockResolvedValue([]);
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      entityLinkingService: {
        searchEntities
      }
    }));

    const response = await request(app).get('/api/knowledge-os/entities/search?q=FL&limit=9999');

    expect(response.status).toBe(200);
    expect(searchEntities).toHaveBeenCalledWith('FL', 100);
  });

  it('runs safe database questions through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      safeDatabaseQuestionAgent: {
        ask: jest.fn().mockResolvedValue({ answer: 'chunks: 4', rows: [{ label: 'chunks', count: 4 }], warnings: [] })
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/db/ask')
      .send({ question: 'How many chunks?' });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe('chunks: 4');
  });

  it('writes wiki pages through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      localKnowledgeWiki: {
        write: jest.fn().mockReturnValue({ slug: 'test/page', title: 'Test Page', content: 'Body' })
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/wiki/pages')
      .send({ slug: 'test/page', title: 'Test Page', content: 'Body' });

    expect(response.status).toBe(200);
    expect(response.body.page.slug).toBe('test/page');
  });

  it('ingests wiki pages into the document manager', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      localKnowledgeWiki: {
        read: jest.fn().mockReturnValue({
          slug: 'test/page',
          title: 'Test Page',
          content: 'Knowledge content',
          frontmatter: { authority: 'canonical' }
        })
      },
      documentManager: {
        addText: jest.fn().mockResolvedValue([{ id: 'chunk-1' }])
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/wiki/ingest')
      .send({ slug: 'test/page', generateEmbeddings: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ pages: 1, chunks: 1 });
  });

  it('exposes the safe database schema summary', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      safeDatabaseQuestionAgent: {
        schemaSummary: jest.fn().mockReturnValue({ tables: [{ name: 'document_chunks' }] })
      }
    }));

    const response = await request(app).get('/api/knowledge-os/db/schema');

    expect(response.status).toBe(200);
    expect(response.body.tables[0].name).toBe('document_chunks');
  });

  it('stores private memories through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      privateMemoryStore: {
        remember: jest.fn().mockResolvedValue({ id: 'memory-1', status: 'approved' })
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/memory/remember')
      .send({ content: 'Remember this', tags: ['test'] });

    expect(response.status).toBe(200);
    expect(response.body.memory.id).toBe('memory-1');
  });

  it('creates governance evidence reports through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      governanceEvidenceService: {
        createReport: jest.fn().mockResolvedValue({ id: 'report-1', score: 1 })
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/governance/evidence')
      .send({ request: 'Question', answer: 'Answer', sources: ['source.md'] });

    expect(response.status).toBe(200);
    expect(response.body.report.id).toBe('report-1');
  });

  it('returns a summary for dashboards', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      entityLinkingService: { stats: jest.fn().mockResolvedValue({ total: 3, byType: { software: 1 } }) },
      knowledgeGraphIndexer: { stats: jest.fn().mockResolvedValue({ nodes: 4, edges: 2 }) },
      privateMemoryStore: { stats: jest.fn().mockResolvedValue({ total: 2, approved: 1, pending: 1 }) },
      governanceEvidenceService: { listReports: jest.fn().mockResolvedValue([{ id: 'report-1' }]) },
      documentManager: { getStats: jest.fn().mockResolvedValue({ persistentStore: true }) }
    }));

    const response = await request(app).get('/api/knowledge-os/summary');

    expect(response.status).toBe(200);
    expect(response.body.entities.total).toBe(3);
    expect(response.body.graph.nodes).toBe(4);
    expect(response.body.governance.recentReportCount).toBe(1);
  });

  it('approves pending memories through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      privateMemoryStore: {
        approve: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({ id: 'memory-1', status: 'approved' })
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/memory/memory-1/approval')
      .send({ status: 'approved' });

    expect(response.status).toBe(200);
    expect(response.body.memory.status).toBe('approved');
  });

  it('exports graph JSON through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      knowledgeGraphIndexer: {
        build: jest.fn().mockResolvedValue({
          nodes: [],
          edges: [],
          centrality: [],
          stats: { nodes: 0, edges: 0, files: 0, chunks: 0, entities: 0 }
        })
      }
    }));

    const response = await request(app).get('/api/knowledge-os/graph/export');

    expect(response.status).toBe(200);
    expect(response.body.format).toBe('knowledge-os-graph-v1');
  });

  it('imports recommended repositories through the route', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({
      githubRepoKnowledgeImporter: {
        importRecommended: jest.fn().mockResolvedValue([{ repo: 'safishamsi/graphify' }])
      }
    }));

    const response = await request(app)
      .post('/api/knowledge-os/import/repositories')
      .send({ limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body.results[0].repo).toBe('safishamsi/graphify');
  });

  it('returns an error when required services are missing', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter({}));

    const response = await request(app)
      .post('/api/knowledge-os/entities/link')
      .send({ text: 'FL Studio' });

    expect(response.status).toBe(500);
  });

  it('covers graph, wiki, memory, database, import, and governance branches', async () => {
    const services = {
      entityLinkingService: {
        searchEntities: jest.fn().mockResolvedValue([{ id: 'e1' }]),
        stats: jest.fn().mockResolvedValue({ total: 1 }),
        link: jest.fn().mockReturnValue({ linked: true }),
      },
      knowledgeGraphIndexer: {
        build: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        persist: jest.fn().mockResolvedValue({ persisted: true }),
        stats: jest.fn().mockResolvedValue({ nodes: 1, edges: 0 }),
      },
      githubRepoKnowledgeImporter: {
        importRepo: jest.fn().mockResolvedValue({ repo: 'owner/repo' }),
        importRecommended: jest.fn().mockResolvedValue([{ repo: 'recommended/repo' }]),
      },
      localKnowledgeWiki: {
        list: jest.fn().mockReturnValue([{ slug: 'one', title: 'One', content: 'one', frontmatter: {} }]),
        search: jest.fn().mockReturnValue([{ slug: 'one' }]),
        read: jest.fn().mockReturnValue({ slug: 'one', title: 'One', content: 'one', frontmatter: {} }),
        write: jest.fn().mockReturnValue({ slug: 'new', title: 'New', content: 'new' }),
      },
      documentManager: {
        addText: jest.fn().mockResolvedValue([{ id: 'chunk' }]),
      },
      privateMemoryStore: {
        recall: jest.fn().mockResolvedValue([{ id: 'memory' }]),
        stats: jest.fn().mockResolvedValue({ total: 1 }),
        approve: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({ id: 'memory', status: 'rejected' }),
        remember: jest.fn().mockResolvedValue({ id: 'memory' }),
      },
      safeDatabaseQuestionAgent: {
        queryReadOnly: jest.fn().mockResolvedValue({ rows: [] }),
        schemaSummary: jest.fn().mockReturnValue({ tables: [] }),
      },
      governanceEvidenceService: {
        createReport: jest.fn().mockResolvedValue({ id: 'report' }),
        listReports: jest.fn().mockResolvedValue([{ id: 'report' }]),
        runGoldenTasks: jest.fn().mockResolvedValue({ passed: 1 }),
      },
    };
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeOsRouter(services));

    await request(app).get('/api/knowledge-os/entities/search').expect(400);
    await request(app).get('/api/knowledge-os/entities/stats').expect(200);
    await request(app).post('/api/knowledge-os/graph/build').send({ persist: true, maxFiles: 999, maxChunks: 9999 }).expect(200);
    await request(app).get('/api/knowledge-os/graph/stats').expect(200);
    await request(app).post('/api/knowledge-os/import/repositories').send({ repositories: [{ owner: '', repo: '' }] }).expect(400);
    await request(app).post('/api/knowledge-os/import/repositories').send({ repositories: [{ owner: 'owner', repo: 'repo', branch: 'main' }] }).expect(200);
    await request(app).get('/api/knowledge-os/wiki/pages').expect(200);
    await request(app).get('/api/knowledge-os/wiki/search').expect(400);
    await request(app).get('/api/knowledge-os/wiki/search?q=one').expect(200);
    await request(app).get('/api/knowledge-os/wiki/pages/one').expect(200);
    await request(app).post('/api/knowledge-os/wiki/ingest').send({}).expect(200);
    await request(app).get('/api/knowledge-os/memory/recall?q=one&includePending=true&limit=200').expect(200);
    await request(app).get('/api/knowledge-os/memory/stats?userId=user').expect(200);
    await request(app).post('/api/knowledge-os/memory/memory/approval').send({ status: 'rejected' }).expect(200);
    await request(app).post('/api/knowledge-os/db/query').send({ sql: 'SELECT 1', params: ['x'] }).expect(200);
    await request(app).get('/api/knowledge-os/db/schema').expect(200);
    await request(app).get('/api/knowledge-os/governance/evidence?limit=2').expect(200);
    await request(app).post('/api/knowledge-os/governance/golden-tasks').send({ tasks: [{ id: 't' }], answers: { t: 'ok' } }).expect(200);

    // Missing service branches
    const bareApp = express();
    bareApp.use(express.json());
    bareApp.use(createKnowledgeOsRouter({}));

    await request(bareApp).post('/api/knowledge-os/entities/link').send({ text: '' }).expect(400);
    await request(bareApp).post('/api/knowledge-os/graph/build').send({}).expect(503);
    await request(bareApp).get('/api/knowledge-os/graph/stats').expect(503);
    await request(bareApp).get('/api/knowledge-os/graph/export').expect(503);
    await request(bareApp).post('/api/knowledge-os/db/query').send({ sql: '' }).expect(400);
    await request(bareApp).post('/api/knowledge-os/memory/remember').send({ content: '' }).expect(400);
    await request(bareApp).post('/api/knowledge-os/governance/evidence').send({ title: '' }).expect(400);
  });
});
