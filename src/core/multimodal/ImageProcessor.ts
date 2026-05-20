/**
 * Image Processor - Image preprocessing and utilities using Sharp
 * Research: MIT Vision Group
 */

import { logger } from '../observability/logger';

// Dynamic imports for optional dependencies
let sharp: any = null;
let sharpLoaded = false;

let Tesseract: any = null;
let tesseractLoaded = false;

async function loadSharp(): Promise<boolean> {
  if (sharp !== null) return sharpLoaded;

  try {
    sharp = require('sharp');
    sharpLoaded = true;
    logger.info('Sharp loaded successfully');
    return true;
  } catch (error) {
    logger.warn('Sharp not available - image processing will be limited');
    sharpLoaded = false;
    return false;
  }
}

async function loadTesseract(): Promise<boolean> {
  if (Tesseract !== null) return tesseractLoaded;

  try {
    Tesseract = require('tesseract.js');
    tesseractLoaded = true;
    logger.info('Tesseract.js loaded successfully');
    return true;
  } catch (error) {
    logger.warn('Tesseract.js not available - OCR will not work');
    tesseractLoaded = false;
    return false;
  }
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number; // bytes
  hasText: boolean;
  dominantColors?: string[];
  channels?: number;
  density?: number;
  hasAlpha?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export class ImageProcessor {
  private ocrWorker: any = null;

  /**
   * Convert base64 to buffer
   */
  private base64ToBuffer(imageBase64: string): Buffer {
    let base64Data = imageBase64;
    if (imageBase64.startsWith('data:')) {
      base64Data = imageBase64.split(',')[1];
    }
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Convert buffer to base64 data URL
   */
  private bufferToBase64(buffer: Buffer, format: string): string {
    const mimeType = format === 'jpeg' ? 'image/jpeg'
      : format === 'png' ? 'image/png'
        : format === 'webp' ? 'image/webp'
          : format === 'gif' ? 'image/gif'
            : 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Validate image format and size with actual image decoding
   */
  async validateImage(imageBase64: string, maxSizeMB: number = 10): Promise<{
    valid: boolean;
    error?: string;
    metadata?: ImageMetadata;
  }> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const sizeMB = buffer.length / (1024 * 1024);

      if (sizeMB > maxSizeMB) {
        return {
          valid: false,
          error: `Image size (${sizeMB.toFixed(2)}MB) exceeds maximum (${maxSizeMB}MB)`
        };
      }

      const isLoaded = await loadSharp();

      if (isLoaded) {
        // Use sharp for accurate metadata
        const metadata = await sharp(buffer).metadata();

        return {
          valid: true,
          metadata: {
            width: metadata.width || 0,
            height: metadata.height || 0,
            format: metadata.format || 'unknown',
            size: buffer.length,
            hasText: false, // Will be determined by OCR if needed
            channels: metadata.channels,
            density: metadata.density,
            hasAlpha: metadata.hasAlpha
          }
        };
      } else {
        // Fallback: detect format from magic bytes
        let format = 'unknown';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          format = 'jpeg';
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
          format = 'png';
        } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
          format = 'webp';
        } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
          format = 'gif';
        }

        return {
          valid: true,
          metadata: {
            width: 0,
            height: 0,
            format,
            size: buffer.length,
            hasText: false
          }
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        error: `Image validation failed: ${error.message}`
      };
    }
  }

  /**
   * Resize image while maintaining aspect ratio
   */
  async resizeImage(
    imageBase64: string,
    maxWidth: number = 1024,
    maxHeight: number = 1024
  ): Promise<string> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      logger.warn('Image resizing requires sharp - returning original');
      return imageBase64;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const metadata = await sharp(buffer).metadata();

      // Check if resize is needed
      if ((metadata.width || 0) <= maxWidth && (metadata.height || 0) <= maxHeight) {
        return imageBase64;
      }

      const resized = await sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();

      const format = metadata.format || 'jpeg';
      logger.info('Image resized', {
        original: `${metadata.width}x${metadata.height}`,
        maxDimensions: `${maxWidth}x${maxHeight}`
      });

      return this.bufferToBase64(resized, format);
    } catch (error: any) {
      logger.error('Image resize failed', { error: error.message });
      return imageBase64;
    }
  }

  /**
   * Convert image to different format
   */
  async convertFormat(
    imageBase64: string,
    targetFormat: 'jpeg' | 'png' | 'webp'
  ): Promise<string> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      logger.warn('Image format conversion requires sharp - returning original');
      return imageBase64;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);

      let converted: Buffer;
      switch (targetFormat) {
        case 'jpeg':
          converted = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
          break;
        case 'png':
          converted = await sharp(buffer).png({ compressionLevel: 6 }).toBuffer();
          break;
        case 'webp':
          converted = await sharp(buffer).webp({ quality: 85 }).toBuffer();
          break;
        default:
          throw new Error(`Unsupported format: ${targetFormat}`);
      }

      logger.info('Image converted', { targetFormat });
      return this.bufferToBase64(converted, targetFormat);
    } catch (error: any) {
      logger.error('Image conversion failed', { error: error.message });
      return imageBase64;
    }
  }

  /**
   * Extract comprehensive image metadata
   */
  async extractMetadata(imageBase64: string): Promise<ImageMetadata> {
    const validation = await this.validateImage(imageBase64);
    if (!validation.valid || !validation.metadata) {
      throw new Error(validation.error || 'Failed to extract metadata');
    }
    return validation.metadata;
  }

  /**
   * Check if image contains text using OCR
   */
  async hasText(imageBase64: string): Promise<boolean> {
    const isLoaded = await loadTesseract();

    if (!isLoaded) {
      logger.warn('Text detection requires tesseract.js');
      return false;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);

      const { data } = await Tesseract.recognize(buffer, 'eng', {
        logger: () => { } // Suppress logging
      });

      // Consider image to have text if confidence is decent and there's actual content
      const hasSignificantText = data.confidence > 30 && data.text.trim().length > 5;

      logger.info('Text detection complete', {
        hasText: hasSignificantText,
        confidence: data.confidence
      });

      return hasSignificantText;
    } catch (error: any) {
      logger.error('Text detection failed', { error: error.message });
      return false;
    }
  }

  /**
   * Perform OCR to extract text from image
   */
  async extractText(imageBase64: string): Promise<OCRResult> {
    const isLoaded = await loadTesseract();

    if (!isLoaded) {
      return { text: '', confidence: 0, words: [] };
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);

      const { data } = await Tesseract.recognize(buffer, 'eng', {
        logger: () => { }
      });

      const words = data.words?.map((w: any) => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      })) || [];

      logger.info('OCR complete', {
        textLength: data.text.length,
        wordCount: words.length,
        confidence: data.confidence
      });

      return {
        text: data.text,
        confidence: data.confidence,
        words
      };
    } catch (error: any) {
      logger.error('OCR failed', { error: error.message });
      return { text: '', confidence: 0, words: [] };
    }
  }

  /**
   * Extract dominant colors from image
   */
  async extractColors(imageBase64: string, count: number = 5): Promise<string[]> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      return [];
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);

      // Resize to small image for faster color analysis
      const small = await sharp(buffer)
        .resize(50, 50, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Simple color quantization
      const colorMap = new Map<string, number>();
      const pixels = small.data;

      for (let i = 0; i < pixels.length; i += small.info.channels) {
        // Quantize to reduce color space
        const r = Math.round(pixels[i] / 32) * 32;
        const g = Math.round(pixels[i + 1] / 32) * 32;
        const b = Math.round(pixels[i + 2] / 32) * 32;

        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
      }

      // Sort by frequency and return top colors
      const sorted = [...colorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([color]) => color);

      logger.info('Extracted dominant colors', { count: sorted.length });
      return sorted;
    } catch (error: any) {
      logger.error('Color extraction failed', { error: error.message });
      return [];
    }
  }

  /**
   * Crop image to specified region
   */
  async cropImage(
    imageBase64: string,
    left: number,
    top: number,
    width: number,
    height: number
  ): Promise<string> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      logger.warn('Image cropping requires sharp - returning original');
      return imageBase64;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const metadata = await sharp(buffer).metadata();

      const cropped = await sharp(buffer)
        .extract({ left, top, width, height })
        .toBuffer();

      logger.info('Image cropped', { region: { left, top, width, height } });
      return this.bufferToBase64(cropped, metadata.format || 'jpeg');
    } catch (error: any) {
      logger.error('Image crop failed', { error: error.message });
      return imageBase64;
    }
  }

  /**
   * Rotate image by degrees
   */
  async rotateImage(imageBase64: string, degrees: number): Promise<string> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      return imageBase64;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const metadata = await sharp(buffer).metadata();

      const rotated = await sharp(buffer)
        .rotate(degrees)
        .toBuffer();

      logger.info('Image rotated', { degrees });
      return this.bufferToBase64(rotated, metadata.format || 'jpeg');
    } catch (error: any) {
      logger.error('Image rotation failed', { error: error.message });
      return imageBase64;
    }
  }

  /**
   * Apply blur to image
   */
  async blurImage(imageBase64: string, sigma: number = 5): Promise<string> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      return imageBase64;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const metadata = await sharp(buffer).metadata();

      const blurred = await sharp(buffer)
        .blur(sigma)
        .toBuffer();

      return this.bufferToBase64(blurred, metadata.format || 'jpeg');
    } catch (error: any) {
      logger.error('Image blur failed', { error: error.message });
      return imageBase64;
    }
  }

  /**
   * Optimize image for web (reduce size while maintaining quality)
   */
  async optimizeForWeb(imageBase64: string, quality: number = 80): Promise<string> {
    const isLoaded = await loadSharp();

    if (!isLoaded) {
      return imageBase64;
    }

    try {
      const buffer = this.base64ToBuffer(imageBase64);

      // Convert to WebP for best compression
      const optimized = await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      const originalSize = buffer.length;
      const newSize = optimized.length;
      const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

      logger.info('Image optimized for web', {
        originalSize,
        newSize,
        savings: `${savings}%`
      });

      return this.bufferToBase64(optimized, 'webp');
    } catch (error: any) {
      logger.error('Image optimization failed', { error: error.message });
      return imageBase64;
    }
  }
}

let imageProcessor: ImageProcessor | null = null;

export function getImageProcessor(): ImageProcessor {
  if (!imageProcessor) {
    imageProcessor = new ImageProcessor();
  }
  return imageProcessor;
}
