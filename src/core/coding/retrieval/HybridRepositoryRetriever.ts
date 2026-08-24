import { LexicalRetrievalProvider, LexicalSearchResult } from './GatewayLexicalRetrievalProvider';

export interface HybridRepositoryResult {
  path: string;
  lineStart: number;
  lineEnd: number;
  excerpt: string;
  sourceDigest: string;
  repositoryVersion: string;
  generationId?: string;
  scores: {
    path?: number; symbol?: number; bm25?: number; phrase?: number; proximity?: number;
    structural?: number; vector?: number; diagnostic?: number; authority?: number; final: number;
  };
  reasons: string[];
  warnings: string[];
}

export interface HybridStructuralCandidate {
  path: string;
  lineStart?: number;
  lineEnd?: number;
  score: number;
  reason: string;
}

export type HybridVectorCandidate = HybridStructuralCandidate;

export interface HybridSearchInput {
  query: string;
  repositoryVersion: string;
  symbols?: string[];
  diagnostics?: string[];
  structural?: HybridStructuralCandidate[];
  vector?: HybridVectorCandidate[];
  maxResults?: number;
}

export class HybridRepositoryRetriever {
  constructor(private readonly lexical: LexicalRetrievalProvider) {}

  async search(input: HybridSearchInput, signal?: AbortSignal): Promise<{ results: HybridRepositoryResult[]; warnings: string[] }> {
    throwIfAborted(signal);
    const lexical = await this.lexical.search({ query: input.query, maxResults: Math.max(1, (input.maxResults ?? 20) * 3), phrase: true, proximity: 8 }, signal);
    const results = new Map<string, HybridRepositoryResult>();
    for (const value of lexical.results) this.addLexical(results, value, input);
    for (const value of input.structural || []) this.addExternal(results, value, 'structural');
    for (const value of input.vector || []) this.addExternal(results, value, 'vector');
    const warnings = [...lexical.warnings];
    if (!input.structural?.length) warnings.push('Structural retrieval unavailable; lexical ranking remains active.');
    if (!input.vector?.length) warnings.push('Vector retrieval unavailable; lexical ranking remains active.');
    return {
      results: [...results.values()].map(value => ({ ...value, scores: { ...value.scores, final: finalScore(value.scores) } }))
        .sort(compare).slice(0, input.maxResults ?? 20),
      warnings
    };
  }

  private addLexical(results: Map<string, HybridRepositoryResult>, lexical: LexicalSearchResult, input: HybridSearchInput): void {
    const key = identity(lexical.path, lexical.lineStart, lexical.lineEnd);
    const path = pathScore(input.query, lexical.path);
    const symbol = symbolScore(input.symbols || [], lexical.path, lexical.excerpt);
    const diagnostic = diagnosticScore(input.diagnostics || [], lexical.path, lexical.excerpt);
    results.set(key, {
      path: lexical.path, lineStart: lexical.lineStart, lineEnd: lexical.lineEnd, excerpt: lexical.excerpt,
      sourceDigest: lexical.sourceDigest, repositoryVersion: lexical.repositoryVersion, generationId: lexical.generationId,
      scores: { path, symbol, bm25: lexical.scores.bm25, phrase: lexical.scores.phrase, proximity: lexical.scores.proximity, diagnostic, authority: 1, final: 0 },
      reasons: [...lexical.reasons, ...(path ? ['Exact path or filename match'] : []), ...(symbol ? ['Exact symbol match'] : [])],
      warnings: [...lexical.warnings]
    });
  }

  private addExternal(results: Map<string, HybridRepositoryResult>, value: HybridStructuralCandidate, field: 'structural' | 'vector'): void {
    const key = identity(value.path, value.lineStart || 1, value.lineEnd || value.lineStart || 1);
    const current = results.get(key);
    if (current) {
      current.scores[field] = value.score;
      current.reasons.push(value.reason);
      return;
    }
    results.set(key, {
      path: value.path, lineStart: value.lineStart || 1, lineEnd: value.lineEnd || value.lineStart || 1,
      excerpt: '', sourceDigest: '', repositoryVersion: '', scores: { [field]: value.score, final: 0 },
      reasons: [value.reason], warnings: ['Result was supplied by a degraded optional provider.']
    });
  }
}

function identity(path: string, start: number, end: number): string { return `${path}\0${start}\0${end}`; }
function pathScore(query: string, path: string): number { return path.toLowerCase().includes(query.toLowerCase().replace(/\s+/g, '')) || path.toLowerCase().includes(query.toLowerCase()) ? 1 : 0; }
function symbolScore(symbols: string[], path: string, excerpt: string): number { return symbols.some(value => `${path}\n${excerpt}`.includes(value)) ? 1 : 0; }
function diagnosticScore(diagnostics: string[], path: string, excerpt: string): number { return diagnostics.some(value => `${path}\n${excerpt}`.includes(value)) ? 0.5 : 0; }
function finalScore(scores: HybridRepositoryResult['scores']): number {
  return (scores.path || 0) * 2 + (scores.symbol || 0) * 2 + (scores.bm25 || 0) + (scores.phrase || 0) + (scores.proximity || 0)
    + (scores.structural || 0) + (scores.vector || 0) + (scores.diagnostic || 0) + (scores.authority || 0);
}
function compare(left: HybridRepositoryResult, right: HybridRepositoryResult): number {
  return right.scores.final - left.scores.final || left.path.localeCompare(right.path) || left.lineStart - right.lineStart || left.sourceDigest.localeCompare(right.sourceDigest);
}
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw new Error('Hybrid repository retrieval cancelled.'); }
