import { createHash } from 'crypto';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';

export interface LexicalLimits {
  maxFiles: number;
  maxBytes: number;
  maxTokens: number;
  maxPostings: number;
  maxResults: number;
  maxQueryLength: number;
}

export interface LexicalQuery {
  query: string;
  maxResults?: number;
  phrase?: boolean;
  proximity?: number;
}

export interface LexicalSearchResult {
  path: string;
  lineStart: number;
  lineEnd: number;
  excerpt: string;
  sourceDigest: string;
  repositoryVersion: string;
  generationId: string;
  matchedTerms: string[];
  score: number;
  scores: { bm25: number; phrase?: number; proximity?: number };
  reasons: string[];
  warnings: string[];
}

export interface LexicalSearchResponse {
  results: LexicalSearchResult[];
  warnings: string[];
  truncated: boolean;
}

export interface LexicalIndexGeneration {
  id: string;
  repositoryVersion: string;
  documentCount: number;
  createdAt: string;
}

export interface LexicalIndexStatus {
  activeGeneration?: LexicalIndexGeneration;
  warnings: string[];
}

export interface LexicalBuildInput {
  repositoryVersion: string;
  signal?: AbortSignal;
}

export type LexicalUpdateInput = LexicalBuildInput;

export interface LexicalRetrievalProvider {
  build(input: LexicalBuildInput): Promise<LexicalIndexGeneration>;
  update(input: LexicalUpdateInput): Promise<LexicalIndexGeneration>;
  search(query: LexicalQuery, signal?: AbortSignal): Promise<LexicalSearchResponse>;
  status(): LexicalIndexStatus;
  rebuild(signal?: AbortSignal): Promise<LexicalIndexGeneration>;
}

interface DocumentRecord {
  path: string;
  content: string;
  digest: string;
  length: number;
  terms: Map<string, number[]>;
}

interface Generation extends LexicalIndexGeneration {
  documents: DocumentRecord[];
  postings: Map<string, Set<number>>;
  averageLength: number;
}

/**
 * Clean-room BM25 index based on the published Okapi BM25 formula. Repository
 * discovery and reads are exclusively delegated to ApprovedRepositoryGateway.
 */
export class GatewayLexicalRetrievalProvider implements LexicalRetrievalProvider {
  private active?: Generation;
  private lastRepositoryVersion = '';
  private readonly limits: LexicalLimits;

  constructor(
    private readonly gateway: ApprovedRepositoryGateway,
    limits: Partial<LexicalLimits> = {}
  ) {
    this.limits = {
      maxFiles: limits.maxFiles ?? 2000,
      maxBytes: limits.maxBytes ?? 8 * 1024 * 1024,
      maxTokens: limits.maxTokens ?? 500_000,
      maxPostings: limits.maxPostings ?? 1_000_000,
      maxResults: limits.maxResults ?? 50,
      maxQueryLength: limits.maxQueryLength ?? 512
    };
  }

  async build(input: LexicalBuildInput): Promise<LexicalIndexGeneration> {
    const generation = this.createGeneration(input.repositoryVersion, input.signal);
    this.active = generation;
    this.lastRepositoryVersion = input.repositoryVersion;
    return publicGeneration(generation);
  }

  async update(input: LexicalUpdateInput): Promise<LexicalIndexGeneration> {
    return this.build(input);
  }

  async rebuild(signal?: AbortSignal): Promise<LexicalIndexGeneration> {
    if (!this.lastRepositoryVersion) throw new Error('No repository version is available for rebuild.');
    return this.build({ repositoryVersion: this.lastRepositoryVersion, signal });
  }

  status(): LexicalIndexStatus {
    return { activeGeneration: this.active && publicGeneration(this.active), warnings: [] };
  }

  async search(query: LexicalQuery, signal?: AbortSignal): Promise<LexicalSearchResponse> {
    throwIfAborted(signal);
    const generation = this.active;
    if (!generation) return { results: [], warnings: ['Lexical index is not built.'], truncated: false };
    if (query.query.length > this.limits.maxQueryLength) {
      return { results: [], warnings: ['Query exceeds lexical retrieval limit.'], truncated: false };
    }
    const terms = tokenize(query.query);
    if (!terms.length) return { results: [], warnings: ['Query contains no searchable terms.'], truncated: false };
    const candidates = new Set<number>();
    for (const term of terms) generation.postings.get(term)?.forEach(index => candidates.add(index));
    const results = [...candidates].map(index => {
      throwIfAborted(signal);
      return this.rank(generation, generation.documents[index], terms, query);
    }).filter((value): value is LexicalSearchResult => Boolean(value))
      .sort(compareResults);
    const maximum = Math.min(query.maxResults ?? this.limits.maxResults, this.limits.maxResults);
    return { results: results.slice(0, maximum), warnings: [], truncated: results.length > maximum };
  }

