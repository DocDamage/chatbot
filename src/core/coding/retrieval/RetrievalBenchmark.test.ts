import { RETRIEVAL_BENCHMARK_FIXTURES, scoreRetrievalBenchmark } from './RetrievalBenchmark';

describe('Retrieval benchmark contract', () => {
  it('scores every required strategy deterministically', () => {
    const expected = new Map(RETRIEVAL_BENCHMARK_FIXTURES.map(value => [value.id, [...value.relevantPaths]]));
    const results = ['literal', 'structural', 'bm25', 'phrase-proximity', 'hybrid'].map(strategy =>
      scoreRetrievalBenchmark(strategy as 'literal', RETRIEVAL_BENCHMARK_FIXTURES, expected));

    expect(results.map(value => value.strategy)).toEqual(['literal', 'structural', 'bm25', 'phrase-proximity', 'hybrid']);
    expect(results.every(value => value.recallAtK === 1 && value.reciprocalRank === 1)).toBe(true);
    expect(results.every(value => value.queryCount === RETRIEVAL_BENCHMARK_FIXTURES.length)).toBe(true);
  });

  it('does not award exact-path credit for a merely relevant wrong first result', () => {
    const values = new Map([['exact-path', ['other.ts', 'src/core/coding/retrieval/GatewayLexicalRetrievalProvider.ts']]]);
    const result = scoreRetrievalBenchmark('hybrid', RETRIEVAL_BENCHMARK_FIXTURES.slice(0, 1), values);
    expect(result.recallAtK).toBe(1);
    expect(result.exactPathAccuracy).toBe(0);
    expect(result.reciprocalRank).toBe(0.5);
  });
  it('reports zero ranking metrics when no result is returned', () => {
    const result = scoreRetrievalBenchmark('literal', RETRIEVAL_BENCHMARK_FIXTURES.slice(0, 1), new Map());
    expect(result).toEqual(expect.objectContaining({ recallAtK: 0, reciprocalRank: 0, exactPathAccuracy: 0 }));
  });

});
