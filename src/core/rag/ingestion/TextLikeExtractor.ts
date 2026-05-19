/**
 * Extracts text-like documents for RAG ingestion.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

export class TextLikeExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return ['.txt', '.md', '.json'].includes(ext);
  }

  async extract(filePath: string, _options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        text: typeof json === 'string' ? json : JSON.stringify(json, null, 2),
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: 'json'
        }
      };
    }

    return {
      text: fs.readFileSync(filePath, 'utf-8'),
      metadata: {
        source: filePath,
        title: path.basename(filePath),
        type: ext === '.md' ? 'markdown' : 'text'
      }
    };
  }
}
