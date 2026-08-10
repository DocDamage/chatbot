/**
 * Extracts Word/Office documents for RAG ingestion.
 *
 * DOCX support prefers the optional `mammoth` package.
 * Legacy DOC support uses LibreOffice headless conversion when available.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';
import { ExtractedDocument, FileExtractionOptions, FileExtractor, OFFICE_EXTENSIONS } from './ExtractedDocument';

const execFileAsync = promisify(execFile);

export class OfficeExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return OFFICE_EXTENSIONS.has(ext);
  }

  async extract(filePath: string, options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const warnings: string[] = [];

    if (ext === '.docx') {
      const mammothResult = await this.extractDocxWithMammoth(filePath);
      warnings.push(...(mammothResult.warnings || []));

      if (mammothResult.text.trim().length > 0) {
        return mammothResult;
      }
    }

    if (options.enableOfficeConversion === false) {
      return this.unsupported(filePath, ext, 'Office conversion disabled', warnings);
    }

    const libreOfficeResult = await this.extractWithLibreOffice(filePath, ext);
    if (libreOfficeResult.text.trim().length === 0 && ext === '.doc') {
      const stringsResult = await this.extractDocWithStrings(filePath, ext);
      return {
        ...stringsResult,
        warnings: [
          ...warnings,
          ...(libreOfficeResult.warnings || []),
          ...(stringsResult.warnings || [])
        ]
      };
    }

    return {
      ...libreOfficeResult,
      warnings: [...warnings, ...(libreOfficeResult.warnings || [])]
    };
  }

  private async extractDocxWithMammoth(filePath: string): Promise<ExtractedDocument> {
    try {
      // mammoth is optional so the app can still compile/run without forcing Office support installs.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const warnings = Array.isArray(result.messages)
        ? result.messages.map((message: any) => String(message.message || message))
        : [];

      return {
        text: result.value || '',
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: 'docx',
          extractor: 'mammoth',
          warningCount: warnings.length
        },
        warnings
      };
    } catch (error: any) {
      logger.warn('DOCX mammoth extraction unavailable or failed', { filePath, error: error.message });
      return {
        text: '',
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: 'docx',
          extractor: 'mammoth',
          error: 'mammoth unavailable or failed'
        },
        warnings: [`DOCX mammoth extraction failed: ${error.message}`]
      };
    }
  }

  private async extractWithLibreOffice(filePath: string, ext: string): Promise<ExtractedDocument> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-office-'));
    const title = path.basename(filePath);

    try {
      await execFileAsync('soffice', [
        '--headless',
        '--convert-to',
        'txt:Text',
        '--outdir',
        tempDir,
        filePath
      ], { timeout: 30000 });

      const convertedPath = path.join(tempDir, `${path.basename(filePath, ext)}.txt`);
      const text = fs.existsSync(convertedPath) ? fs.readFileSync(convertedPath, 'utf-8') : '';

      return {
        text,
        metadata: {
          source: filePath,
          title,
          type: ext.replace('.', ''),
          extractor: 'libreoffice',
          convertedPath: path.basename(convertedPath)
        },
        warnings: text.trim().length === 0 ? ['LibreOffice conversion produced no text'] : []
      };
    } catch (error: any) {
      logger.warn('Office conversion failed', { filePath, error: error.message });
      return this.unsupported(filePath, ext, `Office conversion failed: ${error.message}`);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError: any) {
        logger.warn('Office temp cleanup failed', { tempDir, error: cleanupError.message });
      }
    }
  }

  private async extractDocWithStrings(filePath: string, ext: string): Promise<ExtractedDocument> {
    try {
      const { stdout } = await execFileAsync('strings', ['-n', '4', filePath], { timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
      const text = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !/^[\W_]+$/.test(line))
        .join('\n');

      return {
        text,
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: ext.replace('.', '') || 'doc',
          extractor: 'strings'
        },
        warnings: ['Used strings fallback for legacy DOC; formatting may be incomplete']
      };
    } catch (error: any) {
      logger.warn('DOC strings fallback failed', { filePath, error: error.message });
      return this.unsupported(filePath, ext, `DOC strings fallback failed: ${error.message}`);
    }
  }

  private unsupported(filePath: string, ext: string, reason: string, priorWarnings: string[] = []): ExtractedDocument {
    return {
      text: '',
      metadata: {
        source: filePath,
        title: path.basename(filePath),
        type: ext.replace('.', '') || 'office',
        error: reason
      },
      warnings: [...priorWarnings, reason]
    };
  }
}
