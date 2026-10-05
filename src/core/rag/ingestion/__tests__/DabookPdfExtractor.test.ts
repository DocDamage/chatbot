import { DabookBridge, DabookError } from '../../../dabook';
import { dabookRagRecordSchema } from '../../../dabook/DabookContract';
import { DabookPdfExtractor } from '../DabookPdfExtractor';
import { ExtractedDocument, FileExtractor } from '../ExtractedDocument';

const SHA = '1'.repeat(64);

const record = (n: number, extra: Record<string, unknown> = {}) => dabookRagRecordSchema.parse({
  chunk_id: `chunk_${n}`,
  book_sha256: SHA,
  book_title: 'Handbook',
  page_start: n + 1,
  page_end: n + 1,
  breadcrumbs: ['Chapter 1', `Section ${n}`],
  node_ids: [`p${n}_b0`],
  node_types: ['paragraph'],
  has_code: false,
  token_count: 20,
  quality: 0.95,
  content: `Body of chunk ${n}`,
  ...extra
});

const book = (extra: Record<string, unknown> = {}) => ({
  book_id: 1, sha256: SHA, source_path: 'C:/b.pdf', title: 'Handbook', pages: 8, doc_type: 'native' as const,
  state: 'done' as const, quality_score: 0.95, license_status: 'unknown' as const, warnings: [] as string[], error: null,
  datasets: { rag: 'books/x/rag.jsonl' }, counts: { rag: 2 }, ...extra
});

function fakeBridge(overrides: Partial<Record<'isEnabled' | 'ingest' | 'readRagRecords', jest.Mock>> = {}) {
  const bridge = {
    isEnabled: jest.fn().mockReturnValue(true),
    ingest: jest.fn().mockResolvedValue({
      book: book(),
      report: { schema: 'dabook.ingest.v1', dabook_version: '1.1.0', books: [book()] },
      workspace: 'W',
      durationMs: 1234,
      stderrTail: ''
    }),
    readRagRecords: jest.fn().mockResolvedValue([record(0), record(1)]),
    ...overrides
  };
  return bridge as unknown as DabookBridge & typeof bridge;
}

function fakeFallback(doc: Partial<ExtractedDocument> = {}): FileExtractor & { extract: jest.Mock } {
  return {
    canExtract: () => true,
    extract: jest.fn().mockResolvedValue({
      text: 'flat pdf-parse text',
      metadata: { source: 'C:/b.pdf', type: 'pdf' },
      ...doc
    })
  };
}

