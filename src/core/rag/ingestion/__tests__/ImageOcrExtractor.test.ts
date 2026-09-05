import { ImageOcrExtractor } from '../ImageOcrExtractor';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('tesseract.js', () => ({
  recognize: jest.fn().mockResolvedValue({
    data: {
      text: 'Scanned Invoice Number 1024',
      confidence: 94
    }
  })
}));

describe('RT-OCR-001: ImageOcrExtractor Still Image and Animated GIF Extraction Suite', () => {
  let tempDir: string;
  let imagePath: string;
  let gifPath: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-ocr-test-'));
    imagePath = path.join(tempDir, 'sample.png');
    gifPath = path.join(tempDir, 'animation.gif');

    const sharp = require('sharp');
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toFile(imagePath);

    await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).gif().toFile(gifPath);
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('validates supported image and animated extensions', () => {
    const extractor = new ImageOcrExtractor();

    expect(extractor.canExtract('.png')).toBe(true);
    expect(extractor.canExtract('.jpg')).toBe(true);
    expect(extractor.canExtract('.jpeg')).toBe(true);
    expect(extractor.canExtract('.gif')).toBe(true);
    expect(extractor.canExtract('.bmp')).toBe(true);
    expect(extractor.canExtract('.txt')).toBe(false);
  });

  it('extracts OCR text and metadata from still images', async () => {
    const extractor = new ImageOcrExtractor();
    const result = await extractor.extract(imagePath, { imageOcrLanguage: 'eng' });

    expect(result.text).toContain('Scanned Invoice');
    expect(result.metadata.source).toBe(imagePath);
    expect(result.metadata.width).toBe(100);
    expect(result.metadata.height).toBe(100);
  });

  it('extracts frames and metadata from animated GIF images', async () => {
    const extractor = new ImageOcrExtractor();
    const result = await extractor.extract(gifPath, { maxGifFrames: 2 });

    expect(result.metadata.source).toBe(gifPath);
    expect(result.text).toBeDefined();
  });

  it('handles disabled OCR option by returning metadata only', async () => {
    const extractor = new ImageOcrExtractor();
    const result = await extractor.extract(imagePath, { enableImageOcr: false });

    expect(result.metadata.source).toBe(imagePath);
    expect(result.warnings).toContain('Image OCR disabled');
  });

  it('handles missing files gracefully', async () => {
    const extractor = new ImageOcrExtractor();
    const result = await extractor.extract(path.join(tempDir, 'missing.png'));

    expect(result.metadata.source).toContain('missing.png');
  });
});
