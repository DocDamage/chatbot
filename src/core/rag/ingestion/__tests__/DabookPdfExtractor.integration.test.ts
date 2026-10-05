/**
 * Integration tests that run real code end to end.
 *
 *  - Fallback test: always runs. A generated PDF goes through the real pdf-parse extractor when
 *    DABOOK cannot run, proving "broken DABOOK == today's behaviour plus a warning".
 *  - Live test: only with DABOOK_LIVE_TEST=1 and an installed DABOOK (`npm run setup:dabook`).
 *    It ingests a generated PDF through DocumentManager.addFile (what POST /api/knowledge-base/file
 *    calls) and asserts the chunks carry pages and breadcrumbs and keep stable ids.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DabookBridge } from '../../../dabook';
import { managedVenvPython } from '../../../dabook/DabookConfig';
import { resetDabookBridgeForTests } from '../../../dabook';
import { sampleHandbookPdf } from '../../../dabook/__tests__/pdfFixture';
import { Database } from '../../../database/Database';
import { DocumentManager } from '../../DocumentManager';
import { RAGDocumentStore } from '../../RAGDocumentStore';
import { DabookPdfExtractor } from '../DabookPdfExtractor';

describe('DabookPdfExtractor against a real PDF (no Python needed)', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabook-fallback-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('falls back to real pdf-parse extraction with a visible warning when the interpreter is missing', async () => {
    const pdf = path.join(dir, 'handbook.pdf');
    fs.writeFileSync(pdf, sampleHandbookPdf());
    const bridge = new DabookBridge({
      config: {
        enabled: true,
        workspace: path.join(dir, 'ws'),
        profile: 'balanced',
        timeoutMs: 30_000,
        dashboard: false,
        interpreterCandidates: [{ source: 'DABOOK_PYTHON', path: path.join(dir, 'missing-python.exe') }],
        warnings: []
      }
    });

    const doc = await new DabookPdfExtractor(bridge).extract(pdf);

    expect(doc.text).toContain('recovery tool scans the partition table');
    expect(doc.sections).toBeUndefined();
    expect(doc.warnings?.some(w => w.startsWith('dabook-fallback: interpreter_not_found'))).toBe(true);
    expect(doc.metadata).toMatchObject({ type: 'pdf', extractor: 'pdf-parse', structured: false, pages: 2 });
  });
});

const liveEnabled = process.env.DABOOK_LIVE_TEST === '1' && fs.existsSync(managedVenvPython());
const liveDescribe = liveEnabled ? describe : describe.skip;

liveDescribe('DABOOK live ingestion (DABOOK_LIVE_TEST=1)', () => {
  jest.setTimeout(180_000);
  const saved = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabook-live-'));
    process.env.DABOOK_ENABLED = 'true';
    process.env.DABOOK_WORKSPACE = path.join(dir, 'ws');
    resetDabookBridgeForTests();
  });

  afterEach(() => {
    process.env = { ...saved };
    resetDabookBridgeForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('ingests a PDF into structure-aware chunks with pages, breadcrumbs and stable ids', async () => {
    const pdf = path.join(dir, 'handbook.pdf');
    fs.writeFileSync(pdf, sampleHandbookPdf());
    // A real SQLite store: foreign keys and replace-by-source semantics are part of what is tested.
    const db = new Database({ type: 'sqlite', filePath: path.join(dir, 'chatbot.db') });
    await db.initialize();
    const store = new RAGDocumentStore(db);
    const manager = new DocumentManager({ addDocuments: jest.fn() } as any, undefined, store);

    const first = await manager.addFile(pdf, { generateEmbeddings: false });
    await expect(store.loadChunks()).resolves.toHaveLength(first.length);

    expect(first.length).toBeGreaterThan(0);
    for (const chunk of first) {
      expect(chunk.metadata).toMatchObject({ extractor: 'dabook', structured: true, type: 'pdf' });
      expect(chunk.id).toMatch(/^dabook:[0-9a-f]{12}:/);
      expect(chunk.metadata.page).toBeGreaterThanOrEqual(1);
      expect(chunk.metadata.page).toBeLessThanOrEqual(2);
    }
    expect(first.some(chunk => (chunk.metadata.breadcrumbs as string[]).includes('Partition Recovery Basics'))).toBe(true);
    expect(first.some(chunk => String(chunk.metadata.section).includes('Using the Command Line'))).toBe(true);

    const started = Date.now();
    const second = await manager.addFile(pdf, { generateEmbeddings: false });
    expect(second.map(c => c.id)).toEqual(first.map(c => c.id)); // re-ingest is idempotent
    expect(Date.now() - started).toBeLessThan(15_000); // content-addressed cache hit
    await expect(store.loadChunks()).resolves.toHaveLength(first.length); // updated in place, not duplicated
    const { sources } = await store.listSources({ limit: 10 });
    expect(sources).toHaveLength(1);
    expect(sources[0].metadata).toMatchObject({ extractor: 'dabook' });
    await db.close();
  });
});
