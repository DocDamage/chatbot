export interface KnowledgeOsChatServices {
  safeDatabaseQuestionAgent?: {
    ask(question: string): Promise<{ answer: string; rows: any[]; warnings: string[] }>;
    schemaSummary(): { tables: Array<{ name: string; purpose: string }> };
  };
  entityLinkingService?: {
    link(text: string): { entities: Array<{ label: string; normalized: string; type: string; confidence: number }>; facets: Record<string, any> };
    searchEntities(query: string, limit?: number): Promise<Array<{ label: string; normalized: string; type: string; confidence: number }>>;
    stats(): Promise<{ total: number; byType: Record<string, number> }>;
  };
  knowledgeGraphIndexer?: {
    stats(): Promise<{ nodes: number; edges: number }>;
    build(options?: { includeRepo?: boolean; includeRag?: boolean; query?: string; maxFiles?: number; maxChunks?: number }): Promise<{
      centrality: Array<{ label: string; type: string; degree: number }>;
      stats: Record<string, number>;
    }>;
  };
  localKnowledgeWiki?: {
    search(query: string): Array<{ slug: string; title: string; content: string }>;
    list(): Array<{ slug: string; title: string }>;
  };
  privateMemoryStore?: {
    recall(query: string, options?: { userId?: string; limit?: number; includePending?: boolean }): Promise<Array<{ content: string; tags: string[]; confidence: number; importance: number; status: string }>>;
    stats(userId?: string): Promise<{ total: number; approved: number; pending: number }>;
  };
  documentManager?: {
    getStats(): Promise<any>;
  };
}

export class KnowledgeOsChatAgent {
  constructor(private readonly services: KnowledgeOsChatServices) {}

  async ask(message: string): Promise<{ response: string; sources: string[]; mode: string; model: string; data?: any }> {
    const text = message.toLowerCase();

    if (/\b(schema|tables|safe sql|read-only sql)\b/.test(text) && this.services.safeDatabaseQuestionAgent) {
      const schema = this.services.safeDatabaseQuestionAgent.schemaSummary();
      return this.wrap([
        'Safe database schema:',
        ...schema.tables.map(table => `- ${table.name}: ${table.purpose}`)
      ].join('\n'), [], { schema });
    }

    if (/\b(how many|count|total|database|chunks|sources|embeddings)\b/.test(text) && this.services.safeDatabaseQuestionAgent) {
      const result = await this.services.safeDatabaseQuestionAgent.ask(message);
      return this.wrap(result.answer, [], result);
    }

    if (/\b(entity|entities|alias|aliases|normalize|link)\b/.test(text) && this.services.entityLinkingService) {
      const linked = this.services.entityLinkingService.link(message);
      const persisted = await this.services.entityLinkingService.searchEntities(message, 8);
      const rows = [...linked.entities, ...persisted].slice(0, 10);
      return this.wrap(rows.length
        ? ['Entities I found:', ...rows.map(entity => `- ${entity.label} -> ${entity.normalized} (${entity.type}, ${entity.confidence.toFixed(2)})`)].join('\n')
        : 'I did not find any strong entities in that message yet.',
        [],
        { linked, persisted }
      );
    }

    if (/\b(graph|centrality|relationship|relationships|connected|connections)\b/.test(text) && this.services.knowledgeGraphIndexer) {
      const graph = await this.services.knowledgeGraphIndexer.build({
        includeRepo: true,
        includeRag: true,
        query: message,
        maxFiles: 80,
        maxChunks: 80
      });
      return this.wrap([
        `Knowledge graph snapshot: ${graph.stats.nodes || 0} nodes, ${graph.stats.edges || 0} edges.`,
        ...(graph.centrality.length
          ? ['Most connected nodes:', ...graph.centrality.slice(0, 8).map(node => `- ${this.truncate(node.label, 80)} (${node.type}) degree ${node.degree}`)]
          : ['No central nodes found yet. Build and persist the graph after ingesting knowledge.'])
      ].join('\n'), [], graph);
    }

    if (/\b(wiki|page|pages|notes|local docs)\b/.test(text) && this.services.localKnowledgeWiki) {
      const pages = this.services.localKnowledgeWiki.search(message).slice(0, 5);
      const allPages = pages.length ? pages : this.services.localKnowledgeWiki.list().slice(0, 5);
      return this.wrap(allPages.length
        ? ['Local wiki pages:', ...allPages.map(page => `- ${page.title} (${page.slug})`)].join('\n')
        : 'No local wiki pages exist yet. Create one from the Knowledge OS panel or POST to /api/knowledge-os/wiki/pages.',
        allPages.map(page => `wiki:${page.slug}`),
        { pages: allPages }
      );
    }

    if (/\b(memory|remember|recall|preference|private)\b/.test(text) && this.services.privateMemoryStore) {
      const stats = await this.services.privateMemoryStore.stats('local');
      const memories = await this.services.privateMemoryStore.recall(message, { userId: 'local', limit: 5, includePending: true });
      return this.wrap([
        `Private memory: ${stats.approved} approved, ${stats.pending} pending.`,
        ...(memories.length
          ? ['Relevant memories:', ...memories.map(memory => `- ${this.truncate(memory.content, 180)} (${memory.status}, confidence ${memory.confidence.toFixed(2)})`)]
          : ['No relevant memories matched that query.'])
      ].join('\n'), [], { stats, memories });
    }

    const [kbStats, entityStats, graphStats, memoryStats] = await Promise.all([
      this.services.documentManager?.getStats?.() || Promise.resolve({}),
      this.services.entityLinkingService?.stats?.() || Promise.resolve({ total: 0, byType: {} }),
      this.services.knowledgeGraphIndexer?.stats?.() || Promise.resolve({ nodes: 0, edges: 0 }),
      this.services.privateMemoryStore?.stats?.('local') || Promise.resolve({ total: 0, approved: 0, pending: 0 })
    ]);

    return this.wrap([
      'Knowledge OS status:',
      `- RAG persistence: ${kbStats?.persistentStore ? 'on' : 'off'}`,
      `- Sources: ${kbStats?.persistence?.sources ?? 0}`,
      `- Chunks: ${kbStats?.persistence?.chunks ?? 0}`,
      `- Embeddings: ${kbStats?.persistence?.embeddings ?? 0}`,
      `- Linked entities: ${entityStats.total}`,
      `- Graph: ${graphStats.nodes} nodes, ${graphStats.edges} edges`,
      `- Private memory: ${memoryStats.approved} approved, ${memoryStats.pending} pending`
    ].join('\n'), [], { kbStats, entityStats, graphStats, memoryStats });
  }

  private wrap(response: string, sources: string[], data?: any) {
    return {
      response,
      sources,
      mode: 'knowledge_os',
      model: 'knowledge-os-chat-agent',
      data
    };
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  }
}
