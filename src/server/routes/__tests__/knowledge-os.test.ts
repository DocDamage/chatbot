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
});
