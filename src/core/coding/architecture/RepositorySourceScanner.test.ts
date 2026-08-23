import { LanguageCapabilityRegistry } from '../languages/LanguageCapabilityRegistry';
import { ApprovedRepositoryGateway, RepositoryAccessError } from '../security/ApprovedRepositoryGateway';
import {
  ArchitectureLimits,
  ArchitectureSymbolIndexer
} from './ArchitectureTypes';
import { RepositoryArchitectureCache } from './RepositoryArchitectureCache';
import { RepositorySourceScanner } from './RepositorySourceScanner';

interface FakeFile {
  content?: string;
  size?: number;
  metadataError?: unknown;
  readError?: unknown;
  binary?: boolean;
  truncated?: boolean;
}

function fakeRepository(records: Record<string, FakeFile>): ApprovedRepositoryGateway {
  const files = Object.keys(records);
  return {
    approvedRoot: '/approved/repository',
    listFiles: jest.fn(() => [...files]),
    describePath: jest.fn((file: string) => {
      const record = records[file];
      if (record.metadataError !== undefined) throw record.metadataError;
      return {
        path: file,
        size: record.size ?? Buffer.byteLength(record.content || ''),
        kind: 'file'
      };
    }),
    readTextFile: jest.fn((file: string) => {
      const record = records[file];
      if (record.binary) {
        throw new RepositoryAccessError('BINARY_FILE', `binary: ${file}`);
      }
      if (record.readError !== undefined) throw record.readError;
      const content = record.content || '';
      return {
        path: file,
        content,
        size: record.size ?? Buffer.byteLength(content),
        truncated: record.truncated === true
      };
    })
  } as unknown as ApprovedRepositoryGateway;
}

function registry(): LanguageCapabilityRegistry {
  return {
    detect: jest.fn((files: string[]) => ({
      languages: /\.ts$/i.test(files[0])
        ? [{ language: 'typescript', confidence: 1, reasons: ['fixture'], files }]
        : [],
      frameworks: [],
      conflicts: []
    }))
  } as unknown as LanguageCapabilityRegistry;
}

function limits(overrides: Partial<ArchitectureLimits> = {}): ArchitectureLimits {
  return {
    maxFiles: 20,
    maxFileBytes: 100,
    maxTotalBytes: 10_000,
    maxSymbols: 1,
    maxEdges: 100,
    maxPathDepth: 2,
    maxTraversalDepth: 5,
    maxTraversalNodes: 100,
    includeGenerated: false,
    ...overrides
  };
}

function indexer(): ArchitectureSymbolIndexer {
  return {
    parserVersion: 'coverage-parser-v1',
    indexContentWithReport: jest.fn((file: string) => {
      if (file === 'k-unparsed.ts') return { parser: 'unparsed', symbols: [] };
      return {
        parser: 'tree-sitter:typescript:recovery',
        symbols: [
          {
            kind: 'function',
            name: 'first',
            file,
            line: 1,
            confidence: 0.8,
            parser: 'tree-sitter:typescript:recovery'
          },
          {
            kind: 'function',
            name: 'second',
            file,
            line: 2,
            confidence: 0.6,
            parser: 'tree-sitter:typescript:recovery'
          }
        ]
      };
    })
  };
}

