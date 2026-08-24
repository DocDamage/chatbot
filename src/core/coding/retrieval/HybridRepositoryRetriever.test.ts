import fs from 'fs';
import os from 'os';
import path from 'path';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { GatewayLexicalRetrievalProvider } from './GatewayLexicalRetrievalProvider';
import { HybridRepositoryRetriever } from './HybridRepositoryRetriever';

describe('HybridRepositoryRetriever', () => {
  it('fuses optional providers without allowing absence to collapse lexical results', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-retrieval-'));
    try {
      fs.writeFileSync(path.join(root, 'src.ts'), 'export function resolveScopedSymbol() { return true; }');
      const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
      await provider.build({ repositoryVersion: 'fixture-v1' });
      const retriever = new HybridRepositoryRetriever(provider);
      const first = await retriever.search({ query: 'resolve scoped symbol', repositoryVersion: 'fixture-v1', symbols: ['resolveScopedSymbol'], diagnostics: ['src.ts'] });
      const second = await retriever.search({ query: 'resolve scoped symbol', repositoryVersion: 'fixture-v1', symbols: ['resolveScopedSymbol'], diagnostics: ['src.ts'] });

      expect(first).toEqual(second);
      expect(first.results[0]).toEqual(expect.objectContaining({
        path: 'src.ts',
        scores: expect.objectContaining({ bm25: expect.any(Number), symbol: 1, diagnostic: 0.5, final: expect.any(Number) }),
        reasons: expect.arrayContaining(['BM25 lexical match', 'Exact symbol match'])
      }));
      expect(first.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('Structural retrieval unavailable'),
        expect.stringContaining('Vector retrieval unavailable')
      ]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  it('merges structural/vector-only candidates and honors cancellation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-retrieval-'));
    try {
      const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
      await provider.build({ repositoryVersion: 'fixture-v1' });
      const retriever = new HybridRepositoryRetriever(provider);
      const result = await retriever.search({
        query: 'no lexical match',
        repositoryVersion: 'fixture-v1',
        structural: [{ path: 'architecture.ts', lineStart: 3, score: 0.8, reason: 'structural neighborhood' }],
        vector: [{ path: 'architecture.ts', lineStart: 3, score: 0.7, reason: 'vector similarity' }]
      });
      expect(result.results[0]).toEqual(expect.objectContaining({
        path: 'architecture.ts',
        warnings: [expect.stringContaining('degraded optional provider')],
        scores: expect.objectContaining({ structural: 0.8, vector: 0.7 })
      }));
      const controller = new AbortController();
      controller.abort();
      await expect(retriever.search({ query: 'x', repositoryVersion: 'fixture-v1' }, controller.signal)).rejects.toThrow('cancelled');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('adds a deterministic path boost for exact filename queries', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-retrieval-'));
    try {
      fs.writeFileSync(path.join(root, 'target.ts'), 'export const target = true;');
      const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
      await provider.build({ repositoryVersion: 'fixture-v1' });
      const result = await new HybridRepositoryRetriever(provider).search({ query: 'target.ts', repositoryVersion: 'fixture-v1' });
      expect(result.results[0].scores.path).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

});
