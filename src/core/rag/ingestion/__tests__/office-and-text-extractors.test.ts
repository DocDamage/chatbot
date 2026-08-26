import fs from 'fs';
import os from 'os';
import path from 'path';
import { OfficeExtractor } from '../OfficeExtractor';
import { MobiExtractor } from '../MobiExtractor';
import { TextLikeExtractor } from '../TextLikeExtractor';
import { HtmlExtractor } from '../HtmlExtractor';
import { RtfExtractor } from '../RtfExtractor';

describe('B75-04: Office and Specialized Text Extractors Decision Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extractors-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('TextLikeExtractor', () => {
    it('extracts .txt, .md, and .json files with correct types', async () => {
      const extractor = new TextLikeExtractor();

      expect(extractor.canExtract('.txt')).toBe(true);
      expect(extractor.canExtract('.md')).toBe(true);
      expect(extractor.canExtract('.json')).toBe(true);
      expect(extractor.canExtract('.pdf')).toBe(false);

      // Plain text
      const txtPath = path.join(tempDir, 'sample.txt');
      fs.writeFileSync(txtPath, 'Hello plain text', 'utf8');
      const txtDoc = await extractor.extract(txtPath);
      expect(txtDoc.text).toBe('Hello plain text');
      expect(txtDoc.metadata.type).toBe('text');

      // Markdown
      const mdPath = path.join(tempDir, 'guide.md');
      fs.writeFileSync(mdPath, '# Title\nMarkdown content', 'utf8');
      const mdDoc = await extractor.extract(mdPath);
      expect(mdDoc.metadata.type).toBe('markdown');

      // JSON object
      const jsonPath = path.join(tempDir, 'data.json');
      fs.writeFileSync(jsonPath, JSON.stringify({ key: 'value' }), 'utf8');
      const jsonDoc = await extractor.extract(jsonPath);
      expect(jsonDoc.metadata.type).toBe('json');
      expect(jsonDoc.text).toContain('"key": "value"');

      // JSON string primitive
      const jsonStrPath = path.join(tempDir, 'string.json');
      fs.writeFileSync(jsonStrPath, JSON.stringify('Simple JSON String'), 'utf8');
      const jsonStrDoc = await extractor.extract(jsonStrPath);
      expect(jsonStrDoc.text).toBe('Simple JSON String');
    });
  });

  describe('HtmlExtractor & RtfExtractor', () => {
    it('HtmlExtractor strips script and style tags', async () => {
      const extractor = new HtmlExtractor();

      expect(extractor.canExtract('.html')).toBe(true);
      expect(extractor.canExtract('.htm')).toBe(true);
      expect(extractor.canExtract('.txt')).toBe(false);

      const htmlPath = path.join(tempDir, 'page.html');
      fs.writeFileSync(htmlPath, '<html><head><style>body { color: red; }</style></head><body><h1>Hello</h1><script>alert(1)</script><p>World</p></body></html>', 'utf8');

      const doc = await extractor.extract(htmlPath);
      expect(doc.text).toContain('Hello');
      expect(doc.text).toContain('World');
      expect(doc.text).not.toContain('alert(1)');
      expect(doc.text).not.toContain('color: red');
    });

    it('RtfExtractor extracts text and strips control codes', async () => {
      const extractor = new RtfExtractor();

      expect(extractor.canExtract('.rtf')).toBe(true);
      expect(extractor.canExtract('.doc')).toBe(false);

      const rtfPath = path.join(tempDir, 'sample.rtf');
      fs.writeFileSync(rtfPath, '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Courier;}} \\f0\\fs24 Hello from RTF!}', 'utf8');

      const doc = await extractor.extract(rtfPath);
      expect(doc.text).toContain('Hello from RTF!');
    });
  });

  describe('MobiExtractor', () => {
    it('MobiExtractor checks extensions and handles missing/corrupt mobi files', async () => {
      const extractor = new MobiExtractor();

      expect(extractor.canExtract('.mobi')).toBe(true);
      expect(extractor.canExtract('.azw3')).toBe(true);
      expect(extractor.canExtract('.pdf')).toBe(false);

      // Non-existent file error handling
      const result = await extractor.extract(path.join(tempDir, 'non-existent.mobi'));
      expect(result.text).toBe('');
      expect(result.metadata.error).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('OfficeExtractor', () => {
    it('OfficeExtractor checks extensions and handles disabled conversion and fallback modes', async () => {
      const extractor = new OfficeExtractor();

      expect(extractor.canExtract('.docx')).toBe(true);
      expect(extractor.canExtract('.doc')).toBe(true);
      expect(extractor.canExtract('.pdf')).toBe(false);

      // Dummy docx file
      const docxPath = path.join(tempDir, 'sample.docx');
      fs.writeFileSync(docxPath, 'dummy binary docx data');

      // Disabled office conversion
      const disabledDoc = await extractor.extract(docxPath, { enableOfficeConversion: false });
      expect(disabledDoc.text).toBe('');
      expect(disabledDoc.warnings).toBeDefined();

      // Dummy doc file (legacy strings fallback)
      const docPath = path.join(tempDir, 'sample.doc');
      fs.writeFileSync(docPath, 'Readable string inside binary doc file for testing strings extraction fallback.');
      const docResult = await extractor.extract(docPath);
      expect(docResult).toBeDefined();
    });
  });
});
