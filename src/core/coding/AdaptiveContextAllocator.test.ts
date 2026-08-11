import { AdaptiveContextAllocator } from './retrieval/AdaptiveContextAllocator';

describe('AdaptiveContextAllocator', () => {
  it('prioritizes repository instructions and diagnostics within model capacity', () => {
    const result = new AdaptiveContextAllocator().allocate({ modelContextTokens: 200, outputTokens: 50, intent: 'debug_error', repositorySize: 5000, errorCount: 2, evidence: [
      { kind: 'request', label: 'request', content: 'fix', authority: 'user', reason: 'request', confidence: 1 },
      { kind: 'instruction', label: 'AGENTS.md', content: 'instructions '.repeat(50), authority: 'repository', reason: 'instruction', confidence: 1 },
      { kind: 'diagnostic', label: 'tsc', content: 'error '.repeat(50), authority: 'repository', reason: 'diagnostic', confidence: 1 },
      { kind: 'general' as any, label: 'generic', content: 'generic '.repeat(200), authority: 'learned', reason: 'generic', confidence: 0.2 }
    ]});
    expect(result.estimatedTokens).toBeLessThanOrEqual(150);
    expect(result.items.map(item => item.kind)).toEqual(expect.arrayContaining(['request', 'instruction', 'diagnostic']));
  });
});
