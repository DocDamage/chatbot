import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ImageIngestValidator } from '../ImageIngestValidator';

describe('ImageIngestValidator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-validator-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects path safety violations and empty buffers', () => {
    const validBuf = Buffer.alloc(32);
    expect(ImageIngestValidator.validateBuffer(validBuf, '../escape.png').valid).toBe(false);
    expect(ImageIngestValidator.validateBuffer(validBuf, 'null\0byte.png').valid).toBe(false);
    expect(ImageIngestValidator.validateBuffer(validBuf, path.resolve('abs.png')).valid).toBe(false);

    expect(ImageIngestValidator.validateBuffer(Buffer.alloc(4), 'small.png').valid).toBe(false);
  });

  it('detects unknown format signatures', () => {
    const unknownBuf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    const res = ImageIngestValidator.validateBuffer(unknownBuf, 'test.bin');
    expect(res.valid).toBe(false);
    expect(res.format).toBe('unknown');
  });

  it('validates PNG headers and detects decompression bombs', () => {
    // Valid PNG header (8 bytes) + IHDR chunk (4 bytes len + 'IHDR' + 13 bytes data + 4 bytes crc)
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdrChunk = Buffer.alloc(25);
    ihdrChunk.writeUInt32BE(64, 8); // width = 64 at offset 16 (8 + 8)
    ihdrChunk.writeUInt32BE(64, 12); // height = 64 at offset 20 (8 + 12)
    ihdrChunk[17] = 6; // RGBA color type at offset 25 (8 + 17)

    const validPng = Buffer.concat([pngHeader, ihdrChunk]);
    const res = ImageIngestValidator.validateBuffer(validPng, 'sprite.png');
    expect(res.valid).toBe(true);
    expect(res.format).toBe('png');
    expect(res.dimensions).toEqual({ width: 64, height: 64 });
    expect(res.hasAlpha).toBe(true);

    // Huge dimensions decompression bomb
    const bombIhdr = Buffer.alloc(25);
    bombIhdr.writeUInt32BE(10000, 8); // width = 10000 > MAX_PIXEL_DIMENSION (8192)
    bombIhdr.writeUInt32BE(10000, 12);
    const bombPng = Buffer.concat([pngHeader, bombIhdr]);
    const bombRes = ImageIngestValidator.validateBuffer(bombPng, 'bomb.png');
    expect(bombRes.valid).toBe(false);
    expect(bombRes.isDecompressionBombRisk).toBe(true);
  });

  it('validates GIF, BMP, JPEG, and WebP headers', () => {
    // GIF89a header
    const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 32, 0, 32, 0]);
    const gifRes = ImageIngestValidator.validateBuffer(gifHeader, 'anim.gif');
    expect(gifRes.valid).toBe(true);
    expect(gifRes.format).toBe('gif');
    expect(gifRes.dimensions).toEqual({ width: 32, height: 32 });

    // BMP header ('BM' at 0, width at 18, height at 22)
    const bmpHeader = Buffer.alloc(30);
    bmpHeader[0] = 0x42;
    bmpHeader[1] = 0x4d;
    bmpHeader.writeInt32LE(48, 18);
    bmpHeader.writeInt32LE(48, 22);
    const bmpRes = ImageIngestValidator.validateBuffer(bmpHeader, 'image.bmp');
    expect(bmpRes.valid).toBe(true);
    expect(bmpRes.format).toBe('bmp');
    expect(bmpRes.dimensions).toEqual({ width: 48, height: 48 });

    // JPEG header (FF D8 FF + SOF0 segment)
    const jpegBuf = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0,
      0x00, 0x11, // length 17
      0x08,       // precision
      0x00, 0x64, // height 100
      0x00, 0x64  // width 100
    ]);
    const jpegRes = ImageIngestValidator.validateBuffer(jpegBuf, 'photo.jpg');
    expect(jpegRes.valid).toBe(true);
    expect(jpegRes.format).toBe('jpeg');
    expect(jpegRes.dimensions).toEqual({ width: 100, height: 100 });

    // WebP header (RIFF ... WEBP + VP8L chunk)
    const webpBuf = Buffer.alloc(32);
    webpBuf.write('RIFF', 0);
    webpBuf.write('WEBP', 8);
    webpBuf.write('VP8L', 12);
    webpBuf[21] = 31; // width - 1 low bits (width = 32)
    webpBuf[22] = 0;
    webpBuf[23] = 7;  // height bits
    webpBuf[24] = 0;
    const webpRes = ImageIngestValidator.validateBuffer(webpBuf, 'image.webp');
    expect(webpRes.valid).toBe(true);
    expect(webpRes.format).toBe('webp');
  });

  it('validates files on disk and handles missing files', () => {
    // Missing file
    expect(ImageIngestValidator.validateFile(path.join(tempDir, 'missing.png')).valid).toBe(false);

    // Valid file
    const filePath = path.join(tempDir, 'valid.gif');
    const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 16, 0, 16, 0]);
    fs.writeFileSync(filePath, gifHeader);
    const res = ImageIngestValidator.validateFile(filePath);
    expect(res.valid).toBe(true);
    expect(res.format).toBe('gif');
  });
});
