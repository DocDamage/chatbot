export interface RetrievalBenchmarkCase {
  id: string;
  query: string;
  relevantPaths: string[];
  exactPath?: string;
  exactSymbol?: string;
}

export interface RetrievalBenchmarkResult {
  strategy: 'literal' | 'structural' | 'bm25' | 'phrase-proximity' | 'hybrid';
  recallAtK: number;
  reciprocalRank: number;
  exactPathAccuracy: number;
  exactSymbolAccuracy: number;
  queryCount: number;
}

export function scoreRetrievalBenchmark(
  strategy: RetrievalBenchmarkResult['strategy'],
  cases: RetrievalBenchmarkCase[],
  results: ReadonlyMap<string, readonly string[]>,
  k = 5
): RetrievalBenchmarkResult {
  let recall = 0;
  let reciprocalRank = 0;
  let exactPath = 0;
  let exactSymbol = 0;
  for (const item of cases) {
    const ranked = results.get(item.id) || [];
    const top = ranked.slice(0, k);
    if (top.some(path => item.relevantPaths.includes(path))) recall += 1;
    const rank = ranked.findIndex(path => item.relevantPaths.includes(path));
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
    if (item.exactPath && ranked[0] === item.exactPath) exactPath += 1;
    if (item.exactSymbol && ranked[0] && ranked[0].includes(item.exactSymbol)) exactSymbol += 1;
  }
  const total = Math.max(1, cases.length);
  return {
    strategy, recallAtK: recall / total, reciprocalRank: reciprocalRank / total,
    exactPathAccuracy: exactPath / total, exactSymbolAccuracy: exactSymbol / total, queryCount: cases.length
  };
}

export const RETRIEVAL_BENCHMARK_FIXTURES: RetrievalBenchmarkCase[] = [
  { id: 'exact-path', query: 'src/core/coding/retrieval/GatewayLexicalRetrievalProvider.ts', relevantPaths: ['src/core/coding/retrieval/GatewayLexicalRetrievalProvider.ts'], exactPath: 'src/core/coding/retrieval/GatewayLexicalRetrievalProvider.ts' },
  { id: 'exact-symbol', query: 'GatewayLexicalRetrievalProvider', relevantPaths: ['src/core/coding/retrieval/GatewayLexicalRetrievalProvider.ts'], exactSymbol: 'GatewayLexicalRetrievalProvider' },
  { id: 'natural-language', query: 'deterministic repository lexical search with BM25', relevantPaths: ['src/core/coding/retrieval/GatewayLexicalRetrievalProvider.ts'] }
];
