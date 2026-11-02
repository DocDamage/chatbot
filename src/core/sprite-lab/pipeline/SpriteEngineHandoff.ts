/**
 * Sprite Engine Handoff (PX10-T09)
 *
 * Prepares and exports engine-ready sprite assets, Godot import flags,
 * NinePatchRect resources, SpriteFrames, Unity meta hints, and provenance manifests.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EngineHandoffOptions, EngineHandoffResult, RawPixelData } from './SpriteStudioTypes';

export class SpriteEngineHandoff {
  public static computeApprovalDigest(
    spriteName: string,
    pixels: RawPixelData,
    options: Pick<EngineHandoffOptions, 'engine' | 'targetProjectRoot' | 'spriteSubdirectory'>
  ): string {
    const pixelDigest = crypto.createHash('sha256').update(Buffer.from(pixels.data)).digest('hex');
    const payload = JSON.stringify({
      spriteName,
      width: pixels.width,
      height: pixels.height,
      pixelDigest,
      engine: options.engine,
      targetProjectRoot: path.resolve(options.targetProjectRoot),
      spriteSubdirectory: options.spriteSubdirectory || 'sprites'
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Prepares engine handoff package for an approved engine project.
   */
  public static async prepareEngineHandoff(
    spriteName: string,
    pixels: RawPixelData,
    options: EngineHandoffOptions
  ): Promise<EngineHandoffResult> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(spriteName)) {
      return {
        success: false,
        targetFiles: [],
        manifestPath: '',
        thirdPartyNotices: '',
        error: 'INVALID_SPRITE_NAME: Use only letters, numbers, underscores, and hyphens.'
      };
    }

    const subDir = options.spriteSubdirectory || 'sprites';
    const resolvedRoot = path.resolve(options.targetProjectRoot);
    const targetDir = path.resolve(resolvedRoot, subDir);
    const relativeTarget = path.relative(resolvedRoot, targetDir);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      return {
        success: false,
        targetFiles: [],
        manifestPath: '',
        thirdPartyNotices: '',
        error: 'OUT_OF_BOUNDS_PATH: Sprite subdirectory must stay inside the target project.'
      };
    }

    const requiredApprovalDigest = this.computeApprovalDigest(spriteName, pixels, options);
    if (!options.approvedByUser || options.approvalDigest !== requiredApprovalDigest) {
      return {
        success: false,
        targetFiles: [],
        manifestPath: '',
        thirdPartyNotices: '',
        error: 'EXACT_SCOPE_APPROVAL_REQUIRED: Engine handoff requires the digest for these exact pixels and destination.',
        requiredApprovalDigest
      };
    }

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const files: Array<{ path: string; fileType: string; sha256: string }> = [];

      // 1. Generate PNG asset buffer
      const pngBuffer = this.rawPixelsToSimplePng(pixels);
      const pngPath = path.join(targetDir, `${spriteName}.png`);
      fs.writeFileSync(pngPath, pngBuffer);
      const pngSha = crypto.createHash('sha256').update(pngBuffer).digest('hex');
      files.push({ path: pngPath, fileType: 'image/png', sha256: pngSha });

      // 2. Godot engine metadata
      if (options.engine === 'godot' || options.createGodotImportHints) {
        // Godot 4.x .import file
        const importContent = `[remap]\n\nimporter="texture"\ntype="CompressedTexture2D"\nuid="uid://${crypto.randomBytes(8).toString('hex')}"\npath="res://.godot/imported/${spriteName}.png"\n\n[params]\n\ncompress/mode=0\nmipmaps/generate=false\nroughness/mode=0\n`;
        const importPath = `${pngPath}.import`;
        fs.writeFileSync(importPath, importContent, 'utf-8');
        files.push({
          path: importPath,
          fileType: 'text/godot-import',
          sha256: crypto.createHash('sha256').update(importContent).digest('hex')
        });

        if (options.createGodotNinePatch) {
          const ninePatchTres = `[gd_resource type="NinePatchRect" format=3]\n\n[ext_resource type="Texture2D" path="res://${subDir}/${spriteName}.png" id="1"]\n\n[resource]\ntexture = ExtResource("1")\npatch_margin_left = ${Math.floor(pixels.width / 4)}\npatch_margin_top = ${Math.floor(pixels.height / 4)}\npatch_margin_right = ${Math.floor(pixels.width / 4)}\npatch_margin_bottom = ${Math.floor(pixels.height / 4)}\n`;
          const ninePatchPath = path.join(targetDir, `${spriteName}_ninepatch.tres`);
          fs.writeFileSync(ninePatchPath, ninePatchTres, 'utf-8');
          files.push({
            path: ninePatchPath,
            fileType: 'text/godot-resource',
            sha256: crypto.createHash('sha256').update(ninePatchTres).digest('hex')
          });
        }
      }

      // 3. Unity engine metadata
      if (options.engine === 'unity' || options.createUnityMetaFiles) {
        const metaContent = `fileFormatVersion: 2\nguid: ${crypto.randomBytes(16).toString('hex')}\nTextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 12\n  textureType: 8\n  textureShape: 1\n  filterMode: 0\n  spriteMode: 1\n  spritePixelsToUnits: 16\n`;
        const metaPath = `${pngPath}.meta`;
        fs.writeFileSync(metaPath, metaContent, 'utf-8');
        files.push({
          path: metaPath,
          fileType: 'text/unity-meta',
          sha256: crypto.createHash('sha256').update(metaContent).digest('hex')
        });
      }

      // 4. Manifest generation
      const manifest = {
        spriteName,
        dimensions: { width: pixels.width, height: pixels.height },
        engine: options.engine,
        exportedAt: new Date().toISOString(),
        approvalDigest: options.approvalDigest,
        files
      };

      const manifestPath = path.join(targetDir, `${spriteName}_manifest.json`);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      const thirdPartyNotices = 'Clean-room pixel art processing. Output generated under user-approved local pipeline.';

      return {
        success: true,
        targetFiles: files,
        manifestPath,
        thirdPartyNotices
      };
    } catch (err: any) {
      return {
        success: false,
        targetFiles: [],
        manifestPath: '',
        thirdPartyNotices: '',
        error: `Failed to write engine handoff package: ${err.message}`
      };
    }
  }

  /**
   * Encodes raw RGBA buffer into a valid uncompressed PNG format buffer.
   */
  private static rawPixelsToSimplePng(pixels: RawPixelData): Buffer {
    // Basic uncompressed PNG writer
    const width = pixels.width;
    const height = pixels.height;

    // Scanline with filter byte 0 (None)
    const rawData = Buffer.alloc(height * (1 + width * 4));
    let rawOffset = 0;

    for (let y = 0; y < height; y++) {
      rawData[rawOffset++] = 0; // Filter byte: None
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        rawData[rawOffset++] = pixels.data[srcIdx];
        rawData[rawOffset++] = pixels.data[srcIdx + 1];
        rawData[rawOffset++] = pixels.data[srcIdx + 2];
        rawData[rawOffset++] = pixels.data[srcIdx + 3];
      }
    }

    const zlib = require('zlib');
    const compressed = zlib.deflateSync(rawData);

    // PNG Signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // Bit depth: 8
    ihdr[9] = 6; // Color type: RGBA
    ihdr[10] = 0; // Compression
    ihdr[11] = 0; // Filter
    ihdr[12] = 0; // Interlace

    const ihdrChunk = this.createPngChunk('IHDR', ihdr);
    const idatChunk = this.createPngChunk('IDAT', compressed);
    const iendChunk = this.createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  }

  private static createPngChunk(type: string, data: Buffer): Buffer {
    const len = data.length;
    const chunk = Buffer.alloc(8 + len + 4);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);

    // CRC32 calculation
    const crc = this.crc32(chunk.subarray(4, 8 + len));
    chunk.writeUInt32BE(crc, 8 + len);
    return chunk;
  }

  private static crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      let c = (crc ^ buf[i]) & 0xff;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}
