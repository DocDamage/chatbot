import fs from 'fs';
import os from 'os';
import path from 'path';
import { PdfExtractor } from '../PdfExtractor';

jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation(async (buffer: Buffer) => {
    const str = buffer.toString('utf8');
    if (str.includes('THROW_PARSE_ERROR')) {
      throw new Error('Corrupted PDF header');
    }
    if (str.includes('EMPTY_TEXT_PDF')) {
      return { text: '', numpages: 2, info: { Title: 'Empty Text Doc' } };
    }
    return {
      text: 'Extracted PDF text content for RAG indexing.',
      numpages: 3,
      info: { Title: 'Sample Architecture Document' }
    };
  });
});

jest.mock('tesseract.js', () => {
  return {
    recognize: jest.fn().mockImplementation(async (imagePath: string) => {
      if (imagePath.includes('FAIL_OCR')) {
        throw new Error('Tesseract recognition error');
      }
      return {
        data: {
          text: 'OCR scanned text from page image',
          confidence: 92.5
        }
      };
    })
  };
});

describe('RT-RAG-002: PdfExtractor Text Ingestion and OCR Pipeline Suite', () => {
  let tempDir: string;
  let extractor: PdfExtractor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-extractor-test-'));
    extractor = new PdfExtractor();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('verifies canExtract extension validation', () => {
    expect(extractor.canExtract('.pdf')).toBe(true);
    expect(extractor.canExtract('.PDF')).toBe(false);
    expect(extractor.canExtract('.docx')).toBe(false);
    expect(extractor.canExtract('.txt')).toBe(false);
  });

  it('extracts normal PDF text and populates metadata and page count', async () => {
    const pdfPath = path.join(tempDir, 'sample.pdf');
    fs.writeFileSync(pdfPath, 'valid pdf content');

    const result = await extractor.extract(pdfPath);
    expect(result.text).toContain('Extracted PDF text content');
    expect(result.metadata.title).toBe('Sample Architecture Document');
    expect(result.metadata.pages).toBe(3);
    expect(result.metadata.type).toBe('pdf');
    expect(result.warnings).toEqual([]);
  });

  it('queues empty-text PDF for OCR when OCR is disabled', async () => {
    const emptyPdfPath = path.join(tempDir, 'empty.pdf');
    fs.writeFileSync(emptyPdfPath, 'EMPTY_TEXT_PDF');

    const result = await extractor.extract(emptyPdfPath, { enablePdfOcr: false });
    expect(result.text).toBe('');
    expect(result.metadata.needsOcr).toBe(true);
    expect(result.metadata.pdfOcrStatus).toBe('queued');
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it('handles PDF parsing failures gracefully with structured error metadata', async () => {
    const brokenPdfPath = path.join(tempDir, 'broken.pdf');
    fs.writeFileSync(brokenPdfPath, 'THROW_PARSE_ERROR');

    const result = await extractor.extract(brokenPdfPath);
    expect(result.text).toBe('');
    expect(result.metadata.pdfOcrStatus).toBe('failed');
    expect(result.metadata.error).toBe('Failed to parse PDF');
    expect(result.warnings?.[0]).toContain('PDF parsing failed');
  });

  it('attempts OCR when enabled and handles missing rasterizers', async () => {
    const emptyPdfPath = path.join(tempDir, 'empty.pdf');
    fs.writeFileSync(emptyPdfPath, 'EMPTY_TEXT_PDF');

    // Force no rasterizers found
    jest.spyOn(extractor as any, 'findRasterizers').mockReturnValueOnce([]);

    const result = await extractor.extract(emptyPdfPath, { enablePdfOcr: true });
    expect(result.metadata.pdfOcrStatus).toBe('blocked');
    expect(result.metadata.pdfOcrBlockedReason).toBe('missing-pdf-rasterizer');
  });

  it('attempts OCR with rasterizer simulation and tesseract recognition', async () => {
    const emptyPdfPath = path.join(tempDir, 'ocr.pdf');
    fs.writeFileSync(emptyPdfPath, 'EMPTY_TEXT_PDF');

    // Mock rasterizer discovery and image generation
    jest.spyOn(extractor as any, 'findRasterizers').mockReturnValueOnce(['mock-magick']);
    jest.spyOn(extractor as any, 'rasterizePdf').mockImplementationOnce((...args: any[]) => {
      const targetDir = args[1];
      const page1 = path.join(targetDir, 'page-0001.png');
      const page2 = path.join(targetDir, 'page-0002-FAIL_OCR.png');
      fs.writeFileSync(page1, 'fake png 1');
      fs.writeFileSync(page2, 'fake png 2');
      return [page1, page2];
    });

    const result = await extractor.extract(emptyPdfPath, { enablePdfOcr: true });
    expect(result.text).toContain('OCR scanned text from page image');
    expect(result.metadata.pdfOcrStatus).toBe('completed');
    expect(result.metadata.pdfOcrConfidence).toBe(92.5);
    expect(result.metadata.needsOcr).toBe(false);
  });

  it('exercises listPngs and command discovery helpers', () => {
    const testDir = path.join(tempDir, 'png-test');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'page1.png'), 'png1');
    fs.writeFileSync(path.join(testDir, 'page2.PNG'), 'png2');
    fs.writeFileSync(path.join(testDir, 'notes.txt'), 'txt');

    const pngs = (extractor as any).listPngs(testDir);
    expect(pngs.length).toBe(2);

    const exists = (extractor as any).commandExists('non-existent-executable-xyz-123');
    expect(exists).toBe(false);
  });

  it('handles positiveInt helper across valid numbers and fallbacks', () => {
    expect((extractor as any).positiveInt('30', 10)).toBe(30);
    expect((extractor as any).positiveInt(50, 10)).toBe(50);
    expect((extractor as any).positiveInt(0, 10)).toBe(10);
    expect((extractor as any).positiveInt(-5, 10)).toBe(10);
    expect((extractor as any).positiveInt('invalid', 10)).toBe(10);
    expect((extractor as any).positiveInt(undefined, 10)).toBe(10);
  });

  it('exercises pdftoppm, gs, and magick branches in rasterizePdf', () => {
    const childProcess = require('child_process');
    const execSpy = jest.spyOn(childProcess, 'execFileSync').mockImplementation(() => Buffer.from(''));
    const spawnSpy = jest.spyOn(childProcess, 'spawnSync').mockReturnValue({ status: 0 });

    const pdfFile = path.join(tempDir, 'test.pdf');
    fs.writeFileSync(pdfFile, 'dummy');

    // 1. pdftoppm
    const res1 = (extractor as any).rasterizePdf(pdfFile, tempDir, 'pdftoppm', 2, 150);
    expect(execSpy).toHaveBeenCalled();

    // 2. gs
    const res2 = (extractor as any).rasterizePdf(pdfFile, tempDir, 'gs', 2, 150);
    expect(execSpy).toHaveBeenCalled();

    // 3. magick / convert
    const res3 = (extractor as any).rasterizePdf(pdfFile, tempDir, 'magick', 2, 150);
    expect(spawnSpy).toHaveBeenCalled();

    execSpy.mockRestore();
    spawnSpy.mockRestore();
  });
});
