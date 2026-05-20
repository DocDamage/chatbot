import { GovernanceEvidenceService } from './GovernanceEvidenceService';

describe('GovernanceEvidenceService', () => {
  it('scores evidence reports from checks', async () => {
    const service = new GovernanceEvidenceService();
    const report = await service.createReport({
      request: 'What is RAG?',
      answer: 'RAG retrieves knowledge from sources.',
      sources: ['docs/rag.md']
    });

    expect(report.score).toBe(1);
    expect(report.checks.map(check => check.name)).toContain('source_trace_available');
  });

  it('runs golden task checks', async () => {
    const service = new GovernanceEvidenceService();
    const result = await service.runGoldenTasks([
      {
        id: 'golden-1',
        query: 'Explain safe SQL.',
        mustContain: ['read-only'],
        mustNotContain: ['drop table']
      }
    ], {
      'golden-1': 'Safe SQL should be read-only and allowlisted.'
    });

    expect(result.total).toBe(1);
    expect(result.passed).toBe(1);
  });
});
