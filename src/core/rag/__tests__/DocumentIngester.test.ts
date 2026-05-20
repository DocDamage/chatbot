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
      '.docx',
      '.doc',
      '.png',
      '.jpg',
      '.jpeg',
      '.bmp',
      '.gif'
    ]));
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
});
