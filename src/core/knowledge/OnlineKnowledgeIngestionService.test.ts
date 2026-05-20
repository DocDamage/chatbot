import { OnlineKnowledgeIngestionService } from './OnlineKnowledgeIngestionService';

describe('OnlineKnowledgeIngestionService', () => {
  it('summarizes search results and ingests approved summaries with provenance', async () => {
    const added: Array<{ text: string; metadata: Record<string, any> }> = [];
    const documentManager = {
      addText: async (text: string, metadata: Record<string, any>) => {
        added.push({ text, metadata });
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

    const result = await service.ingestApproved(preview, 'session-1');
    expect(result.ingested).toBe(1);
    expect(added[0].metadata.sourceUrl).toBe('https://example.com/godot');
    expect(added[0].metadata.approvedBy).toBe('session-1');
  });
});
