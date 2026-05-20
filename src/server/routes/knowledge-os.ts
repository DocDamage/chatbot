import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';

export function createKnowledgeOsRouter(services: any): Router {
  const router = Router();

  const requireService = <T>(name: string): T => {
    if (!services?.[name]) {
      throw new Error(`${name} is not initialized`);
    }
    return services[name] as T;
  };

  router.get('/api/knowledge-os/summary', asyncHandler(async (_req, res) => {
    const [entities, graph, memory, reports] = await Promise.all([
      services.entityLinkingService?.stats?.() || Promise.resolve({ total: 0, byType: {} }),
      services.knowledgeGraphIndexer?.stats?.() || Promise.resolve({ nodes: 0, edges: 0 }),
      services.privateMemoryStore?.stats?.('local') || Promise.resolve({ total: 0, approved: 0, pending: 0 }),
      services.governanceEvidenceService?.listReports?.(5) || Promise.resolve([])
    ]);
    const knowledgeBase = services.documentManager
      ? await services.documentManager.getStats()
      : {};
    res.json({
      entities,
      graph,
      memory,
      governance: {
        recentReports: reports,
        recentReportCount: reports.length
      },
      knowledgeBase
    });
  }));

  router.post('/api/knowledge-os/entities/link', asyncHandler(async (req, res) => {
    const text = sanitizeInput(String(req.body.text || ''));
    if (!text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    const entityLinkingService = requireService<any>('entityLinkingService');
    const result = req.body.persist === true
      ? await entityLinkingService.linkAndPersist(text)
      : entityLinkingService.link(text);
    res.json(result);
  }));

  router.get('/api/knowledge-os/entities/search', asyncHandler(async (req, res) => {
    const query = sanitizeInput(String(req.query.q || ''));
    if (!query.trim()) {
      return res.status(400).json({ error: 'q is required' });
    }
    const entityLinkingService = requireService<any>('entityLinkingService');
    res.json({ entities: await entityLinkingService.searchEntities(query, Math.min(Number(req.query.limit || 20), 100)) });
  }));

  router.get('/api/knowledge-os/entities/stats', asyncHandler(async (_req, res) => {
    res.json(await requireService<any>('entityLinkingService').stats());
  }));

  router.post('/api/knowledge-os/graph/build', asyncHandler(async (req, res) => {
    if (!services?.knowledgeGraphIndexer) {
      return res.status(503).json({ error: 'Knowledge graph indexer is not initialized' });
    }
    const query = req.body.query ? sanitizeInput(String(req.body.query)) : undefined;
    const graph = await services.knowledgeGraphIndexer.build({
      includeRepo: req.body.includeRepo !== false,
      includeRag: req.body.includeRag !== false,
      query,
      maxFiles: Math.min(Number(req.body.maxFiles || 250), 500),
      maxChunks: Math.min(Number(req.body.maxChunks || 500), 1000)
    });
    const persisted = req.body.persist === true
      ? await services.knowledgeGraphIndexer.persist(graph)
      : undefined;
    res.json({ ...graph, persisted });
  }));

  router.post('/api/knowledge-os/import/repositories', asyncHandler(async (req, res) => {
    const importer = requireService<any>('githubRepoKnowledgeImporter');
    if (Array.isArray(req.body.repositories) && req.body.repositories.length > 0) {
      const results = [];
      for (const repository of req.body.repositories.slice(0, 20)) {
        const owner = String(repository.owner || '').trim();
        const repo = String(repository.repo || '').trim();
        if (!owner || !repo) {
          return res.status(400).json({ error: 'repository owner and repo are required' });
        }
        results.push(await importer.importRepo({
          owner,
          repo,
          branch: repository.branch ? String(repository.branch) : undefined,
          category: repository.category ? String(repository.category) : undefined,
          notes: repository.notes ? String(repository.notes) : undefined
        }, {
          ingestToRag: req.body.ingestToRag === true
        }));
      }
      return res.json({ results });
    }

    res.json({
      results: await importer.importRecommended({
        ingestToRag: req.body.ingestToRag === true,
        limit: req.body.limit ? Math.min(Number(req.body.limit), 20) : undefined
      })
    });
  }));

  router.get('/api/knowledge-os/graph/stats', asyncHandler(async (_req, res) => {
    if (!services?.knowledgeGraphIndexer) {
      return res.status(503).json({ error: 'Knowledge graph indexer is not initialized' });
    }
    res.json(await services.knowledgeGraphIndexer.stats());
  }));

  router.get('/api/knowledge-os/graph/export', asyncHandler(async (req, res) => {
    if (!services?.knowledgeGraphIndexer) {
      return res.status(503).json({ error: 'Knowledge graph indexer is not initialized' });
    }
    const graph = await services.knowledgeGraphIndexer.build({
      includeRepo: req.query.includeRepo !== 'false',
      includeRag: req.query.includeRag !== 'false',
      query: req.query.q ? sanitizeInput(String(req.query.q)) : undefined,
      maxFiles: Math.min(Number(req.query.maxFiles || 250), 500),
      maxChunks: Math.min(Number(req.query.maxChunks || 500), 1000)
    });
    res.json({
      exportedAt: new Date().toISOString(),
      format: 'knowledge-os-graph-v1',
      graph
    });
  }));

  router.get('/api/knowledge-os/wiki/pages', asyncHandler(async (_req, res) => {
    res.json({ pages: services.localKnowledgeWiki.list() });
  }));

  router.get('/api/knowledge-os/wiki/search', asyncHandler(async (req, res) => {
    const query = sanitizeInput(String(req.query.q || ''));
    if (!query.trim()) {
      return res.status(400).json({ error: 'q is required' });
    }
    res.json({ pages: services.localKnowledgeWiki.search(query) });
  }));

  router.get('/api/knowledge-os/wiki/pages/:slug(*)', asyncHandler(async (req, res) => {
    res.json({ page: services.localKnowledgeWiki.read(req.params.slug) });
  }));

  router.post('/api/knowledge-os/wiki/pages', asyncHandler(async (req, res) => {
    const slug = sanitizeInput(String(req.body.slug || ''));
    const title = sanitizeInput(String(req.body.title || ''));
    const content = String(req.body.content || '');
    if (!slug.trim() || !title.trim() || !content.trim()) {
      return res.status(400).json({ error: 'slug, title, and content are required' });
    }
    const page = services.localKnowledgeWiki.write({
      slug,
      title,
      content,
      frontmatter: req.body.frontmatter && typeof req.body.frontmatter === 'object' ? req.body.frontmatter : {}
    });
    res.json({ page });
  }));

  router.post('/api/knowledge-os/wiki/ingest', asyncHandler(async (req, res) => {
    if (!services?.documentManager) {
      return res.status(503).json({ error: 'Document manager is not initialized' });
    }

    const slug = req.body.slug ? sanitizeInput(String(req.body.slug)) : undefined;
    const pages = slug
      ? [services.localKnowledgeWiki.read(slug)]
      : services.localKnowledgeWiki.list();

    let chunks = 0;
    for (const page of pages) {
      const added = await services.documentManager.addText(page.content, {
        source: `wiki:${page.slug}`,
        title: page.title,
        domain: page.frontmatter.domain || 'wiki',
        authority: page.frontmatter.authority || 'canonical',
        visibility: page.frontmatter.visibility || 'public',
        sourceType: 'local_wiki'
      }, {
        generateEmbeddings: req.body.generateEmbeddings !== false
      });
      chunks += added.length;
    }

    res.json({ pages: pages.length, chunks });
  }));

  router.post('/api/knowledge-os/memory/remember', asyncHandler(async (req, res) => {
    const content = sanitizeInput(String(req.body.content || ''));
    if (!content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }
    const memory = await services.privateMemoryStore.remember({
      userId: sanitizeInput(String(req.body.userId || 'local')),
      content,
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : [],
      confidence: Number(req.body.confidence ?? 0.72),
      importance: Number(req.body.importance ?? 0.5),
      visibility: req.body.visibility === 'shared' ? 'shared' : 'private',
      requiresApproval: req.body.requiresApproval === true,
      expiresAt: req.body.expiresAt ? String(req.body.expiresAt) : undefined
    });
    res.json({ memory });
  }));

  router.get('/api/knowledge-os/memory/recall', asyncHandler(async (req, res) => {
    const query = sanitizeInput(String(req.query.q || ''));
    const memories = await services.privateMemoryStore.recall(query, {
      userId: sanitizeInput(String(req.query.userId || 'local')),
      includePending: req.query.includePending === 'true',
      limit: Math.min(Number(req.query.limit || 10), 100)
    });
    res.json({ memories });
  }));

  router.post('/api/knowledge-os/memory/:id/approval', asyncHandler(async (req, res) => {
    const status = req.body.status === 'rejected' ? 'rejected' : 'approved';
    await services.privateMemoryStore.approve(req.params.id, status);
    const memory = await services.privateMemoryStore.get(req.params.id);
    res.json({ memory });
  }));

  router.get('/api/knowledge-os/memory/stats', asyncHandler(async (req, res) => {
    res.json(await services.privateMemoryStore.stats(sanitizeInput(String(req.query.userId || 'local'))));
  }));

  router.post('/api/knowledge-os/db/ask', asyncHandler(async (req, res) => {
    const question = sanitizeInput(String(req.body.question || ''));
    if (!question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }
    res.json(await services.safeDatabaseQuestionAgent.ask(question));
  }));

  router.post('/api/knowledge-os/db/query', asyncHandler(async (req, res) => {
    const sql = String(req.body.sql || '');
    if (!sql.trim()) {
      return res.status(400).json({ error: 'sql is required' });
    }
    res.json(await services.safeDatabaseQuestionAgent.queryReadOnly(sql, Array.isArray(req.body.params) ? req.body.params : []));
  }));

  router.get('/api/knowledge-os/db/schema', asyncHandler(async (_req, res) => {
    res.json(services.safeDatabaseQuestionAgent.schemaSummary());
  }));

  router.post('/api/knowledge-os/governance/evidence', asyncHandler(async (req, res) => {
    const request = sanitizeInput(String(req.body.request || ''));
    const answer = String(req.body.answer || '');
    if (!request.trim() || !answer.trim()) {
      return res.status(400).json({ error: 'request and answer are required' });
    }
    const report = await services.governanceEvidenceService.createReport({
      request,
      answer,
      sources: Array.isArray(req.body.sources) ? req.body.sources.map(String) : []
    });
    res.json({ report });
  }));

  router.get('/api/knowledge-os/governance/evidence', asyncHandler(async (req, res) => {
    res.json({ reports: await services.governanceEvidenceService.listReports(Number(req.query.limit || 20)) });
  }));

  router.post('/api/knowledge-os/governance/golden-tasks', asyncHandler(async (req, res) => {
    const tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [];
    const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    res.json(await services.governanceEvidenceService.runGoldenTasks(tasks, answers));
  }));

  return router;
}
