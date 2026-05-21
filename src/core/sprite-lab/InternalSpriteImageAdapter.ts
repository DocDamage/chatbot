import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export interface SpriteSliceResult {
  inputPath: string;
  outputDir: string;
  frameWidth: number;
  frameHeight: number;
  frames: Array<{ index: number; x: number; y: number; path: string }>;
  manifestPath: string;
}

export interface SpritePaletteResult {
  inputPath: string;
  colorCount: number;
  colors: string[];
  outputPath: string;
}

export interface SpriteManifestResult {
  inputPath: string;
  outputPath: string;
  manifestPath: string;
}

export class InternalSpriteImageAdapter {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async sliceGrid(input: {
    inputPath: string;
    outputDir: string;
    frameWidth: number;
    frameHeight: number;
  }): Promise<SpriteSliceResult> {
    const inputPath = this.resolveWorkspacePath(input.inputPath);
    const outputDir = this.resolveWorkspacePath(input.outputDir);
    const frameWidth = this.requirePositiveInteger(input.frameWidth, 'frameWidth');
    const frameHeight = this.requirePositiveInteger(input.frameHeight, 'frameHeight');
    fs.mkdirSync(outputDir, { recursive: true });

    const image = sharp(inputPath, { limitInputPixels: 20000 * 20000 });
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (!width || !height) throw new Error('Unable to read sprite image dimensions');
    if (width % frameWidth !== 0 || height % frameHeight !== 0) {
      throw new Error(`Image dimensions ${width}x${height} are not evenly divisible by ${frameWidth}x${frameHeight}`);
    }

    const frames: SpriteSliceResult['frames'] = [];
    let index = 0;
    for (let y = 0; y < height; y += frameHeight) {
      for (let x = 0; x < width; x += frameWidth) {
        const framePath = path.join(outputDir, `frame_${String(index).padStart(4, '0')}.png`);
        await sharp(inputPath)
          .extract({ left: x, top: y, width: frameWidth, height: frameHeight })
          .png()
          .toFile(framePath);
        frames.push({ index, x, y, path: framePath });
        index += 1;
      }
    }

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      inputPath,
      outputDir,
      frameWidth,
      frameHeight,
      sourceWidth: width,
      sourceHeight: height,
      frames
    }, null, 2));

    return { inputPath, outputDir, frameWidth, frameHeight, frames, manifestPath };
  }

  async extractPalette(input: {
    inputPath: string;
    outputPath: string;
    maxColors?: number;
  }): Promise<SpritePaletteResult> {
    const inputPath = this.resolveWorkspacePath(input.inputPath);
    const outputPath = this.resolveWorkspacePath(input.outputPath);
    const maxColors = Math.min(Math.max(input.maxColors || 256, 1), 1024);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colors = new Map<string, number>();
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const alpha = data[offset + 3] ?? 255;
      if (alpha === 0) continue;
      const hex = `#${this.hex(data[offset])}${this.hex(data[offset + 1])}${this.hex(data[offset + 2])}${this.hex(alpha)}`;
      colors.set(hex, (colors.get(hex) || 0) + 1);
    }

    const sorted = [...colors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([color]) => color);

    fs.writeFileSync(outputPath, JSON.stringify({
      inputPath,
      colorCount: sorted.length,
      colors: sorted
    }, null, 2));

    return { inputPath, colorCount: sorted.length, colors: sorted, outputPath };
  }

  async createBasicManifest(input: {
    inputPath: string;
    outputPath: string;
    frameWidth?: number;
    frameHeight?: number;
    animationName?: string;
  }): Promise<SpriteManifestResult> {
    const inputPath = this.resolveWorkspacePath(input.inputPath);
    const outputPath = this.resolveWorkspacePath(input.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const frameWidth = input.frameWidth || width;
    const frameHeight = input.frameHeight || height;
    const columns = frameWidth > 0 ? Math.floor(width / frameWidth) : 1;
    const rows = frameHeight > 0 ? Math.floor(height / frameHeight) : 1;
    const frameCount = Math.max(1, columns * rows);

    const manifest = {
      source: inputPath,
      image: inputPath,
      width,
      height,
      frameWidth,
      frameHeight,
      columns,
      rows,
      animations: [
        {
          name: input.animationName || 'default',
          start: 0,
          end: frameCount - 1,
          frameCount
        }
      ]
    };

    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    return { inputPath, outputPath: inputPath, manifestPath: outputPath };
  }

  private resolveWorkspacePath(requestedPath: string): string {
    const resolved = path.resolve(this.workspaceRoot, requestedPath);
    const relative = path.relative(this.workspaceRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Sprite Lab paths must stay inside the workspace.');
    }
    return resolved;
  }

  private requirePositiveInteger(value: number, name: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
    return value;
  }

  private hex(value: number): string {
    return Number(value || 0).toString(16).padStart(2, '0');
  }
}