describe('DabookPdfExtractor', () => {
  it('only handles PDFs', () => {
    const extractor = new DabookPdfExtractor(fakeBridge(), fakeFallback());
    expect(extractor.canExtract('.pdf')).toBe(true);
    expect(extractor.canExtract('.epub')).toBe(false);
  });

  it('returns pre-chunked sections with citation metadata and no fallback warning', async () => {
    const bridge = fakeBridge();
    bridge.ingest.mockResolvedValueOnce({
      book: book({ warnings: ['quality: sparse text (30 words/page)'] }),
      report: { schema: 'dabook.ingest.v1', dabook_version: '1.1.0', books: [] },
      workspace: 'W',
      durationMs: 5,
      stderrTail: ''
    });
    const fallback = fakeFallback();
    const doc = await new DabookPdfExtractor(bridge, fallback).extract('C:/b.pdf');

    expect(fallback.extract).not.toHaveBeenCalled();
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections![0]).toMatchObject({
      id: `dabook:${SHA.slice(0, 12)}:chunk_0`,
      content: 'Body of chunk 0',
      metadata: { page: 1, section: 'Chapter 1 › Section 0', extractor: 'dabook', source: 'C:/b.pdf', bookKey: `dabook:${SHA.slice(0, 12)}` }
    });
    expect(doc.sections![0].parentId).toBeUndefined();
    expect(doc.text).toBe('Body of chunk 0\n\nBody of chunk 1');
    expect(doc.metadata).toMatchObject({
      source: 'C:/b.pdf', type: 'pdf', extractor: 'dabook', structured: true, pages: 8, qualityScore: 0.95,
      bookSha256: SHA, dabookVersion: '1.1.0'
    });
    expect(doc.warnings).toEqual(['dabook: quality: sparse text (30 words/page)']);
    expect(bridge.readRagRecords).toHaveBeenCalledTimes(1);
  });

  it('skips DABOOK entirely when preferStructuredPdf is false', async () => {
    const bridge = fakeBridge();
    const fallback = fakeFallback();
    const doc = await new DabookPdfExtractor(bridge, fallback).extract('C:/b.pdf', { preferStructuredPdf: false });
    expect(bridge.ingest).not.toHaveBeenCalled();
    expect(doc.text).toBe('flat pdf-parse text');
    expect(doc.warnings).toBeUndefined(); // identical to today's behaviour
  });

  it('falls back with a warning when DABOOK has been disabled since startup', async () => {
    const bridge = fakeBridge({ isEnabled: jest.fn().mockReturnValue(false) });
    const doc = await new DabookPdfExtractor(bridge, fakeFallback()).extract('C:/b.pdf');
    expect(bridge.ingest).not.toHaveBeenCalled();
    expect(doc.warnings).toEqual(['dabook-fallback: disabled: DABOOK is disabled']);
    expect(doc.metadata).toMatchObject({ extractor: 'pdf-parse', structured: false, dabookFallbackReason: 'disabled' });
  });

  describe('falls back to pdf-parse on every failure mode', () => {
    it.each([
      ['interpreter_not_found'],
      ['timeout'],
      ['failed'],
      ['lock_held'],
      ['bad_args'],
      ['bad_output'],
      ['spawn_error']
    ] as const)('%s', async reason => {
      const bridge = fakeBridge({ ingest: jest.fn().mockRejectedValue(new DabookError(reason, `${reason} happened`)) });
      const fallback = fakeFallback({ warnings: ['pdf-parse warning'] });
      const doc = await new DabookPdfExtractor(bridge, fallback).extract('C:/b.pdf', { enablePdfOcr: true });

      expect(fallback.extract).toHaveBeenCalledWith('C:/b.pdf', { enablePdfOcr: true });
      expect(doc.text).toBe('flat pdf-parse text');
      expect(doc.sections).toBeUndefined();
      expect(doc.warnings).toEqual(['pdf-parse warning', `dabook-fallback: ${reason}: ${reason} happened`]);
      expect(doc.metadata).toMatchObject({ extractor: 'pdf-parse', structured: false, dabookFallbackReason: reason });
      expect(doc.metadata.needsOcr).toBeUndefined();
    });

    it('a failure while reading the dataset', async () => {
      const bridge = fakeBridge({ readRagRecords: jest.fn().mockRejectedValue(new DabookError('bad_output', 'rag.jsonl line 2 is invalid')) });
      const doc = await new DabookPdfExtractor(bridge, fakeFallback()).extract('C:/b.pdf');
      expect(doc.metadata.dabookFallbackReason).toBe('bad_output');
      expect(doc.text).toBe('flat pdf-parse text');
    });

    it('an empty dataset (nothing worth retrieving)', async () => {
      const bridge = fakeBridge({ readRagRecords: jest.fn().mockResolvedValue([]) });
      const doc = await new DabookPdfExtractor(bridge, fakeFallback()).extract('C:/b.pdf');
      expect(doc.warnings?.[0]).toContain('no retrieval chunks');
    });

    it('a non-DABOOK exception', async () => {
      const bridge = fakeBridge({ ingest: jest.fn().mockRejectedValue(new Error('kaboom')) });
      const doc = await new DabookPdfExtractor(bridge, fakeFallback()).extract('C:/b.pdf');
      expect(doc.warnings).toEqual(['dabook-fallback: unexpected: kaboom']);
    });

    it('a non-Error rejection', async () => {
      const bridge = fakeBridge({ ingest: jest.fn().mockRejectedValue('plain string') });
      const doc = await new DabookPdfExtractor(bridge, fakeFallback()).extract('C:/b.pdf');
      expect(doc.warnings).toEqual(['dabook-fallback: unexpected: plain string']);
    });
  });

  describe('scanned PDFs (DABOOK exit code 2)', () => {
    const scanned = () => fakeBridge({ ingest: jest.fn().mockRejectedValue(new DabookError('needs_input', 'PDF has no text layer and needs OCR')) });

    it('flags needsOcr so the source lands in the OCR queue', async () => {
      const doc = await new DabookPdfExtractor(scanned(), fakeFallback({ text: '', metadata: { source: 'C:/b.pdf', needsOcr: true } })).extract('C:/b.pdf');
      expect(doc.metadata.needsOcr).toBe(true);
      expect(doc.metadata.dabookFallbackReason).toBe('needs_input');
    });

    it('sets needsOcr even when the fallback did not (still no text)', async () => {
      const doc = await new DabookPdfExtractor(scanned(), fakeFallback({ text: '   ', metadata: { source: 'C:/b.pdf' } })).extract('C:/b.pdf');
      expect(doc.metadata.needsOcr).toBe(true);
    });

    it('does not claim OCR is needed when the fallback pipeline recovered text itself', async () => {
      const doc = await new DabookPdfExtractor(scanned(), fakeFallback({ text: 'text recovered by pdf OCR', metadata: { source: 'C:/b.pdf', needsOcr: false } })).extract('C:/b.pdf');
      expect(doc.metadata.needsOcr).toBe(false);
      expect(doc.text).toBe('text recovered by pdf OCR');
    });
  });
});
