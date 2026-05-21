import { KnowledgeOnlineFlowService } from './KnowledgeOnlineFlowService';

function preview() {
  return {
    query: 'test query',
    domain: 'ask',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    answerPreview: 'Preview answer',
    sources: [{ title: 'Source', url: 'https://example.com/source', snippet: 'Snippet' }],
    reviewToken: 'token',
    requiresApproval: true as const,
    sourcePolicy: { accepted: 1, rejected: [] }
  };
}

describe('KnowledgeOnlineFlowService', () => {
  it('returns the local answer when confidence is high enough', async () => {
    const service = new KnowledgeOnlineFlowService({
      ragService: {
        processQuery: jest.fn().mockResolvedValue({ answer: 'local answer', confidence: 0.9 })
      }
    });

    const result = await service.answerOrRequestResearch({ question: 'known thing' });

    expect(result.needsOnlineResearch).toBe(false);
    expect(result.answer).toBe('local answer');
    expect(result.confidence).toBe(0.9);
  });

  it('requests online research when local confidence is low', async () => {
    const service = new KnowledgeOnlineFlowService({
      ragService: {
        processQuery: jest.fn().mockResolvedValue({ answer: 'weak answer', confidence: 0.2 })
      }
    });

    const result = await service.answerOrRequestResearch({ question: 'unknown thing', domain: 'gaming' });

    expect(result.needsOnlineResearch).toBe(true);
    expect(result.suggestedQuery).toBe('unknown thing');
    expect(result.miss?.domain).toBe('gaming');
  });

  it('searches without ingesting when approval is missing', async () => {
    const onlineKnowledgeService = {
      searchAndSummarize: jest.fn().mockResolvedValue(preview()),
      ingestApproved: jest.fn()
    } as any;
    const service = new KnowledgeOnlineFlowService({ onlineKnowledgeService });

    const result = await service.searchAndMaybeIngest({ query: 'test query' });

    expect(result.ingested).toBe(false);
    expect(onlineKnowledgeService.ingestApproved).not.toHaveBeenCalled();
  });

  it('searches and ingests when approved', async () => {
    const onlineKnowledgeService = {
      searchAndSummarize: jest.fn().mockResolvedValue(preview()),
      ingestApproved: jest.fn().mockResolvedValue({ ingested: 1, ingestionId: 'ing-1' })
    } as any;
    const service = new KnowledgeOnlineFlowService({ onlineKnowledgeService });

    const result = await service.searchAndMaybeIngest({
      query: 'test query',
      approved: true,
      approvedBy: 'dev-user'
    });

    expect(result.ingested).toBe(true);
    expect(result.ingestion).toEqual(expect.objectContaining({ ingestionId: 'ing-1' }));
    expect(onlineKnowledgeService.ingestApproved).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ approvedBy: 'dev-user' }));
  });
});
