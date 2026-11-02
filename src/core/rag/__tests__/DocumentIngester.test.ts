import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentIngester } from '../DocumentIngester';
import { FileTypeRouter } from '../ingestion/FileTypeRouter';

describe('DocumentIngester', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-ingester-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('ingests markdown files through the file type router', async () => {
    const filePath = path.join(tempDir, 'guide.md');
    fs.writeFileSync(filePath, '# Guide\n\nRAGService orchestrates retrieval and response generation.', 'utf-8');

    const ingester = new DocumentIngester();
    const chunks = await ingester.ingestFile(filePath, {
      generateEmbeddings: false,
      chunkSize: 500
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('RAGService orchestrates retrieval');
    expect(chunks[0].metadata.source).toBe(filePath);
    expect(chunks[0].metadata.type).toBe('markdown');
  });

  it('advertises multimodal and office extensions', () => {
    const router = new FileTypeRouter();
    expect(router.getSupportedExtensions()).toEqual(expect.arrayContaining([
      '.txt',
      '.md',
      '.json',
      '.pdf',
      '.epub',
      '.docx',
      '.doc',
      '.png',
      '.jpg',
      '.jpeg',
      '.bmp',
      '.gif'
    ]));
  });

  it('extracts EPUB books with metadata and chapter text', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AdmZip = require('adm-zip');
    const filePath = path.join(tempDir, 'minimal.epub');
    const zip = new AdmZip();
    zip.addFile('mimetype', Buffer.from('application/epub+zip'));
    zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`));
    zip.addFile('OPS/package.opf', Buffer.from(`<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Minimal Book</dc:title>
          <dc:creator>Test Author</dc:creator>
          <dc:language>en</dc:language>
        </metadata>
        <manifest>
          <item id="chapter-1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="chapter-1"/>
        </spine>
      </package>`));
    zip.addFile('OPS/chapter1.xhtml', Buffer.from(`<?xml version="1.0"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head><title>Opening</title></head>
        <body>
          <h1>Opening</h1>
          <p>The archive city remembers every borrowed book.</p>
        </body>
      </html>`));
    zip.writeZip(filePath);

    const ingester = new DocumentIngester();
    const chunks = await ingester.ingestFile(filePath, {
      generateEmbeddings: false,
      chunkSize: 500
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('archive city remembers');
    expect(chunks[0].metadata).toMatchObject({
      source: filePath,
      title: 'Minimal Book',
      author: 'Test Author',
      language: 'en',
      type: 'epub',
      chapters: 1
    });
  });

  it('returns a diagnostic chunk when office conversion is disabled and no text can be extracted', async () => {
    const filePath = path.join(tempDir, 'legacy.doc');
    fs.writeFileSync(filePath, 'not a real binary Word document', 'utf-8');

    const ingester = new DocumentIngester();
    const chunks = await ingester.ingestFile(filePath, {
      generateEmbeddings: false,
      enableOfficeConversion: false
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('Extraction warning');
    expect(chunks[0].metadata.type).toBe('doc');
    expect(chunks[0].metadata.emptyExtraction).toBe(true);
    expect(chunks[0].metadata.extractionWarnings).toEqual(expect.arrayContaining(['Office conversion disabled']));
  });

  it('recursively ingests supported files from nested directories', async () => {
    const nestedDir = path.join(tempDir, 'characters', 'allies');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'overview.md'), 'The project brief explains the main RAG flow.', 'utf-8');
    fs.writeFileSync(path.join(nestedDir, 'ronin.md'), 'Ronin is a playable character with a silence ability.', 'utf-8');

    const ingester = new DocumentIngester();
    const chunks = await ingester.ingestDirectory(tempDir, {
      generateEmbeddings: false,
      chunkSize: 500
    });

    expect(chunks.map(chunk => chunk.content)).toEqual(expect.arrayContaining([
      expect.stringContaining('project brief'),
      expect.stringContaining('Ronin is a playable character')
    ]));
    expect(chunks.map(chunk => chunk.metadata.source)).toEqual(expect.arrayContaining([
      path.join(tempDir, 'overview.md'),
      path.join(nestedDir, 'ronin.md')
    ]));
  });

  it('ingests raw text directly and generates embeddings in batches', async () => {
    const mockEmbeddings: any = {
      embedBatch: jest.fn().mockResolvedValue([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6]
      ])
    };

    const ingester = new DocumentIngester(mockEmbeddings);
    const longText = 'Word '.repeat(200); // multiple chunks
    const chunks = await ingester.ingestText(longText, { title: 'Raw Text' }, {
      chunkSize: 100,
      chunkOverlap: 20,
      generateEmbeddings: true,
      embeddingBatchSize: 1
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbeddings.embedBatch).toHaveBeenCalled();
  });

  it('handles empty text fallback and directory read error gracefully', async () => {
    const ingester = new DocumentIngester();
    const emptyChunks = await ingester.ingestText('', { source: 'empty.txt', error: 'Custom error message' });
    expect(emptyChunks).toHaveLength(1);
    expect(emptyChunks[0].metadata.emptyExtraction).toBe(true);
    expect(emptyChunks[0].content).toContain('Custom error message');
  });
});
