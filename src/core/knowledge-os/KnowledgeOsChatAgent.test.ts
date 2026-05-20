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
});
