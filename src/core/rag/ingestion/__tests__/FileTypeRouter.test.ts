import { FileTypeRouter } from '../FileTypeRouter';
import { TextLikeExtractor } from '../TextLikeExtractor';
import { HtmlExtractor } from '../HtmlExtractor';
import { RtfExtractor } from '../RtfExtractor';
import { MobiExtractor } from '../MobiExtractor';
import { EpubExtractor } from '../EpubExtractor';
import { OfficeExtractor } from '../OfficeExtractor';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('RT-ROUT-001: FileTypeRouter & Specialized Document Extractors Suite', () => {
  let tempDir: string;
  let router: FileTypeRouter;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-test-'));
    router = new FileTypeRouter();
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('lists all supported file extensions', () => {
    const exts = router.getSupportedExtensions();
    expect(exts).toContain('.txt');
    expect(exts).toContain('.md');
    expect(exts).toContain('.json');
    expect(exts).toContain('.html');
    expect(exts).toContain('.rtf');
    expect(exts).toContain('.pdf');
    expect(exts).toContain('.epub');
    expect(exts).toContain('.docx');
    expect(exts).toContain('.png');
  });

  it('extracts plaintext, markdown, and json using TextLikeExtractor', async () => {
    const txtPath = path.join(tempDir, 'sample.txt');
    const mdPath = path.join(tempDir, 'sample.md');
    const jsonPath = path.join(tempDir, 'sample.json');

    fs.writeFileSync(txtPath, 'Hello Plaintext World');
    fs.writeFileSync(mdPath, '# Markdown Heading\n\nContent paragraph');
    fs.writeFileSync(jsonPath, JSON.stringify({ key: 'value', number: 123 }));

    const txtRes = await router.extract(txtPath);
    expect(txtRes.text).toBe('Hello Plaintext World');
    expect(txtRes.metadata.type).toBe('text');

    const mdRes = await router.extract(mdPath);
    expect(mdRes.text).toContain('Markdown Heading');
    expect(mdRes.metadata.type).toBe('markdown');

    const jsonRes = await router.extract(jsonPath);
    expect(jsonRes.text).toContain('"key": "value"');
    expect(jsonRes.metadata.type).toBe('json');
  });

  it('extracts HTML content and strips styles/scripts using HtmlExtractor', async () => {
    const htmlPath = path.join(tempDir, 'page.html');
    fs.writeFileSync(htmlPath, `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page Title</title><style>body { color: red; }</style></head>
        <body>
          <script>console.log('secret');</script>
          <h1>Main Article Heading</h1>
          <p>This is the first paragraph describing the system.</p>
          <ul><li>List item 1</li><li>List item 2</li></ul>
        </body>
      </html>
    `);

    const res = await router.extract(htmlPath);
    expect(res.metadata.title).toBe('Test Page Title');
    expect(res.text).toContain('Main Article Heading');
    expect(res.text).toContain('first paragraph');
    expect(res.text).not.toContain('console.log');
  });

  it('extracts RTF formatting to clean text using RtfExtractor', async () => {
    const rtfPath = path.join(tempDir, 'document.rtf');
    fs.writeFileSync(rtfPath, '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}} \\f0\\fs24 Hello \\b Bold\\b0 World!\\par Second Line.}');

    const res = await router.extract(rtfPath);
    expect(res.metadata.type).toBe('rtf');
    expect(res.text).toContain('Hello Bold World!');
    expect(res.text).toContain('Second Line.');
  });

  it('extracts DOCX office documents using OfficeExtractor', async () => {
    const docxExtractor = new OfficeExtractor();
    expect(docxExtractor.canExtract('.docx')).toBe(true);
    expect(docxExtractor.canExtract('.doc')).toBe(true);
    expect(docxExtractor.canExtract('.txt')).toBe(false);

    const docxPath = path.join(tempDir, 'dummy.docx');
    fs.writeFileSync(docxPath, 'not-a-real-zip-doc');

    const res = await docxExtractor.extract(docxPath);
    expect(res.metadata.source).toBe(docxPath);
  });

  it('handles fallback text extractor when extension is unrecognized', async () => {
    const customPath = path.join(tempDir, 'sample.customext');
    fs.writeFileSync(customPath, 'Unrecognized format content');

    const res = await router.extract(customPath);
    expect(res.text).toBe('Unrecognized format content');
    expect(res.metadata.extractor).toBe('fallback-text');
  });
});