  private createGeneration(repositoryVersion: string, signal?: AbortSignal): Generation {
    const documents: DocumentRecord[] = [];
    const postings = new Map<string, Set<number>>();
    let bytes = 0;
    let tokens = 0;
    let postingCount = 0;
    for (const path of this.gateway.listFiles('.', this.limits.maxFiles)) {
      throwIfAborted(signal);
      let read;
      try { read = this.gateway.readTextFile(path, this.limits.maxBytes); } catch { continue; }
      if (read.truncated || bytes + read.size > this.limits.maxBytes) continue;
      const terms = positions(tokenize(read.content));
      if (tokens + [...terms.values()].reduce((sum, value) => sum + value.length, 0) > this.limits.maxTokens) break;
      const record: DocumentRecord = { path: read.path, content: read.content, digest: digest(read.content), length: tokenLength(terms), terms };
      const index = documents.push(record) - 1;
      bytes += read.size;
      tokens += record.length;
      for (const term of terms.keys()) {
        const values = postings.get(term) || new Set<number>();
        if (!values.has(index)) postingCount += 1;
        if (postingCount > this.limits.maxPostings) break;
        values.add(index);
        postings.set(term, values);
      }
      if (postingCount > this.limits.maxPostings) break;
    }
    const averageLength = documents.length ? documents.reduce((sum, value) => sum + value.length, 0) / documents.length : 0;
    const id = digest(JSON.stringify({ repositoryVersion, documents: documents.map(value => [value.path, value.digest]) }));
    return { id, repositoryVersion, documentCount: documents.length, createdAt: '1970-01-01T00:00:00.000Z', documents, postings, averageLength };
  }

  private rank(generation: Generation, document: DocumentRecord, terms: string[], query: LexicalQuery): LexicalSearchResult | undefined {
    const k1 = 1.2, b = 0.75;
    let bm25 = 0;
    for (const term of terms) {
      const count = document.terms.get(term)?.length;
      if (!count) continue;
      const df = generation.postings.get(term)!.size;
      const idf = Math.log(1 + (generation.documentCount - df + 0.5) / (df + 0.5));
      bm25 += idf * (count * (k1 + 1)) / (count + k1 * (1 - b + b * document.length / Math.max(1, generation.averageLength)));
    }
    const phrase = query.phrase ? phraseScore(document, terms) : 0;
    const proximity = query.proximity ? proximityScore(document, terms, query.proximity) : 0;
    const score = bm25 + phrase + proximity;
    const line = firstLine(document.content, terms);
    return {
      path: document.path, lineStart: line, lineEnd: line, excerpt: excerpt(document.content, line),
      sourceDigest: document.digest, repositoryVersion: generation.repositoryVersion, generationId: generation.id,
      matchedTerms: terms.filter(term => document.terms.has(term)), score,
      scores: { bm25, ...(phrase ? { phrase } : {}), ...(proximity ? { proximity } : {}) },
      reasons: ['BM25 lexical match', ...(phrase ? ['Exact phrase match'] : []), ...(proximity ? ['Token proximity match'] : [])],
      warnings: []
    };
  }
}

function tokenize(value: string): string[] {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9_]+/).filter(term => term.length > 1);
}
function positions(tokens: string[]): Map<string, number[]> {
  return tokens.reduce((result, token, index) => { const values = result.get(token) || []; values.push(index); result.set(token, values); return result; }, new Map<string, number[]>());
}
function tokenLength(terms: Map<string, number[]>): number { return [...terms.values()].reduce((sum, value) => sum + value.length, 0); }
function phraseScore(document: DocumentRecord, terms: string[]): number { return document.content.toLowerCase().includes(terms.join(' ')) ? 1 : 0; }
function proximityScore(document: DocumentRecord, terms: string[], distance: number): number {
  const positionsByTerm = terms.map(term => document.terms.get(term) || []);
  return positionsByTerm.every(values => values.some(position => positionsByTerm.every(other => other.some(candidate => Math.abs(candidate - position) <= distance)))) ? 0.5 : 0;
}
function firstLine(content: string, terms: string[]): number { return Math.max(1, content.split(/\r?\n/).findIndex(line => terms.some(term => line.toLowerCase().includes(term))) + 1); }
function excerpt(content: string, line: number): string { return (content.split(/\r?\n/)[line - 1] || '').slice(0, 1000); }
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function publicGeneration(value: Generation): LexicalIndexGeneration { return { id: value.id, repositoryVersion: value.repositoryVersion, documentCount: value.documentCount, createdAt: value.createdAt }; }
function compareResults(left: LexicalSearchResult, right: LexicalSearchResult): number { return right.score - left.score || left.path.localeCompare(right.path) || left.lineStart - right.lineStart; }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw new Error('Lexical retrieval cancelled.'); }
