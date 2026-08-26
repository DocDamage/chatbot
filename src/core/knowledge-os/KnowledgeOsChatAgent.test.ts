import { KnowledgeOsChatAgent } from './KnowledgeOsChatAgent';

describe('KnowledgeOsChatAgent', () => {
  it('answers safe database count questions', async () => {
    const agent = new KnowledgeOsChatAgent({
      safeDatabaseQuestionAgent: {
        ask: jest.fn().mockResolvedValue({ answer: 'chunks: 12', rows: [], warnings: [] }),
        schemaSummary: jest.fn()
      }
    });

    const result = await agent.ask('How many chunks are in the database?');

    expect(result.response).toContain('chunks: 12');
    expect(result.mode).toBe('knowledge_os');
  });

  it('summarizes graph centrality', async () => {
    const build = jest.fn().mockResolvedValue({
      stats: { nodes: 2, edges: 1 },
      centrality: [{ label: 'DocumentManager', type: 'symbol', degree: 4 }]
    });
    const agent = new KnowledgeOsChatAgent({
      knowledgeGraphIndexer: {
        stats: jest.fn(),
        build
      }
    });

    const result = await agent.ask('Show graph centrality');

    expect(result.response).toContain('DocumentManager');
    expect(result.response).toContain('2 nodes');
    expect(build).toHaveBeenCalledWith(expect.objectContaining({
      maxFiles: 80,
      maxChunks: 80
    }));
  });

  it('covers schema tables, entities, wiki, memory, and status fallback branches', async () => {
    // 1. Schema query
    const schemaAgent = new KnowledgeOsChatAgent({
      safeDatabaseQuestionAgent: {
        ask: jest.fn(),
        schemaSummary: jest.fn().mockReturnValue({ tables: [{ name: 'users', purpose: 'store users' }] })
      }
    });
    const schemaRes = await schemaAgent.ask('Show me the schema and tables');
    expect(schemaRes.response).toContain('Safe database schema:');
    expect(schemaRes.response).toContain('- users: store users');

    // 2. Entity linking (found vs empty)
    const entityAgent = new KnowledgeOsChatAgent({
      entityLinkingService: {
        link: jest.fn().mockReturnValue({
          entities: [{ label: 'React', normalized: 'react', type: 'framework', confidence: 0.95 }],
          facets: {}
        }),
        searchEntities: jest.fn().mockResolvedValue([]),
        stats: jest.fn().mockResolvedValue({ total: 1, byType: { framework: 1 } })
      }
    });
    const entityRes = await entityAgent.ask('Link entity React');
    expect(entityRes.response).toContain('Entities I found:');
    expect(entityRes.response).toContain('React -> react');

    const emptyEntityAgent = new KnowledgeOsChatAgent({
      entityLinkingService: {
        link: jest.fn().mockReturnValue({ entities: [], facets: {} }),
        searchEntities: jest.fn().mockResolvedValue([]),
        stats: jest.fn().mockResolvedValue({ total: 0, byType: {} })
      }
    });
    const emptyEntityRes = await emptyEntityAgent.ask('Link entity none');
    expect(emptyEntityRes.response).toContain('did not find any strong entities');

    // 3. Graph without centrality
    const emptyGraphAgent = new KnowledgeOsChatAgent({
      knowledgeGraphIndexer: {
        stats: jest.fn(),
        build: jest.fn().mockResolvedValue({ stats: { nodes: 0, edges: 0 }, centrality: [] })
      }
    });
    const emptyGraphRes = await emptyGraphAgent.ask('Show connections graph');
    expect(emptyGraphRes.response).toContain('No central nodes found yet');

    // 4. Wiki (search hit vs list fallback vs empty)
    const wikiAgent = new KnowledgeOsChatAgent({
      localKnowledgeWiki: {
        search: jest.fn().mockReturnValue([{ slug: 'guide', title: 'Guide', content: 'content' }]),
        list: jest.fn().mockReturnValue([])
      }
    });
    const wikiRes = await wikiAgent.ask('Show wiki notes');
    expect(wikiRes.response).toContain('Local wiki pages:');
    expect(wikiRes.sources).toContain('wiki:guide');

    const emptyWikiAgent = new KnowledgeOsChatAgent({
      localKnowledgeWiki: {
        search: jest.fn().mockReturnValue([]),
        list: jest.fn().mockReturnValue([])
      }
    });
    const emptyWikiRes = await emptyWikiAgent.ask('Show wiki page');
    expect(emptyWikiRes.response).toContain('No local wiki pages exist yet');

    // 5. Memory (recalled vs empty)
    const memoryAgent = new KnowledgeOsChatAgent({
      privateMemoryStore: {
        stats: jest.fn().mockResolvedValue({ total: 2, approved: 1, pending: 1 }),
        recall: jest.fn().mockResolvedValue([
          { content: 'User prefers TypeScript', tags: ['pref'], confidence: 0.9, importance: 1, status: 'approved' }
        ])
      }
    });
    const memRes = await memoryAgent.ask('Remember preference');
    expect(memRes.response).toContain('Private memory: 1 approved, 1 pending.');
    expect(memRes.response).toContain('User prefers TypeScript');

    const emptyMemAgent = new KnowledgeOsChatAgent({
      privateMemoryStore: {
        stats: jest.fn().mockResolvedValue({ total: 0, approved: 0, pending: 0 }),
        recall: jest.fn().mockResolvedValue([])
      }
    });
    const emptyMemRes = await emptyMemAgent.ask('Recall private memory');
    expect(emptyMemRes.response).toContain('No relevant memories matched that query.');

    // 6. Overall status fallback
    const statusAgent = new KnowledgeOsChatAgent({
      documentManager: {
        getStats: jest.fn().mockResolvedValue({
          persistentStore: true,
          persistence: { sources: 10, chunks: 50, embeddings: 50 }
        })
      }
    });
    const statusRes = await statusAgent.ask('Hello status');
    expect(statusRes.response).toContain('Knowledge OS status:');
    expect(statusRes.response).toContain('- RAG persistence: on');
    expect(statusRes.response).toContain('- Sources: 10');
  });
});
