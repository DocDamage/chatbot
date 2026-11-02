import { ImageProcessor, getImageProcessor } from './ImageProcessor';

const mockRecognize = jest.fn();
jest.mock('tesseract.js', () => ({ recognize: mockRecognize }));

describe('ImageProcessor release policy', () => {
  let png: Buffer;
  let dataUrl: string;

  beforeAll(async () => {
    const sharp = require('sharp');
    png = await sharp({
      create: { width: 4, height: 3, channels: 3, background: '#336699' }
    }).png().toBuffer();
    dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  });

  afterEach(() => jest.clearAllMocks());

  it('rejects images over the configured byte limit with structured errors', async () => {
    const processor = new ImageProcessor({ maxSizeMB: 0.0001, maxPixels: 1000 });
    const oversized = Buffer.alloc(1024).toString('base64');

    const result = await processor.resizeImageSafe(oversized);

    expect(result.status).toBe('rejected');
    expect(result.error).toMatch(/exceeds maximum/);
  });

  it('exposes dependency health and policy for release checks', async () => {
    const processor = new ImageProcessor({ maxSizeMB: 5, maxPixels: 100 });

    const health = await processor.getDependencyHealth();

    expect(typeof health.sharpAvailable).toBe('boolean');
    expect(typeof health.tesseractAvailable).toBe('boolean');
    expect(health.policy).toEqual({ maxSizeMB: 5, maxPixels: 100 });
  });

  it('rejects decoded images that exceed the configured pixel policy', async () => {
    const sharp = require('sharp');
    const image = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: '#ffffff',
      },
    }).png().toBuffer();
    const processor = new ImageProcessor({ maxSizeMB: 1, maxPixels: 3 });

    const validation = await processor.validateImage(image.toString('base64'));

    expect(validation.valid).toBe(false);
    expect(validation.error).toMatch(/exceed maximum pixel policy/);
  });

  it('validates data URLs and extracts decoded metadata', async () => {
    const processor = new ImageProcessor();
    const validation = await processor.validateImage(dataUrl, 1);
    expect(validation).toMatchObject({
      valid: true,
      metadata: { width: 4, height: 3, format: 'png', hasText: false }
    });
    await expect(processor.extractMetadata(dataUrl)).resolves.toMatchObject({ width: 4, height: 3 });
    await expect(processor.extractMetadata('not-an-image')).rejects.toThrow('Image validation failed');
  });

  it('returns the original when resizing is unnecessary and resizes larger images safely', async () => {
    const processor = new ImageProcessor();
    await expect(processor.resizeImage(dataUrl, 10, 10)).resolves.toBe(dataUrl);

    const resized = await processor.resizeImageSafe(dataUrl, 2, 2);
    expect(resized.status).toBe('ok');
    expect(resized.data).toMatch(/^data:image\/png;base64,/);
  });

  it('reports resize processing errors and preserves rejected originals', async () => {
    const processor = new ImageProcessor();
    jest.spyOn(processor, 'validateImage').mockResolvedValue({
      valid: true,
      metadata: { width: 1, height: 1, format: 'png', size: 1, hasText: false }
    });
    const safe = await processor.resizeImageSafe('not-an-image', 1, 1);
    expect(safe).toMatchObject({ status: 'error', error: expect.any(String) });

    const rejected = new ImageProcessor({ maxSizeMB: 0, maxPixels: 1 });
    await expect(rejected.resizeImage(dataUrl)).resolves.toBe(dataUrl);
  });

  it('converts every supported output format and rejects unsupported formats safely', async () => {
    const processor = new ImageProcessor();
    await expect(processor.convertFormat(dataUrl, 'jpeg')).resolves.toMatch(/^data:image\/jpeg;base64,/);
    await expect(processor.convertFormat(dataUrl, 'png')).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(processor.convertFormat(dataUrl, 'webp')).resolves.toMatch(/^data:image\/webp;base64,/);
    await expect(processor.convertFormat(dataUrl, 'gif' as any)).resolves.toBe(dataUrl);
    await expect(processor.convertFormat('not-an-image', 'png')).resolves.toBe('not-an-image');

    expect((processor as any).bufferToBase64(Buffer.from('x'), 'gif')).toMatch(/^data:image\/gif;base64,/);
    expect((processor as any).bufferToBase64(Buffer.from('x'), 'unknown')).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('detects significant text and handles low confidence, short text, and OCR errors', async () => {
    const processor = new ImageProcessor();
    mockRecognize
      .mockResolvedValueOnce({ data: { confidence: 90, text: 'substantial text' } })
      .mockResolvedValueOnce({ data: { confidence: 20, text: 'substantial text' } })
      .mockResolvedValueOnce({ data: { confidence: 90, text: 'tiny' } })
      .mockRejectedValueOnce(new Error('ocr failed'));

    await expect(processor.hasText(dataUrl)).resolves.toBe(true);
    await expect(processor.hasText(dataUrl)).resolves.toBe(false);
    await expect(processor.hasText(dataUrl)).resolves.toBe(false);
    await expect(processor.hasText(dataUrl)).resolves.toBe(false);
  });

  it('extracts OCR words, supports missing words, and returns safe failures', async () => {
    const processor = new ImageProcessor();
    mockRecognize
      .mockResolvedValueOnce({
        data: { text: 'hello', confidence: 95, words: [{ text: 'hello', confidence: 95, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }] }
      })
      .mockResolvedValueOnce({ data: { text: 'plain', confidence: 80 } })
      .mockRejectedValueOnce(new Error('recognition failed'));

    await expect(processor.extractText(dataUrl)).resolves.toMatchObject({
      text: 'hello', words: [expect.objectContaining({ text: 'hello' })]
    });
    await expect(processor.extractTextSafe(dataUrl)).resolves.toMatchObject({
      status: 'ok', data: { words: [] }
    });
    await expect(processor.extractTextSafe(dataUrl)).resolves.toMatchObject({
      status: 'error', error: 'recognition failed'
    });
    const rejected = new ImageProcessor({ maxSizeMB: 0, maxPixels: 1 });
    await expect(rejected.extractText(dataUrl)).resolves.toEqual({ text: '', confidence: 0, words: [] });
  });

  it('extracts colors and safely handles invalid image content', async () => {
    const processor = new ImageProcessor();
    const colors = await processor.extractColors(dataUrl, 1);
    expect(colors).toHaveLength(1);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
    await expect(processor.extractColors('not-an-image')).resolves.toEqual([]);
  });

  it('crops, rotates, blurs, and optimizes valid images while preserving invalid originals', async () => {
    const processor = new ImageProcessor();
    await expect(processor.cropImage(dataUrl, 0, 0, 2, 2)).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(processor.rotateImage(dataUrl, 90)).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(processor.blurImage(dataUrl)).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(processor.blurImage(dataUrl, 1)).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(processor.optimizeForWeb(dataUrl)).resolves.toMatch(/^data:image\/webp;base64,/);
    await expect(processor.optimizeForWeb(dataUrl, 50)).resolves.toMatch(/^data:image\/webp;base64,/);

    await expect(processor.cropImage('bad', 0, 0, 1, 1)).resolves.toBe('bad');
    await expect(processor.rotateImage('bad', 90)).resolves.toBe('bad');
    await expect(processor.blurImage('bad')).resolves.toBe('bad');
    await expect(processor.optimizeForWeb('bad')).resolves.toBe('bad');
  });

  it('returns a stable default singleton', () => {
    expect(getImageProcessor()).toBe(getImageProcessor());
  });
});
