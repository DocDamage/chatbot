import { ImageProcessor } from './ImageProcessor';

describe('ImageProcessor release policy', () => {
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
});
