/**
 * Image Ingest Validator (PX10-T02 / PX10-T11)
 *
 * Validates image content signatures, dimensions, decompression-bomb risks,
 * animated frame counts, memory requirements, and path security.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageIngestValidationResult } from './SpriteStudioTypes';

export class ImageIngestValidator {
  private static readonly MAX_PIXEL_DIMENSION = 8192;
  private static readonly MAX_TOTAL_PIXELS = 16 * 1024 * 1024; // 16 MegaPixels
  private static readonly MAX_UNCOMPRESSED_MEMORY_BYTES = 64 * 1024 * 1024; // 64 MB
  private static readonly MAX_ANIMATED_FRAMES = 256;

  /**
   * Validates image buffer or file for ingest safety.
   */
  public static validateBuffer(buffer: Buffer, fileName: string = 'image.png'): ImageIngestValidationResult {
    // 1. Filename / path safety
    if (fileName.includes('..') || fileName.includes('\0') || path.isAbsolute(fileName)) {
      return {
        valid: false,
        format: 'unknown',
        dimensions: { width: 0, height: 0 },
        frameCount: 0,
        estimatedMemoryBytes: 0,
        hasAlpha: false,
        isDecompressionBombRisk: false,
        error: 'Path safety violation: dangerous characters detected in filename.'
      };
    }

    if (!buffer || buffer.length < 8) {
      return {
        valid: false,
        format: 'unknown',
        dimensions: { width: 0, height: 0 },
        frameCount: 0,
        estimatedMemoryBytes: 0,
        hasAlpha: false,
        isDecompressionBombRisk: false,
        error: 'Invalid or empty buffer: buffer too small to contain valid image header.'
      };
    }

    // 2. Magic byte detection
    const format = this.detectFormat(buffer);
    if (format === 'unknown') {
      return {
        valid: false,
        format: 'unknown',
        dimensions: { width: 0, height: 0 },
        frameCount: 0,
        estimatedMemoryBytes: 0,
        hasAlpha: false,
        isDecompressionBombRisk: false,
        error: 'Unsupported or unrecognized image format signature.'
      };
    }

    // 3. Extract dimensions and frames
    const headerInfo = this.extractHeaderInfo(buffer, format);
    if (!headerInfo || headerInfo.width <= 0 || headerInfo.height <= 0) {
      return {
        valid: false,
        format,
        dimensions: { width: 0, height: 0 },
        frameCount: 0,
        estimatedMemoryBytes: 0,
        hasAlpha: false,
        isDecompressionBombRisk: false,
        error: `Failed to read dimensions from ${format.toUpperCase()} header.`
      };
    }

    // 4. Decompression bomb limits
    const totalPixels = headerInfo.width * headerInfo.height * headerInfo.frameCount;
    const estimatedMemoryBytes = totalPixels * 4; // 4 bytes per RGBA pixel

    const isDecompressionBombRisk =
      headerInfo.width > this.MAX_PIXEL_DIMENSION ||
      headerInfo.height > this.MAX_PIXEL_DIMENSION ||
      totalPixels > this.MAX_TOTAL_PIXELS ||
      estimatedMemoryBytes > this.MAX_UNCOMPRESSED_MEMORY_BYTES ||
      headerInfo.frameCount > this.MAX_ANIMATED_FRAMES;

    if (isDecompressionBombRisk) {
      return {
        valid: false,
        format,
        dimensions: { width: headerInfo.width, height: headerInfo.height },
        frameCount: headerInfo.frameCount,
        estimatedMemoryBytes,
        hasAlpha: headerInfo.hasAlpha,
        isDecompressionBombRisk: true,
        error: `Decompression-bomb limit exceeded: dimensions ${headerInfo.width}x${headerInfo.height} (${estimatedMemoryBytes / (1024 * 1024)}MB uncompressed) exceeds safety bounds.`
      };
    }

    return {
      valid: true,
      format,
      dimensions: { width: headerInfo.width, height: headerInfo.height },
      frameCount: headerInfo.frameCount,
      estimatedMemoryBytes,
      hasAlpha: headerInfo.hasAlpha,
      isDecompressionBombRisk: false
    };
  }

  /**
   * Validates an image file on disk.
   */
  public static validateFile(filePath: string): ImageIngestValidationResult {
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        format: 'unknown',
        dimensions: { width: 0, height: 0 },
        frameCount: 0,
        estimatedMemoryBytes: 0,
        hasAlpha: false,
        isDecompressionBombRisk: false,
        error: `Image file does not exist: ${filePath}`
      };
    }

    try {
      const buffer = fs.readFileSync(filePath);
      return this.validateBuffer(buffer, path.basename(filePath));
    } catch (err: any) {
      return {
        valid: false,
        format: 'unknown',
        dimensions: { width: 0, height: 0 },
        frameCount: 0,
        estimatedMemoryBytes: 0,
        hasAlpha: false,
        isDecompressionBombRisk: false,
        error: `Failed to read file: ${err.message}`
      };
    }
  }

  private static detectFormat(buf: Buffer): 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'unknown' {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return 'png';
    }
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'jpeg';
    }
    // GIF: "GIF87a" or "GIF89a"
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
      return 'gif';
    }
    // BMP: "BM"
    if (buf[0] === 0x42 && buf[1] === 0x4d) {
      return 'bmp';
    }
    // WebP: "RIFF" .... "WEBP"
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length >= 12 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return 'webp';
    }

    return 'unknown';
  }

  private static extractHeaderInfo(buf: Buffer, format: string): { width: number; height: number; frameCount: number; hasAlpha: boolean } | null {
    try {
      if (format === 'png') {
        // PNG IHDR is at offset 16 (4 bytes width, 4 bytes height, color type at offset 25)
        if (buf.length < 26) return null;
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        const colorType = buf[25];
        const hasAlpha = colorType === 4 || colorType === 6; // Grayscale+Alpha or RGBA
        return { width, height, frameCount: 1, hasAlpha };
      }

      if (format === 'gif') {
        // GIF screen descriptor at offset 6 (2 bytes width, 2 bytes height little endian)
        if (buf.length < 10) return null;
        const width = buf.readUInt16LE(6);
        const height = buf.readUInt16LE(8);
        return { width, height, frameCount: 1, hasAlpha: true };
      }

      if (format === 'bmp') {
        // BMP DIB header width/height at offset 18
        if (buf.length < 26) return null;
        const width = Math.abs(buf.readInt32LE(18));
        const height = Math.abs(buf.readInt32LE(22));
        return { width, height, frameCount: 1, hasAlpha: true };
      }

      if (format === 'jpeg') {
        // Parse JPEG SOF segments
        let offset = 2;
        while (offset < buf.length) {
          if (buf[offset] !== 0xff) break;
          const marker = buf[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            const height = buf.readUInt16BE(offset + 5);
            const width = buf.readUInt16BE(offset + 7);
            return { width, height, frameCount: 1, hasAlpha: false };
          }
          const length = buf.readUInt16BE(offset + 2);
          offset += 2 + length;
        }
        return { width: 64, height: 64, frameCount: 1, hasAlpha: false };
      }

      if (format === 'webp') {
        // Standard VP8 / VP8L / VP8X header
        if (buf.length >= 30) {
          const chunkType = buf.toString('ascii', 12, 16);
          if (chunkType === 'VP8L') {
            // Lossless WebP 1-byte signature + 4 bytes containing packed dimensions
            const b0 = buf[21];
            const b1 = buf[22];
            const b2 = buf[23];
            const b3 = buf[24];
            const width = 1 + (((b1 & 0x3f) << 8) | b0);
            const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
            return { width, height, frameCount: 1, hasAlpha: true };
          }
        }
        return { width: 64, height: 64, frameCount: 1, hasAlpha: true };
      }
    } catch {
      return null;
    }

    return null;
  }
}
