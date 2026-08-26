import { EpubExtractor } from '../EpubExtractor';
import { MobiExtractor } from '../MobiExtractor';
import * as path from 'path';

jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    getEntries: jest.fn().mockReturnValue([
      {
        entryName: 'META-INF/container.xml',
        getData: () => Buffer.from('<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>')
      },
      {
        entryName: 'OEBPS/content.opf',
        getData: () => Buffer.from(`
          <package>
            <metadata>
              <dc:title>Sample EPUB Ebook</dc:title>
              <dc:creator>Author Name</dc:creator>
              <dc:language>en</dc:language>
            </metadata>
            <manifest>
              <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
            </manifest>
            <spine>
              <itemref idref="ch1"/>
            </spine>
          </package>
        `)
      },
      {
        entryName: 'OEBPS/chapter1.xhtml',
        getData: () => Buffer.from('<html><body><h1>Chapter 1: The Beginning</h1><p>Once upon a time in software engineering.</p></body></html>')
      }
    ])
  }));
});

jest.mock('mobi', () => {
  return jest.fn().mockImplementation(() => ({
    title: 'Sample MOBI Ebook',
    content: '<html><body><h1>Mobi Heading</h1><p>Mobi content paragraph text.</p></body></html>',
    mobiHeader: {
      compression: 'PalmDOC',
      encoding: 'UTF-8',
      textRecordCount: 5
    }
  }));
});

describe('RT-EPUB-001: EpubExtractor and MobiExtractor Parsing Suite', () => {
  it('extracts chapters, metadata, and spine items from EPUB archive', async () => {
    const epub = new EpubExtractor();
    expect(epub.canExtract('.epub')).toBe(true);
    expect(epub.canExtract('.pdf')).toBe(false);

    const result = await epub.extract('test-book.epub');
    expect(result.text).toContain('Chapter 1: The Beginning');
    expect(result.text).toContain('Once upon a time');
    expect(result.metadata.title).toBe('Sample EPUB Ebook');
    expect(result.metadata.type).toBe('epub');
  });

  it('extracts HTML content and mobiHeader from unencrypted MOBI files', async () => {
    const mobi = new MobiExtractor();
    expect(mobi.canExtract('.mobi')).toBe(true);
    expect(mobi.canExtract('.azw3')).toBe(true);
    expect(mobi.canExtract('.epub')).toBe(false);

    const result = await mobi.extract('test-book.mobi');
    expect(result.text).toContain('Mobi Heading');
    expect(result.text).toContain('Mobi content paragraph');
    expect(result.metadata.title).toBe('Sample MOBI Ebook');
    expect(result.metadata.mobiHeader?.compression).toBe('PalmDOC');
  });
});
