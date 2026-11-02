import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');
import { EpubExtractor } from '../EpubExtractor';

describe('B75-08: EpubExtractor Deep Matrix and Error Branch Suite', () => {
  let tempDir: string;
  let extractor: EpubExtractor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-matrix-test-'));
    extractor = new EpubExtractor();
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

  it('verifies canExtract file extension check', () => {
    expect(extractor.canExtract('.epub')).toBe(true);
    expect(extractor.canExtract('.pdf')).toBe(false);
    expect(extractor.canExtract('.txt')).toBe(false);
  });

  it('extracts structured content, chapters, and metadata from valid EPUB archive', async () => {
    const epubPath = path.join(tempDir, 'valid-book.epub');
    const zip = new AdmZip();

    // 1. META-INF/container.xml
    const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.addFile('META-INF/container.xml', Buffer.from(containerXml, 'utf8'));

    // 2. OEBPS/content.opf
    const opfXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test EPUB Novel</dc:title>
    <dc:creator>Jane Doe</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Test House</dc:publisher>
    <dc:date>2024-01-01</dc:date>
    <dc:identifier id="BookId">urn:uuid:12345</dc:identifier>
  </metadata>
  <manifest>
    <item id="chap1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chap2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chap1"/>
    <itemref idref="chap2"/>
  </spine>
</package>`;
    zip.addFile('OEBPS/content.opf', Buffer.from(opfXml, 'utf8'));

    // 3. Chapters
    const chap1Html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter 1: The Beginning</h1>
  <p>It was a dark and stormy night when the journey began.</p>
</body>
</html>`;
    const chap2Html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body>
  <h2>Chapter 2: The Crossroads</h2>
  <p>Two roads diverged in a yellow wood.</p>
</body>
</html>`;
    zip.addFile('OEBPS/chapter1.xhtml', Buffer.from(chap1Html, 'utf8'));
    zip.addFile('OEBPS/chapter2.xhtml', Buffer.from(chap2Html, 'utf8'));

    zip.writeZip(epubPath);

    const doc = await extractor.extract(epubPath);
    expect(doc.text).toContain('The Beginning');
    expect(doc.text).toContain('The Crossroads');
    expect(doc.metadata.title).toBe('Test EPUB Novel');
    expect(doc.metadata.author).toBe('Jane Doe');
    expect(doc.metadata.publisher).toBe('Test House');
    expect(doc.metadata.chapters).toBe(2);
  });

  it('handles corrupted, incomplete, or invalid EPUB archives gracefully', async () => {
    // Missing container.xml
    const badEpub1 = path.join(tempDir, 'no-container.epub');
    const zip1 = new AdmZip();
    zip1.addFile('dummy.txt', Buffer.from('hello', 'utf8'));
    zip1.writeZip(badEpub1);

    const doc1 = await extractor.extract(badEpub1);
    expect(doc1.text).toBe('');
    expect(doc1.metadata.error).toBeDefined();
    expect(doc1.warnings?.length).toBeGreaterThan(0);

    // Missing OPF package document
    const badEpub2 = path.join(tempDir, 'no-opf.epub');
    const zip2 = new AdmZip();
    zip2.addFile('META-INF/container.xml', Buffer.from('<container><rootfiles><rootfile full-path="missing.opf"/></rootfiles></container>', 'utf8'));
    zip2.writeZip(badEpub2);

    const doc2 = await extractor.extract(badEpub2);
    expect(doc2.metadata.error).toBeDefined();

    // Non-zip file
    const invalidFile = path.join(tempDir, 'not-a-zip.epub');
    fs.writeFileSync(invalidFile, 'plain text content not a zip', 'utf8');
    const doc3 = await extractor.extract(invalidFile);
    expect(doc3.metadata.error).toBeDefined();
  });
});