describe('RepositorySourceScanner failure and resource boundaries', () => {
  it('reports generated, depth, metadata, size, binary, read, truncation, and symbol conditions', () => {
    const repository = fakeRepository({
      'a-generated.generated.ts': { content: 'export const generated = true;' },
      'b/deep/file.ts': { content: 'export const deep = true;' },
      'c-meta.ts': { metadataError: new Error('metadata unavailable') },
      'd-large.ts': { size: 101, content: 'large' },
      'e-binary.dat': { size: 4, binary: true },
      'f-fail.ts': { content: 'fail', readError: new Error('read unavailable') },
      'g-unknown.ts': { content: 'fail', readError: 42 },
      'h-truncated.ts': { content: 'partial', truncated: true },
      'i-source.ts': { content: 'export function first() {}\nexport function second() {}' },
      'j-not-indexable.png': { content: 'plain text fixture' },
      'k-unparsed.ts': { content: 'const value = 1;' }
    });
    const cache = new RepositoryArchitectureCache();
    const scanner = new RepositorySourceScanner('/ignored', limits(), {
      repository,
      indexer: indexer(),
      registry: registry(),
      cache
    });

    const first = scanner.scan();
    const second = scanner.scan();
    const codes = first.warnings.map(warning => warning.code);

    expect(codes).toEqual(expect.arrayContaining([
      'PATH_DEPTH_LIMIT_REACHED',
      'FILE_METADATA_FAILED',
      'FILE_TOO_LARGE',
      'BINARY_FILE_SKIPPED',
      'FILE_READ_FAILED',
      'SYMBOL_LIMIT_REACHED'
    ]));
    expect(first.generatedFilesSkipped).toBe(1);
    expect(first.binaryFilesSkipped).toBe(1);
    expect(first.truncated).toBe(true);
    expect(first.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'd-large.ts', parsed: false }),
      expect.objectContaining({ path: 'e-binary.dat', binary: true }),
      expect.objectContaining({ path: 'i-source.ts', parsed: true }),
      expect.objectContaining({ path: 'j-not-indexable.png', parsed: false }),
      expect.objectContaining({ path: 'k-unparsed.ts', parser: 'unparsed' })
    ]));
    expect(first.parserHealth).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parser: 'tree-sitter:typescript:recovery',
        fallback: true,
        symbols: 1,
        averageConfidence: 0.8
      }),
      expect.objectContaining({
        parser: 'unparsed',
        fallback: false,
        failures: 1,
        averageConfidence: 0
      })
    ]));
    expect(second.cache.hits).toBeGreaterThan(first.cache.hits);
    expect(scanner.approvedRoot).toBe('/approved/repository');
    expect(scanner.cacheStats().entries).toBeGreaterThan(0);
    scanner.clearCache();
    expect(scanner.cacheStats()).toEqual({
      hits: 0,
      misses: 0,
      entries: 0,
      parserVersion: 'coverage-parser-v1'
    });
  });

  it('reports discovery and analyzed-file limits independently', () => {
    const repository = fakeRepository({
      'a.ts': { content: 'export const a = 1;' },
      'b.ts': { content: 'export const b = 1;' },
      'c.ts': { content: 'export const c = 1;' },
      'd.ts': { content: 'export const d = 1;' },
      'e.ts': { content: 'export const e = 1;' }
    });
    const scanner = new RepositorySourceScanner('/ignored', limits({
      maxFiles: 1,
      maxSymbols: 10,
      maxPathDepth: 10
    }), {
      repository,
      indexer: indexer(),
      registry: registry()
    });

    const result = scanner.scan();
    expect(result.files).toHaveLength(1);
    expect(result.filesDiscovered).toBe(5);
    expect(result.truncated).toBe(true);
    expect(result.warnings.map(warning => warning.code)).toEqual(expect.arrayContaining([
      'DISCOVERY_LIMIT_REACHED',
      'FILE_LIMIT_REACHED'
    ]));
  });

  it('stops before reading a file that would exceed the total-byte budget', () => {
    const repository = fakeRepository({
      'a.ts': { content: 'abc', size: 3 },
      'b.ts': { content: 'defg', size: 4 }
    });
    const scanner = new RepositorySourceScanner('/ignored', limits({
      maxTotalBytes: 5,
      maxSymbols: 10,
      maxPathDepth: 10
    }), {
      repository,
      indexer: indexer(),
      registry: registry()
    });

    const result = scanner.scan();
    expect(result.bytesRead).toBe(3);
    expect(result.files.map(file => file.path)).toEqual(['a.ts']);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TOTAL_BYTES_LIMIT_REACHED', file: 'b.ts' })
    ]));
  });
});
