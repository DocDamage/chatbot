import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from './Database';
import { ensureExpansionDatabase } from './ExpansionDatabase';

describe('SEC expansion migrations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-expansion-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates the SEC ingestion queue table and indexes', async () => {
    const db = new Database({
      type: 'sqlite',
      filePath: path.join(tempDir, 'chatbot.db')
    });

    await db.initialize();
    await ensureExpansionDatabase(db);

    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      ['sec_ingestion_queue']
    );
    const indexes = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (?, ?)",
      ['idx_sec_ingestion_queue_status_run', 'idx_sec_ingestion_queue_cik']
    );

    expect(tables.rows.map(row => row.name)).toEqual(['sec_ingestion_queue']);
    expect(indexes.rows.map(row => row.name).sort()).toEqual([
      'idx_sec_ingestion_queue_cik',
      'idx_sec_ingestion_queue_status_run'
    ]);

    await db.close();
  });
});
