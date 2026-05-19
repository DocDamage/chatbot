/**
 * Extracts text from PDF files for RAG ingestion.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../observability/logger';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

export class PdfExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return ext === '.pdf';
  }

  async extract(filePath: string, _options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    try {
      // pdf-parse does not have strong runtime typing in this project; keep it isolated here.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);

      return {
        text: pdfData.text || '',
        metadata: {
          source: filePath,
          title: pdfData.info?.Title || path.basename(filePath),
          type: 'pdf',
          pages: pdfData.numpages,
          info: pdfData.info
        }
      };
    } catch (error: any) {
      logger.warn('PDF parsing failed', { filePath, error: error.message });
      return {
        text: '',
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: 'pdf',
          error: 'Failed to parse PDF'
        },
        warnings: [`PDF parsing failed: ${error.message}`]
      };
    }
  }
}
