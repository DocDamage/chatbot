/**
 * Routes files to the correct extraction strategy for RAG ingestion.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';
import { ImageOcrExtractor } from './ImageOcrExtractor';
import { OfficeExtractor } from './OfficeExtractor';
import { PdfExtractor } from './PdfExtractor';
import { TextLikeExtractor } from './TextLikeExtractor';

export class FileTypeRouter {
  private readonly extractors: FileExtractor[];

  constructor(extractors?: FileExtractor[]) {
    this.extractors = extractors || [
      new TextLikeExtractor(),
      new PdfExtractor(),
      new OfficeExtractor(),
      new ImageOcrExtractor()
    ];
  }

  async extract(filePath: string, options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const extractor = this.extractors.find(candidate => candidate.canExtract(ext, filePath));

    if (extractor) {
      return extractor.extract(filePath, options);
    }

    return this.extractFallbackText(filePath, ext);
  }

  getSupportedExtensions(): string[] {
    return [
      '.txt',
      '.md',
      '.json',
      '.pdf',
      '.docx',
      '.doc',
      '.png',
      '.jpg',
      '.jpeg',
      '.bmp',
      '.gif'
    ];
  }

  private async extractFallbackText(filePath: string, ext: string): Promise<ExtractedDocument> {
    return {
      text: fs.readFileSync(filePath, 'utf-8'),
      metadata: {
        source: filePath,
        title: path.basename(filePath),
        type: 'text',
        originalExtension: ext || 'none',
        extractor: 'fallback-text'
      },
      warnings: ext ? [`No dedicated extractor for ${ext}; read as UTF-8 text`] : ['No extension; read as UTF-8 text']
    };
  }
}
