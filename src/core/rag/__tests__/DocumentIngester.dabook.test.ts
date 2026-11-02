import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentIngester } from '../DocumentIngester';
import { DabookPdfExtractor } from '../ingestion/DabookPdfExtractor';
import { ExtractedDocument } from '../ingestion/ExtractedDocument';
import { FileTypeRouter } from '../ingestion/FileTypeRouter';
import { PdfExtractor } from '../ingestion/PdfExtractor';

describe('DocumentIngester with pre-chunked sections', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingester-dabook-'));
    file = path.join(dir, 'book.pdf');
    fs.writeFileSync(file, '%PDF-1.4');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const routerReturning = (document: ExtractedDocument) =>
    ({ extract: jest.fn().mockResolvedValue(document), getSupportedExtensions: () => ['.pdf'] }) as unknown as FileTypeRouter;

  const sectioned = (): ExtractedDocument => ({
    text: 'first section text\n\nsecond section text',
    metadata: { source: file, type: 'pdf', extractor: 'dabook', title: 'Book' },
    warnings: ['dabook: quality: sparse text'],
    sections: [
      { id: 'dabook:abc:c0', content: 'first section text', parentId: 'dabook:abc', metadata: { page: 3, section: 'Chapter 1', chunkIndex: 0, source: file } },
      { id: 'dabook:abc:c1', content: 'second section text', parentId: 'dabook:abc', metadata: { page: 4, section: 'Chapter 1 › Setup' } }
    ]
  });

  it('maps sections straight to chunks and never runs the word-window chunker', async () => {
    const ingester = new DocumentIngester(undefined, routerReturning(sectioned()));
    const chunkText = jest.spyOn(ingester as any, 'chunkText');

    const chunks = await ingester.ingestFile(file, { chunkSize: 5 }); // a tiny chunkSize must be ignored

    expect(chunkText).not.toHaveBeenCalled();
    expect(chunks.map(c => c.id)).toEqual(['dabook:abc:c0', 'dabook:abc:c1']);
    expect(chunks.map(c => c.content)).toEqual(['first section text', 'second section text']);
    expect(chunks.every(c => c.parentId === 'dabook:abc')).toBe(true);
  });

  it('layers file metadata under section metadata and numbers chunks when the section does not', async () => {
    const ingester = new DocumentIngester(undefined, routerReturning(sectioned()));
    const [first, second] = await ingester.ingestFile(file);

    expect(first.metadata).toMatchObject({
      source: file, type: 'pdf', extractor: 'dabook', title: 'Book',
      fileName: 'book.pdf', fileExtension: '.pdf', fileSizeBytes: 8,
      extractionWarnings: ['dabook: quality: sparse text'],
      page: 3, section: 'Chapter 1', chunkIndex: 0
    });
    expect(second.metadata).toMatchObject({ page: 4, section: 'Chapter 1 › Setup', chunkIndex: 1, fileName: 'book.pdf' });
  });

  it('still generates embeddings for pre-chunked sections', async () => {
    const embedBatch = jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
    const ingester = new DocumentIngester({ embedBatch } as any, routerReturning(sectioned()));

    const chunks = await ingester.ingestFile(file, { generateEmbeddings: true, embeddingProvider: 'xenova' });

    expect(embedBatch).toHaveBeenCalledWith(['first section text', 'second section text'], { provider: 'xenova', model: undefined });
    expect(chunks.map(c => c.embedding)).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('uses the word-window chunker when an extractor returns no sections (or an empty list)', async () => {
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    for (const sections of [undefined, []]) {
      const ingester = new DocumentIngester(undefined, routerReturning({ text, metadata: { source: file, type: 'pdf' }, sections }));
      const chunkText = jest.spyOn(ingester as any, 'chunkText');
      const chunks = await ingester.ingestFile(file, { chunkSize: 200 });
      expect(chunkText).toHaveBeenCalledTimes(1);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].id).toBe(`${file}-chunk-0`);
    }
  });
});

describe('FileTypeRouter registration', () => {
  const original = process.env.DABOOK_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.DABOOK_ENABLED;
    else process.env.DABOOK_ENABLED = original;
  });

  const extractorsOf = (router: FileTypeRouter): unknown[] => (router as any).extractors;

  it('does not register DABOOK by default (behaviour is identical to today)', () => {
    delete process.env.DABOOK_ENABLED;
    const extractors = extractorsOf(new FileTypeRouter());
    expect(extractors.some(e => e instanceof DabookPdfExtractor)).toBe(false);
    expect(extractors.some(e => e instanceof PdfExtractor)).toBe(true);
  });

  it('registers DABOOK ahead of pdf-parse when DABOOK_ENABLED=true', () => {
    process.env.DABOOK_ENABLED = 'true';
    const extractors = extractorsOf(new FileTypeRouter());
    const dabook = extractors.findIndex(e => e instanceof DabookPdfExtractor);
    const flat = extractors.findIndex(e => e instanceof PdfExtractor);
    expect(dabook).toBeGreaterThanOrEqual(0);
    expect(dabook).toBeLessThan(flat);
  });

  it('routes a PDF to the DABOOK extractor when enabled, and respects an injected extractor list', async () => {
    process.env.DABOOK_ENABLED = 'true';
    const structured = { canExtract: (ext: string) => ext === '.pdf', extract: jest.fn().mockResolvedValue({ text: 'x', metadata: {} }) };
    const router = new FileTypeRouter([structured]);
    await router.extract('book.pdf', { preferStructuredPdf: true });
    expect(structured.extract).toHaveBeenCalledWith('book.pdf', { preferStructuredPdf: true });
  });
});
