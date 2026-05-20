import { HybridRetriever } from './HybridRetriever';

describe('HybridRetriever source quality filters', () => {
  it('excludes deprecated sources and filters by project/authority', async () => {
    const retriever = new HybridRetriever();
    retriever.addDocuments([
      {
        id: 'canonical',
        content: 'Durable RAG persistence uses RAGDocumentStore.',
        metadata: {
          source: 'canonical.md',
          authority: 'canonical',
          project: 'chatbot',
          trustScore: 1
        }
      },
      {
        id: 'deprecated',
        content: 'Durable RAG persistence uses old notes.',
        metadata: {
          source: 'old.md',
          authority: 'deprecated',
          project: 'chatbot',
          trustScore: 0.1
        }
      },
      {
        id: 'other-project',
        content: 'Durable RAG persistence for another project.',
        metadata: {
          source: 'game.md',
          authority: 'canonical',
          project: 'game-dev',
          trustScore: 1
        }
      }
    ]);

    const results = await retriever.retrieve('durable RAG persistence', 10, undefined, {
      authority: ['canonical'],
      excludeDeprecated: true,
      project: 'chatbot'
    });

    expect(results.map(result => result.chunk.id)).toEqual(['canonical']);
  });
});
