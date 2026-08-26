import { OnlineKnowledgeIngestionService } from './OnlineKnowledgeIngestionService';

describe('OnlineKnowledgeIngestionService', () => {
  it('summarizes search results and ingests approved summaries with provenance', async () => {
    const added: Array<{ text: string; metadata: Record<string, any> }> = [];
    const documentManager = {
      addText: async (text: string, metadata: Record<string, any>) => {
        added.push({ text, metadata });
        return [{ id: `chunk-${added.length}` }];
      }
    };
    const service = new OnlineKnowledgeIngestionService(documentManager as any, {
      search: async () => [
        {
          title: 'Godot release notes',
          url: 'https://example.com/godot',
          snippet: 'Godot added rendering and workflow improvements.'
        }
      ]
    } as any);

    const preview = await service.searchAndSummarize('Godot release notes', 'gaming');
    expect(preview.sources[0].url).toBe('https://example.com/godot');
    expect(preview.requiresApproval).toBe(true);
    expect(preview.reviewToken).toHaveLength(64);

    const result = await service.ingestApproved(preview, { approved: true, approvedBy: 'user-1' });
    expect(result.ingested).toBe(1);
    expect(result.rollbackToken).toBe(result.ingestionId);
    expect(added[0].metadata.sourceUrl).toBe('https://example.com/godot');
    expect(added[0].metadata.approvedBy).toBe('user-1');
    expect(added[0].metadata.approvalStatus).toBe('approved');
    expect(added[0].metadata.provenance.reviewToken).toBe(preview.reviewToken);
  });

  it('filters unsupported sources before previewing online knowledge', async () => {
    const service = new OnlineKnowledgeIngestionService({ addText: jest.fn() } as any, {
      search: async () => [
        {
          title: 'Local admin',
          url: 'http://localhost:3001/secret',
          snippet: 'Do not ingest this.'
        },
        {
          title: 'Public docs',
          url: 'https://example.com/docs',
          snippet: 'Public documentation.'
        }
      ]
    } as any);

    const preview = await service.searchAndSummarize('docs', 'ask');
    expect(preview.sources).toHaveLength(1);
    expect(preview.sources[0].url).toBe('https://example.com/docs');
    expect(preview.sourcePolicy.rejected[0].reason).toBe('Local sources are not allowed');
  });

  it('builds an approval-gated deep research preview with related categories', async () => {
    const added: Array<{ text: string; metadata: Record<string, any> }> = [];
    const service = new OnlineKnowledgeIngestionService({
      addText: async (text: string, metadata: Record<string, any>) => {
        added.push({ text, metadata });
        return [{ id: `deep-chunk-${added.length}` }];
      }
    } as any, {
      search: async (query: string) => [{
        title: query.endsWith('history') ? 'History source' : query.endsWith('science') ? 'Science source' : 'Gaming source',
        url: query.endsWith('history') ? 'https://example.com/history' : query.endsWith('science') ? 'https://example.com/science' : 'https://example.com/gaming',
        snippet: `Evidence for ${query}`
      }]
    } as any, {
      fetchPage: async url => `Full evidence from ${url}.`,
      llmAdapter: {
        generate: async () => ({ content: 'Synthesized answer with [Source 1] and [Source 2].' })
      }
    });

    const preview = await service.deepResearch('video game history', 'gaming');
    expect(preview.researchType).toBe('deep-dive');
    expect(preview.relatedCategories).toEqual(expect.arrayContaining(['history', 'science']));
    expect(preview.sources.length).toBeGreaterThanOrEqual(2);
    expect(preview.synthesis).toContain('Synthesized answer');
    expect(preview.researchDocument).toContain('Evidence sources:');
    expect(preview.requiresApproval).toBe(true);

    const ingestion = await service.ingestApproved(preview, { approved: true, approvedBy: 'reviewer-1' });
    expect(ingestion.ingested).toBeGreaterThan(1);
    expect(added[0].metadata.ingestionMethod).toBe('online-approved-deep-research');
    expect(added[0].metadata.categories).toContain('history');
  });

  it('requires explicit approval and supports rollback through document manager hooks', async () => {
    const deletedIds: string[][] = [];
    const service = new OnlineKnowledgeIngestionService({
      addText: async () => [{ id: 'chunk-a' }],
      deleteByIds: async (ids: string[]) => {
        deletedIds.push(ids);
        return ids.length;
      }
    } as any, {
      search: async () => [{
        title: 'Docs',
        url: 'https://example.com/rollback',
        snippet: 'Rollback-capable source.'
      }]
    } as any);

    const preview = await service.searchAndSummarize('rollback docs', 'ask');
    await expect(service.ingestApproved(preview, { approved: false, approvedBy: 'user-1' })).rejects.toThrow('explicit approval');

    const result = await service.ingestApproved(preview, { approved: true, approvedBy: 'user-1' });
    const rollback = await service.rollbackIngestion(result.rollbackToken!);
    expect(rollback.rolledBack).toBe(true);
    expect(deletedIds).toEqual([['chunk-a']]);
  });

  it('covers searchWeb fallback, deleteByMetadata rollback, duplicate content skipping, and approval errors', async () => {
    // 1. searchWeb fallback instead of search
    const docManager = {
      addText: jest.fn().mockResolvedValue([{ id: 'c1' }]),
      deleteByMetadata: jest.fn().mockResolvedValue(1)
    };
    const webService = new OnlineKnowledgeIngestionService(docManager as any, {
      searchWeb: jest.fn().mockResolvedValue([
        { title: 'Web title', url: 'https://example.com/web', snippet: 'Web snippet' }
      ])
    });

    const preview = await webService.searchAndSummarize('web query', 'coding');
    expect(preview.sources).toHaveLength(1);

    // 2. Reject unapproved ingestion
    await expect(webService.ingestApproved(preview, { approved: false, approvedBy: 'user' })).rejects.toThrow('explicit approval');

    // 3. Reject tampered review token
    const tampered = { ...preview, reviewToken: 'invalid-token-12345' };
    await expect(webService.ingestApproved(tampered, { approved: true, approvedBy: 'user' })).rejects.toThrow('review-token validation');

    // 4. Ingestion and rollback via deleteByMetadata
    const ingestRes = await webService.ingestApproved(preview, { approved: true, approvedBy: 'user' });
    expect(ingestRes.ingested).toBe(1);

    const rollbackRes = await webService.rollbackIngestion(ingestRes.rollbackToken!);
    expect(rollbackRes.rolledBack).toBe(true);

    // 5. Non-existent rollback
    const badRollback = await webService.rollbackIngestion('non-existent-token');
    expect(badRollback.rolledBack).toBe(false);

    // 6. Deep research without fetchPage / llmAdapter uses default fallbacks
    const fallbackService = new OnlineKnowledgeIngestionService(docManager as any, {
      search: jest.fn().mockResolvedValue([{ title: 'Fallback source', url: 'https://example.com/fallback', snippet: 'snippet' }])
    });
    const deepFallback = await fallbackService.deepResearch('math proof', 'math');
    expect(deepFallback.researchType).toBe('deep-dive');

    // 7. Duplicate content skipping on second ingest
    const ingestFirst = await webService.ingestApproved(preview, { approved: true, approvedBy: 'user' });
    const ingestSecond = await webService.ingestApproved(preview, { approved: true, approvedBy: 'user' });
    expect(ingestSecond.skippedDuplicates).toBeGreaterThanOrEqual(1);

    // 8. Page text extractor
    const htmlText = (webService as any).extractPageText('<html><script>bad()</script><body><h1>Header</h1><p>Main content.</p></body></html>');
    expect(htmlText).toContain('Header');
    expect(htmlText).not.toContain('bad()');
  });
});
