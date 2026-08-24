import fs from 'fs';
import os from 'os';
import path from 'path';
import { GatewayLexicalRetrievalProvider } from './GatewayLexicalRetrievalProvider';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';

describe('GatewayLexicalRetrievalProvider', () => {
  let root = '';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexical-retrieval-'));
    fs.writeFileSync(path.join(root, 'alpha.ts'), 'export function parseRepositoryPath(value: string) { return value; }');
    fs.writeFileSync(path.join(root, 'beta.ts'), 'export const repositoryPath = "fallback";');
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('uses deterministic BM25 ordering and exposes source evidence', async () => {
    const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
    const generation = await provider.build({ repositoryVersion: 'fixture-v1' });
    const first = await provider.search({ query: 'parse repository path' });
    const second = await provider.search({ query: 'parse repository path' });

    expect(generation.createdAt).toBe('1970-01-01T00:00:00.000Z');
    expect(first.results).toEqual(second.results);
    expect(first.results[0]).toEqual(expect.objectContaining({
      path: 'alpha.ts',
      repositoryVersion: 'fixture-v1',
      generationId: generation.id,
      sourceDigest: expect.any(String),
      scores: expect.objectContaining({ bm25: expect.any(Number) })
    }));
  });

  it('supports phrase/proximity, cancellation, and rebuild', async () => {
    const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
    await provider.build({ repositoryVersion: 'fixture-v1' });
    expect((await provider.search({ query: 'repository path', phrase: true, proximity: 3 })).results[0].reasons)
      .toEqual(expect.arrayContaining(['BM25 lexical match']));
    const controller = new AbortController();
    controller.abort();
    await expect(provider.search({ query: 'repository' }, controller.signal)).rejects.toThrow('cancelled');
    expect((await provider.rebuild()).id).toBe(provider.status().activeGeneration?.id);
  });
  it('removes stale results after add, rename, and delete lifecycle updates', async () => {
    const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
    await provider.build({ repositoryVersion: 'fixture-v1' });
    fs.renameSync(path.join(root, 'alpha.ts'), path.join(root, 'renamed.ts'));
    fs.writeFileSync(path.join(root, 'added.ts'), 'export const incrementalIndexLifecycle = true;');
    await provider.update({ repositoryVersion: 'fixture-v2' });
    expect((await provider.search({ query: 'parse repository path' })).results.some(value => value.path === 'alpha.ts')).toBe(false);
    expect((await provider.search({ query: 'incremental index lifecycle' })).results[0].path).toBe('added.ts');
    fs.rmSync(path.join(root, 'added.ts'));
    await provider.update({ repositoryVersion: 'fixture-v3' });
    expect((await provider.search({ query: 'incremental index lifecycle' })).results).toEqual([]);
  });

  it('reports unbuilt, oversized, and bounded-result queries without fabricating matches', async () => {
    const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root), { maxQueryLength: 16, maxResults: 1 });
    expect((await provider.search({ query: 'repository' })).warnings).toEqual(['Lexical index is not built.']);
    await provider.build({ repositoryVersion: 'fixture-v1' });
    expect((await provider.search({ query: 'this query is too long' })).warnings).toEqual(['Query exceeds lexical retrieval limit.']);
    expect((await provider.search({ query: 'path', maxResults: 1 })).truncated).toBe(true);
  });

  it('fails a rebuild without a previous repository version and honors an aborted build', async () => {
    const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
    await expect(provider.rebuild()).rejects.toThrow('No repository version');
    const controller = new AbortController();
    controller.abort();
    await expect(provider.build({ repositoryVersion: 'fixture-v1', signal: controller.signal })).rejects.toThrow('cancelled');
  });

  it('distinguishes empty, phrase, and no-match searches', async () => {
    fs.writeFileSync(path.join(root, 'phrase.ts'), '// exact phrase token\nexport const exactPhraseToken = true;');
    const provider = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(root));
    await provider.build({ repositoryVersion: 'fixture-v1' });
    expect((await provider.search({ query: ' ' })).warnings).toEqual(['Query contains no searchable terms.']);
    expect((await provider.search({ query: 'exact phrase token', phrase: true })).results[0].reasons)
      .toEqual(expect.arrayContaining(['Exact phrase match']));
    expect((await provider.search({ query: 'unfindable vocabulary' })).results).toEqual([]);
  });

});
