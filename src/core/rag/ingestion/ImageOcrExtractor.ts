/**
 * Extracts OCR text and lightweight image metadata for RAG ingestion.
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { logger } from '../../observability/logger';
import {
  ExtractedDocument,
  FileExtractionOptions,
  FileExtractor,
  GIF_EXTENSIONS,
  IMAGE_EXTENSIONS
} from './ExtractedDocument';

interface OcrResult {
  text: string;
  confidence?: number;
}

export class ImageOcrExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return IMAGE_EXTENSIONS.has(ext) || GIF_EXTENSIONS.has(ext);
  }

  async extract(filePath: string, options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const ext = path.extname(filePath).toLowerCase();

    if (options.enableImageOcr === false) {
      return this.imageMetadataOnly(filePath, ext, 'Image OCR disabled');
    }

    if (GIF_EXTENSIONS.has(ext)) {
      return this.extractGif(filePath, options);
    }

    return this.extractStillImage(filePath, ext, options);
  }

  private async extractStillImage(
    filePath: string,
    ext: string,
    options: FileExtractionOptions
  ): Promise<ExtractedDocument> {
    const warnings: string[] = [];

    try {
      const image = sharp(filePath, { animated: false });
      const metadata = await image.metadata();
      const normalized = await image
        .rotate()
        .grayscale()
        .normalize()
        .png()
        .toBuffer();

      const ocr = await this.ocrBuffer(normalized, options.imageOcrLanguage || 'eng');
      const text = this.formatImageText(filePath, ext, metadata, [{ label: 'image', ...ocr }]);

      if (!ocr.text.trim()) {
        warnings.push('OCR produced no text');
      }

      return {
        text,
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: ext === '.bmp' ? 'image-bmp' : 'image',
          originalExtension: ext,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          pages: metadata.pages,
          ocrLanguage: options.imageOcrLanguage || 'eng',
          ocrConfidence: ocr.confidence
        },
        warnings
      };
    } catch (error: any) {
      logger.warn('Image OCR extraction failed', { filePath, error: error.message });
      return this.imageMetadataOnly(filePath, ext, `Image OCR extraction failed: ${error.message}`);
    }
  }

  private async extractGif(filePath: string, options: FileExtractionOptions): Promise<ExtractedDocument> {
    const warnings: string[] = [];

    try {
      const image = sharp(filePath, { animated: true, limitInputPixels: false });
      const metadata = await image.metadata();
      const pageCount = metadata.pages || 1;
      const maxFrames = Math.max(1, options.maxGifFrames || 4);
      const sampledPages = this.samplePages(pageCount, maxFrames);
      const ocrResults: Array<OcrResult & { label: string }> = [];

      for (const page of sampledPages) {
        try {
          const frameBuffer = await sharp(filePath, {
            animated: true,
            page,
            pages: 1,
            limitInputPixels: false
          })
            .rotate()
            .grayscale()
            .normalize()
            .png()
            .toBuffer();

          const ocr = await this.ocrBuffer(frameBuffer, options.imageOcrLanguage || 'eng');
          ocrResults.push({ label: `frame-${page}`, ...ocr });
        } catch (frameError: any) {
          warnings.push(`Frame ${page} OCR failed: ${frameError.message}`);
        }
      }

      if (ocrResults.every(result => !result.text.trim())) {
        warnings.push('GIF frame OCR produced no text');
      }

      return {
        text: this.formatImageText(filePath, '.gif', metadata, ocrResults),
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: 'gif',
          originalExtension: '.gif',
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          pages: pageCount,
          sampledFrames: sampledPages,
          ocrLanguage: options.imageOcrLanguage || 'eng'
        },
        warnings
      };
    } catch (error: any) {
      logger.warn('GIF OCR extraction failed', { filePath, error: error.message });
      return this.imageMetadataOnly(filePath, '.gif', `GIF OCR extraction failed: ${error.message}`);
    }
  }

  private samplePages(pageCount: number, maxFrames: number): number[] {
    if (pageCount <= maxFrames) {
      return Array.from({ length: pageCount }, (_value, index) => index);
    }

    const pages = new Set<number>();
    pages.add(0);
    pages.add(pageCount - 1);

    const slots = Math.max(1, maxFrames - 2);
    for (let i = 1; i <= slots; i++) {
      pages.add(Math.min(pageCount - 1, Math.floor((pageCount * i) / (slots + 1))));
    }

    return Array.from(pages).sort((a, b) => a - b).slice(0, maxFrames);
  }

  private async ocrBuffer(buffer: Buffer, language: string): Promise<OcrResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tesseract = require('tesseract.js');
      const result = await tesseract.recognize(buffer, language);
      return {
        text: result.data?.text || '',
        confidence: result.data?.confidence
      };
    } catch (error: any) {
      logger.warn('Tesseract OCR failed', { error: error.message });
      return {
        text: '',
        confidence: undefined
      };
    }
  }

  private formatImageText(
    filePath: string,
    ext: string,
    metadata: sharp.Metadata,
    ocrResults: Array<OcrResult & { label: string }>
  ): string {
    const header = [
      `Image source: ${filePath}`,
      `Image type: ${ext.replace('.', '')}`,
      `Image format: ${metadata.format || 'unknown'}`,
      `Image dimensions: ${metadata.width || 'unknown'}x${metadata.height || 'unknown'}`,
      metadata.pages ? `Image frames/pages: ${metadata.pages}` : undefined
    ].filter(Boolean).join('\n');

    const ocrText = ocrResults.map(result => {
      const confidence = typeof result.confidence === 'number'
        ? `Confidence: ${result.confidence}`
        : 'Confidence: unknown';
      return [
        `OCR block: ${result.label}`,
        confidence,
        'OCR text:',
        result.text.trim() || '[no text detected]'
      ].join('\n');
    }).join('\n\n');

    return `${header}\n\n${ocrText}`.trim();
  }

  private async imageMetadataOnly(filePath: string, ext: string, reason: string): Promise<ExtractedDocument> {
    try {
      const metadata = await sharp(filePath, { animated: GIF_EXTENSIONS.has(ext), limitInputPixels: false }).metadata();
      return {
        text: this.formatImageText(filePath, ext, metadata, [{ label: 'image', text: '', confidence: undefined }]),
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: GIF_EXTENSIONS.has(ext) ? 'gif' : 'image',
          originalExtension: ext,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          pages: metadata.pages,
          error: reason
        },
        warnings: [reason]
      };
    } catch (error: any) {
      return {
        text: '',
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: GIF_EXTENSIONS.has(ext) ? 'gif' : 'image',
          originalExtension: ext,
          error: `${reason}; metadata read failed: ${error.message}`
        },
        warnings: [reason, `Image metadata read failed: ${error.message}`]
      };
    }
  }
}
