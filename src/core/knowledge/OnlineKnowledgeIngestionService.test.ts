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
    await expect(service.rollbackIngestion(result.ingestionId)).resolves.toEqual({ rolledBack: true, removed: 1 });
    expect(deletedIds).toEqual([['chunk-a']]);
  });
});
