/**
 * Extracts plain text from RTF documents using a lightweight parser.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

export class RtfExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return ext === '.rtf';
  }

  async extract(filePath: string, _options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const rtf = fs.readFileSync(filePath, 'latin1');
    const text = this.rtfToText(rtf);

    return {
      text,
      metadata: {
        source: filePath,
        title: path.basename(filePath),
        type: 'rtf',
        extractor: 'rtf-lite'
      },
      warnings: text ? [] : ['RTF extraction produced no text']
    };
  }

  private rtfToText(rtf: string): string {
    return rtf
      .replace(/\\'([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u(-?\d+)\??/g, (_match, code) => {
        const parsed = Number(code);
        return Number.isFinite(parsed) ? String.fromCharCode(parsed < 0 ? parsed + 65536 : parsed) : '';
      })
      .replace(/{\\(?:fonttbl|colortbl|stylesheet|info|pict|object)[\s\S]*?}/gi, ' ')
      .replace(/\\(?:par|line|tab)\b\s?/gi, '\n')
      .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
      .replace(/[{}\\]/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
