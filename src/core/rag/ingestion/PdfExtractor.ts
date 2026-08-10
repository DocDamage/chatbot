/**
 * Extracts text from PDF files for RAG ingestion.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { logger } from '../../observability/logger';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

interface PdfOcrAttempt {
  text: string;
  warnings: string[];
  metadata: Record<string, any>;
}

export class PdfExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return ext === '.pdf';
  }

  async extract(filePath: string, options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    try {
      // pdf-parse does not have strong runtime typing in this project; keep it isolated here.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text || '';
      const warnings: string[] = [];
      const metadata: Record<string, any> = {
        source: filePath,
        title: pdfData.info?.Title || path.basename(filePath),
        type: 'pdf',
        originalExtension: '.pdf',
        pages: pdfData.numpages,
        info: pdfData.info
      };

      if (!text.trim()) {
        metadata.needsOcr = true;

        if (this.pdfOcrEnabled(options)) {
          const ocr = await this.tryOcrPdf(filePath, options);
          warnings.push(...ocr.warnings);
          Object.assign(metadata, ocr.metadata);

          if (ocr.text.trim()) {
            return {
              text: ocr.text,
              metadata: {
                ...metadata,
                needsOcr: false,
                pdfOcrStatus: 'completed'
              },
              warnings
            };
          }
        } else {
          warnings.push('PDF text extraction produced no text; queue for OCR reimport or set PDF_OCR_ENABLED=true.');
          metadata.pdfOcrStatus = 'queued';
        }
      }

      return {
        text,
        metadata,
        warnings
      };
    } catch (error: any) {
      logger.warn('PDF parsing failed', { filePath, error: error.message });
      return {
        text: '',
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: 'pdf',
          originalExtension: '.pdf',
          error: 'Failed to parse PDF',
          needsOcr: true,
          pdfOcrStatus: 'failed'
        },
        warnings: [`PDF parsing failed: ${error.message}`]
      };
    }
  }

  private pdfOcrEnabled(options: FileExtractionOptions): boolean {
    return options.enablePdfOcr ?? process.env.PDF_OCR_ENABLED === 'true';
  }

  private async tryOcrPdf(filePath: string, options: FileExtractionOptions): Promise<PdfOcrAttempt> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-pdf-ocr-'));
    const maxPages = this.positiveInt(options.pdfOcrMaxPages || process.env.PDF_OCR_MAX_PAGES, 25);
    const dpi = this.positiveInt(options.pdfOcrDpi || process.env.PDF_OCR_DPI, 180);
    const language = options.imageOcrLanguage || process.env.PDF_OCR_LANGUAGE || 'eng';
    const warnings: string[] = [];

    try {
      const rasterizers = this.findRasterizers();
      if (rasterizers.length === 0) {
        return {
          text: '',
          metadata: {
            pdfOcrStatus: 'blocked',
            pdfOcrBlockedReason: 'missing-pdf-rasterizer',
            needsOcr: true
          },
          warnings: [
            'PDF OCR requires Poppler pdftoppm, ImageMagick magick, or Ghostscript gs on PATH.'
          ]
        };
      }

      let images: string[] = [];
      let usedRasterizer = '';
      for (const rasterizer of rasterizers) {
        const rasterizerDir = path.join(tempDir, rasterizer.replace(/[^a-z0-9]+/gi, '_'));
        fs.mkdirSync(rasterizerDir, { recursive: true });
        try {
          images = this.rasterizePdf(filePath, rasterizerDir, rasterizer, maxPages, dpi);
          if (images.length > 0) {
            usedRasterizer = rasterizer;
            break;
          }
          warnings.push(`PDF OCR rasterizer ${rasterizer} produced no page images.`);
        } catch (error: any) {
          warnings.push(`PDF OCR rasterizer ${rasterizer} failed: ${error.message}`);
        }
      }

      if (images.length === 0) {
        return {
          text: '',
          metadata: {
            pdfOcrStatus: 'failed',
            pdfOcrRasterizer: rasterizers.join(','),
            needsOcr: true
          },
          warnings
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tesseract = require('tesseract.js');
      const pageTexts: string[] = [];
      const confidences: number[] = [];

      for (const [index, imagePath] of images.entries()) {
        try {
          const result = await tesseract.recognize(imagePath, language);
          const text = result.data?.text || '';
          pageTexts.push(`PDF OCR page ${index + 1}:\n${text.trim()}`);
          if (typeof result.data?.confidence === 'number') {
            confidences.push(result.data.confidence);
          }
        } catch (error: any) {
          warnings.push(`PDF OCR page ${index + 1} failed: ${error.message}`);
        }
      }

      const text = pageTexts.join('\n\n').trim();
      if (!text) {
        warnings.push('PDF OCR produced no text.');
      }

      return {
        text,
        metadata: {
          pdfOcrStatus: text ? 'completed' : 'failed',
          pdfOcrRasterizer: usedRasterizer,
          pdfOcrPagesAttempted: images.length,
          pdfOcrLanguage: language,
          pdfOcrDpi: dpi,
          pdfOcrConfidence: confidences.length
            ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
            : undefined,
          needsOcr: !text
        },
        warnings
      };
    } catch (error: any) {
      logger.warn('PDF OCR failed', { filePath, error: error.message });
      return {
        text: '',
        metadata: {
          pdfOcrStatus: 'failed',
          needsOcr: true
        },
        warnings: [`PDF OCR failed: ${error.message}`]
      };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private findRasterizers(): string[] {
    const candidates = ['pdftoppm', 'pdftoppm.exe', 'magick', 'magick.exe', 'gs', 'gswin64c.exe', 'gswin32c.exe'];
    return candidates.filter(command => this.commandExists(command));
  }

  private commandExists(command: string): boolean {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    return !result.error;
  }

  private rasterizePdf(
    filePath: string,
    tempDir: string,
    rasterizer: string,
    maxPages: number,
    dpi: number
  ): string[] {
    if (rasterizer.startsWith('pdftoppm')) {
      const outputPrefix = path.join(tempDir, 'page');
      execFileSync(rasterizer, ['-png', '-r', String(dpi), '-f', '1', '-l', String(maxPages), filePath, outputPrefix], {
        stdio: 'pipe'
      });
      return this.listPngs(tempDir);
    }

    if (rasterizer.startsWith('gs')) {
      const outputPattern = path.join(tempDir, 'page-%04d.png');
      execFileSync(rasterizer, [
        '-dSAFER',
        '-dBATCH',
        '-dNOPAUSE',
        '-sDEVICE=png16m',
        `-r${dpi}`,
        '-dFirstPage=1',
        `-dLastPage=${maxPages}`,
        `-sOutputFile=${outputPattern}`,
        filePath
      ], { stdio: 'pipe' });
      return this.listPngs(tempDir);
    }

    for (let page = 0; page < maxPages; page++) {
      const outputPath = path.join(tempDir, `page-${String(page + 1).padStart(4, '0')}.png`);
      const result = spawnSync(rasterizer, [
        '-density',
        String(dpi),
        `${filePath}[${page}]`,
        '-background',
        'white',
        '-alpha',
        'remove',
        outputPath
      ], { stdio: 'ignore' });

      if (result.error || result.status !== 0) {
        if (page === 0) {
          throw result.error || new Error(`${rasterizer} exited with status ${result.status}`);
        }
        break;
      }
    }

    return this.listPngs(tempDir);
  }

  private listPngs(directoryPath: string): string[] {
    return fs.readdirSync(directoryPath)
      .filter(fileName => fileName.toLowerCase().endsWith('.png'))
      .sort((a, b) => a.localeCompare(b))
      .map(fileName => path.join(directoryPath, fileName));
  }

  private positiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
}
