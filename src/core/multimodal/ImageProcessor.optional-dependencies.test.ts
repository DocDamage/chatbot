jest.mock('sharp', () => {
  throw new Error('sharp unavailable for optional-dependency test');
});
jest.mock('tesseract.js', () => {
  throw new Error('tesseract unavailable for optional-dependency test');
});

import { ImageProcessor } from './ImageProcessor';

describe('ImageProcessor without optional native dependencies', () => {
  const base64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

  it('reports dependency health and identifies common formats from magic bytes', async () => {
    const processor = new ImageProcessor();
    await expect(processor.getDependencyHealth()).resolves.toMatchObject({
      sharpAvailable: false,
      tesseractAvailable: false
    });

    const formats: Array<[number[], string]> = [
      [[0xff, 0xd8], 'jpeg'],
      [[0x89, 0x50], 'png'],
      [[0x52, 0x49], 'webp'],
      [[0x47, 0x49], 'gif'],
      [[0x00, 0x00], 'unknown']
    ];
    for (const [bytes, format] of formats) {
      await expect(processor.validateImage(base64(bytes))).resolves.toMatchObject({
        valid: true,
        metadata: { width: 0, height: 0, format }
      });
    }
  });

  it('returns explicit unsupported results for resize and OCR operations', async () => {
    const processor = new ImageProcessor();
    const image = base64([0x89, 0x50, 0x00]);
    await expect(processor.resizeImageSafe(image)).resolves.toMatchObject({
      status: 'unsupported', dependency: 'sharp'
    });
    await expect(processor.extractTextSafe(image)).resolves.toMatchObject({
      status: 'unsupported', dependency: 'tesseract'
    });
    await expect(processor.hasText(image)).resolves.toBe(false);
  });

  it('preserves originals or empty results for unsupported image transformations', async () => {
    const processor = new ImageProcessor();
    const image = base64([0xff, 0xd8, 0x00]);
    await expect(processor.convertFormat(image, 'png')).resolves.toBe(image);
    await expect(processor.extractColors(image)).resolves.toEqual([]);
    await expect(processor.cropImage(image, 0, 0, 1, 1)).resolves.toBe(image);
    await expect(processor.rotateImage(image, 90)).resolves.toBe(image);
    await expect(processor.blurImage(image)).resolves.toBe(image);
    await expect(processor.optimizeForWeb(image)).resolves.toBe(image);
  });
});
