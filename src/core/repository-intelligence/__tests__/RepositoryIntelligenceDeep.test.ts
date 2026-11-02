import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ByteOffsetSymbolIndex, StaleOffsetError } from '../indexes/ByteOffsetSymbolIndex';

describe('RT-REPO-001..003 — Repository Intelligence, Symbol Indexing and Retrieval Suite', () => {
  let tempDir: string;
  let symbolIndex: ByteOffsetSymbolIndex;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-intel-test-'));
    symbolIndex = new ByteOffsetSymbolIndex(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('RT-REPO-001: Symbol Index and Stale Offset Detection', () => {
    it('indexes symbols and retrieves exact source slicing by byte offset', () => {
      const code = 'export function calculateMetrics(a: number, b: number): number {\n  return a + b;\n}\n';
      const testFile = path.join(tempDir, 'metrics.ts');
      fs.writeFileSync(testFile, code);

      const indexed = symbolIndex.indexFileContent('metrics.ts', code, [
        {
          name: 'calculateMetrics',
          kind: 'function',
          byteOffset: 0,
          byteLength: Buffer.byteLength(code),
          startLine: 1,
          startColumn: 0,
          endLine: 3,
          endColumn: 1,
          exported: true,
        },
      ]);

      const retrieved = symbolIndex.retrieveSymbolSource(indexed[0].id);
      expect(retrieved.sourceCode).toBe(code);
    });

    it('throws StaleOffsetError when file content is modified after indexing', () => {
      const code = 'export const API_VERSION = 1;\n';
      const testFile = path.join(tempDir, 'version.ts');
      fs.writeFileSync(testFile, code);

      const indexed = symbolIndex.indexFileContent('version.ts', code, [
        {
          name: 'API_VERSION',
          kind: 'constant',
          byteOffset: 0,
          byteLength: Buffer.byteLength(code),
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          endColumn: 30,
          exported: true,
        },
      ]);

      // Mutate file on disk
      fs.writeFileSync(testFile, 'export const API_VERSION = 2;\n// changed content\n');

      expect(() => symbolIndex.retrieveSymbolSource(indexed[0].id)).toThrow(StaleOffsetError);
    });
  });

  describe('RT-REPO-002: Query & Batch Retrieval', () => {
    it('performs batch retrieval of indexed symbols', () => {
      const code = 'export class AuthService {}\n';
      const file = path.join(tempDir, 'service.ts');
      fs.writeFileSync(file, code);

      const indexed = symbolIndex.indexFileContent('service.ts', code, [
        {
          name: 'AuthService',
          kind: 'class',
          byteOffset: 0,
          byteLength: Buffer.byteLength(code),
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          endColumn: 26,
          exported: true,
        },
      ]);

      const batch = symbolIndex.batchRetrieve([indexed[0].id]);
      expect(batch.length).toBe(1);
      expect(batch[0].success).toBe(true);
      expect(batch[0].sourceCode).toBe(code);
    });
  });
});
