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
    await expect(provider.search({ query: 'repository', signal: controller.signal } as never)).rejects.toThrow('cancelled');
    expect((await provider.rebuild()).id).toBe(provider.status().activeGeneration?.id);
  });
});
