import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { KnowledgeGraphIndexer } from '../KnowledgeGraphIndexer';

describe('B75-08: KnowledgeGraphIndexer Deep Matrix and Storage Dialect Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-indexer-test-'));
    // Create sample repo files
    fs.writeFileSync(
      path.join(tempDir, 'sample.ts'),
      'import { helper } from "./helper";\nexport class Worker {\n  work() {}\n}\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'README.md'),
      '# Sample Project\nThis is a sample project using TypeScript and Node.js.\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      '{"name": "sample-pkg", "version": "1.0.0"}',
      'utf8'
    );
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('indexes repository workspace and RAG document store with entity linking', async () => {
    const mockRagStore: any = {
      searchKeyword: jest.fn().mockResolvedValue([
        {
          chunk: {
            id: 'chunk_1',
            content: 'Docker containerization and Kubernetes orchestration guide.',
            metadata: { source: 'docs/k8s.md', title: 'Kubernetes Guide' }
          }
        }
      ]),
      loadChunks: jest.fn().mockResolvedValue([
        {
          id: 'chunk_2',
          content: 'Database indexing and query execution plans.',
          metadata: { source: 'docs/db.md', title: 'Database Guide' }
        }
      ])
    };

    const indexer = new KnowledgeGraphIndexer({
      workspaceRoot: tempDir,
      ragDocumentStore: mockRagStore,
      maxFiles: 10
    });

    // Build with query
    const indexWithQuery = await indexer.build({
      includeRepo: true,
      includeRag: true,
      query: 'Kubernetes'
    });
    expect(indexWithQuery.nodes.length).toBeGreaterThan(0);
    expect(indexWithQuery.edges.length).toBeGreaterThan(0);
    expect(indexWithQuery.stats.files).toBeGreaterThan(0);

    // Build without query
    const indexFull = await indexer.build({
      includeRepo: true,
      includeRag: true
    });
    expect(indexFull.nodes.length).toBeGreaterThan(0);
  });

  it('persists graph index to sqlite and postgresql database targets and retrieves stats', async () => {
    // SQLite target
    const sqliteQueries: Array<{ sql: string; params: any[] }> = [];
    const mockSqliteDb: any = {
      getType: () => 'sqlite',
      query: jest.fn().mockImplementation((sql, params) => {
        sqliteQueries.push({ sql, params });
        return Promise.resolve({ rows: [{ count: '5' }] });
      })
    };

    const sqliteIndexer = new KnowledgeGraphIndexer({
      workspaceRoot: tempDir,
      database: mockSqliteDb
    });

    const index = await sqliteIndexer.build({ includeRepo: true, includeRag: false });
    const persistedSqlite = await sqliteIndexer.persist(index);
    expect(persistedSqlite.nodes).toBe(index.nodes.length);
    expect(sqliteQueries.some(q => q.sql.includes('INSERT OR REPLACE'))).toBe(true);

    const stats = await sqliteIndexer.stats();
    expect(stats.nodes).toBe(5);

    // PostgreSQL target
    const pgQueries: Array<{ sql: string; params: any[] }> = [];
    const mockPgDb: any = {
      getType: () => 'postgresql',
      query: jest.fn().mockImplementation((sql, params) => {
        pgQueries.push({ sql, params });
        return Promise.resolve({ rows: [{ count: '10' }] });
      })
    };

    const pgIndexer = new KnowledgeGraphIndexer({
      workspaceRoot: tempDir,
      database: mockPgDb
    });

    const persistedPg = await pgIndexer.persist(index);
    expect(persistedPg.nodes).toBe(index.nodes.length);
    expect(pgQueries.some(q => q.sql.includes('ON CONFLICT'))).toBe(true);
  });
});
