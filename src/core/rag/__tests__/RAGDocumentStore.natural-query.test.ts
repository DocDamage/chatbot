import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { RAGDocumentStore } from '../RAGDocumentStore';
import { RAGService } from '../RAGService';

describe('natural-language local document retrieval', () => {
  let root: string;
  let database: Database;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'natural-query-'));
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'knowledge.db') });
    await database.initialize();
  });
  afterEach(async () => { await database.close(); fs.rmSync(root, { recursive: true, force: true }); });

  it('finds the subject even when question framing is not present in the source', async () => {
    const store = new RAGDocumentStore(database);
    await store.saveChunks([
      { id: 'observatory', content: 'Aurora Observatory reserve identifier: cobalt lantern 7419.', metadata: { source: 'observatory.txt', project: 'allowed' } },
      { id: 'other', content: 'Uploaded notes on cooking soup.', metadata: { source: 'cooking.txt', project: 'other' } },
    ]);
    const query = 'According to the uploaded note, what is the Aurora Observatory reserve identifier?';
    const results = await store.hybridSearch(query, undefined, 5, { project: 'allowed' });
    expect(results.map(result => result.chunk.id)).toEqual(['observatory']);
    expect(results[0].chunk.content).toContain('cobalt lantern 7419');
  });

  it('keeps unrelated documents and disallowed projects out of fallback results', async () => {
    const store = new RAGDocumentStore(database);
    await store.saveChunks([{ id: 'private', content: 'Aurora Observatory reserve identifier: private.', metadata: { source: 'private.txt', project: 'private' } }]);
    expect(await store.hybridSearch('Explain the Aurora Observatory identifier in the uploaded note', undefined, 5, { project: 'allowed' })).toEqual([]);
    expect(await store.hybridSearch('Underwater coral reef temperature', undefined, 5)).toEqual([]);
  });

  it('does not generate an embedding for an empty persistent library', async () => {
    const adapter = { generate: jest.fn(), getModelName: () => 'test', estimateCost: () => 0 };
    const embeddings = { embed: jest.fn() };
    const rag = new RAGService(adapter, embeddings as any, { documentStore: new RAGDocumentStore(database), retrievalMode: 'database' });
    expect(await rag.retrieveContext('Some question')).toEqual([]);
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('finds a numbered map before prose and similarly numbered maps', async () => {
    const store = new RAGDocumentStore(database);
    await store.saveChunks([
      { id: 'prose', content: 'Atlas dungeon level map room and area descriptions.', metadata: { source: 'atlas.pdf', title: 'Atlas' } },
      { id: 'map-ten', content: 'Map 10: Dungeon Level, PDF page 100.', metadata: { source: 'atlas.pdf', fileName: 'atlas.pdf', mapIndex: true, mapTitle: 'Map 10: Dungeon Level' } },
      { id: 'map-one', content: 'Map 1: Dungeon Level, PDF page 16. Printed scale: 1 square = 10 feet.', metadata: { source: 'atlas.pdf', fileName: 'atlas.pdf', mapIndex: true, mapTitle: 'Map 1: Dungeon Level', page: 16 } },
      { id: 'map-decimal', content: 'Map 1.4: Castle, PDF page 42.', metadata: { source: 'atlas.pdf', mapIndex: true, mapTitle: 'Map 1.4: Castle' } },
    ]);
    expect((await store.hybridSearch('Find Map 1: Dungeon Level in Atlas. Give the PDF page and printed scale.', undefined, 5))[0].chunk.id).toBe('map-one');
    expect((await store.searchKeyword('Find Map 1.4 in Atlas', 5))[0].chunk.id).toBe('map-decimal');
  });

  it('does not promote map records across retrieval filters or for a generic book request', async () => {
    const store = new RAGDocumentStore(database);
    await store.saveChunks([
      { id: 'allowed', content: 'Map 1: Harbour, PDF page 2.', metadata: { source: 'atlas.pdf', mapIndex: true, mapTitle: 'Map 1: Harbour', project: 'allowed', visibility: 'private' } },
      { id: 'hidden', content: 'Map 1: Harbour, PDF page 99.', metadata: { source: 'atlas.pdf', mapIndex: true, mapTitle: 'Map 1: Harbour', project: 'other', visibility: 'private' } },
    ]);
    const hits = await store.searchKeyword('Find Map 1 in Atlas', 5, { project: 'allowed', visibility: ['private'] });
    expect(hits.map(hit => hit.chunk.id)).toEqual(['allowed']);
    expect(await store.searchKeyword('Find Map 1 in Atlas', 5, { visibility: ['public'] })).toEqual([]);
    expect((await store.searchKeyword('Show maps in atlas', 5)).every(hit => !hit.retrievalMethod.includes('+map'))).toBe(true);
  });
});
