import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatasetLoader } from '../DatasetLoader';

jest.mock('../../database/Database', () => {
  return {
    Database: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: 1, name: 'Alpha', score: 10 },
          { id: 2, name: 'Beta', score: 20 },
          { id: 3, name: 'Gamma', score: 30 }
        ]
      }),
      close: jest.fn().mockResolvedValue(undefined)
    }))
  };
}, { virtual: true });

describe('RT-DATA-001: DatasetLoader CSV, JSON, and SQLite Ingestion Suite', () => {
  let tempDir: string;
  let mockEmbeddingService: any;
  let loader: DatasetLoader;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataset-loader-test-'));
    mockEmbeddingService = {
      embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };
    loader = new DatasetLoader(mockEmbeddingService);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('loads CSV datasets with header parsing, chunking, and embedding generation', async () => {
    const csvPath = path.join(tempDir, 'data.csv');
    fs.writeFileSync(
      csvPath,
      'name,role,department\nAlice,Engineer,Core\nBob,Designer,UI\nCharlie,Manager,Ops\n',
      'utf8'
    );

    const chunks = await loader.loadCSV(csvPath, {
      chunkSize: 2,
      generateEmbeddings: true
    });

    expect(chunks.length).toBe(2);
    expect(chunks[0].content).toContain('name: Alice | role: Engineer | department: Core');
    expect(chunks[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(chunks[0].metadata.totalRows).toBe(3);
  });

  it('loads JSON array and single-object datasets', async () => {
    const jsonArrayPath = path.join(tempDir, 'data.json');
    fs.writeFileSync(
      jsonArrayPath,
      JSON.stringify([
        { id: 1, title: 'Item 1' },
        { id: 2, title: 'Item 2' },
        { id: 3, title: 'Item 3' }
      ]),
      'utf8'
    );

    const arrayChunks = await loader.loadJSON(jsonArrayPath, { chunkSize: 2 });
    expect(arrayChunks.length).toBe(2);
    expect(arrayChunks[0].metadata.totalItems).toBe(3);

    // Single object test
    const singleObjPath = path.join(tempDir, 'single.json');
    fs.writeFileSync(singleObjPath, JSON.stringify({ key: 'value', number: 42 }), 'utf8');

    const singleChunks = await loader.loadJSON(singleObjPath, { generateEmbeddings: true });
    expect(singleChunks.length).toBe(1);
    expect(singleChunks[0].embedding).toBeDefined();
  });

  it('loads SQLite database tables via Database query abstraction', async () => {
    const sqliteChunks = await loader.loadSQLite('mock.db', 'users_table', {
      chunkSize: 2,
      generateEmbeddings: true
    });

    expect(sqliteChunks.length).toBe(2);
    expect(sqliteChunks[0].content).toContain('name: Alpha');
    expect(sqliteChunks[0].embedding).toBeDefined();
  });

  it('handles read errors and throws cleanly', async () => {
    await expect(loader.loadCSV('nonexistent-file.csv')).rejects.toThrow();
    await expect(loader.loadJSON('nonexistent-file.json')).rejects.toThrow();
  });
});
