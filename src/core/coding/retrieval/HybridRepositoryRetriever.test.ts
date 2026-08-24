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
      const first = await retriever.search({ query: 'resolve scoped symbol', repositoryVersion: 'fixture-v1', symbols: ['resolveScopedSymbol'] });
      const second = await retriever.search({ query: 'resolve scoped symbol', repositoryVersion: 'fixture-v1', symbols: ['resolveScopedSymbol'] });

      expect(first).toEqual(second);
      expect(first.results[0]).toEqual(expect.objectContaining({
        path: 'src.ts',
        scores: expect.objectContaining({ bm25: expect.any(Number), symbol: 1, final: expect.any(Number) }),
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
});
