import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { InternalSpriteImageAdapter } from '../InternalSpriteImageAdapter';

describe('RT-SPRITE-001: InternalSpriteImageAdapter Grid Slicing & Palette Suite', () => {
  let tempDir: string;
  let adapter: InternalSpriteImageAdapter;
  let testImageRel: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'internal-sprite-test-'));
    adapter = new InternalSpriteImageAdapter(tempDir);

    // Create a simple 32x32 test PNG
    const imagePath = path.join(tempDir, 'spritesheet.png');
    await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toFile(imagePath);

    testImageRel = 'spritesheet.png';
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('slices image grids into frame files and writes a manifest', async () => {
    const result = await adapter.sliceGrid({
      inputPath: testImageRel,
      outputDir: 'frames_out',
      frameWidth: 16,
      frameHeight: 16
    });

    expect(result.frames.length).toBe(4);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(result.frames[0].path)).toBe(true);
  });

  it('rejects invalid dimensions and non-positive integers', async () => {
    // Non-positive integer
    await expect(adapter.sliceGrid({
      inputPath: testImageRel,
      outputDir: 'frames_err',
      frameWidth: 0,
      frameHeight: 16
    })).rejects.toThrow('frameWidth must be a positive integer');

    // Unevenly divisible dimensions
    await expect(adapter.sliceGrid({
      inputPath: testImageRel,
      outputDir: 'frames_err',
      frameWidth: 7,
      frameHeight: 16
    })).rejects.toThrow('are not evenly divisible');
  });

  it('extracts color palette and limits maxColors', async () => {
    const result = await adapter.extractPalette({
      inputPath: testImageRel,
      outputPath: 'palette.json',
      maxColors: 4
    });

    expect(result.colorCount).toBeGreaterThan(0);
    expect(result.colors[0]).toMatch(/^#[0-9a-fA-F]{8}$/);
    expect(fs.existsSync(path.join(tempDir, 'palette.json'))).toBe(true);
  });

  it('creates basic sprite manifest with animation frames', async () => {
    const result = await adapter.createBasicManifest({
      inputPath: testImageRel,
      outputPath: 'manifest.json',
      frameWidth: 16,
      frameHeight: 16,
      animationName: 'walk'
    });

    expect(result.manifestPath).toBeDefined();
    const parsed = JSON.parse(fs.readFileSync(path.join(tempDir, 'manifest.json'), 'utf8'));
    expect(parsed.animations[0].name).toBe('walk');
    expect(parsed.columns).toBe(2);
    expect(parsed.rows).toBe(2);
  });

  it('enforces workspace boundary check on all file operations', async () => {
    await expect(adapter.sliceGrid({
      inputPath: '../outside.png',
      outputDir: 'out',
      frameWidth: 16,
      frameHeight: 16
    })).rejects.toThrow('Sprite Lab paths must stay inside the workspace.');
  });
});
