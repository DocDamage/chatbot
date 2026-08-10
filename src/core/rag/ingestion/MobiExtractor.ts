/**
 * Extracts readable text from unencrypted Kindle/MOBI-family ebooks when possible.
 */

import * as path from 'path';
import * as cheerio from 'cheerio';
import { logger } from '../../observability/logger';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

const MOBI_EXTENSIONS = new Set(['.mobi', '.azw', '.azw3', '.azw4']);

export class MobiExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return MOBI_EXTENSIONS.has(ext);
  }

  async extract(filePath: string, _options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    try {
      // The mobi package has no maintained TypeScript definitions.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Mobi = require('mobi');
      const parsed = new Mobi(filePath);
      const html = String(parsed.content || '');
      const text = this.htmlToText(html);
      const title = this.cleanText(parsed.title || parsed.name || path.basename(filePath));

      return {
        text,
        metadata: {
          source: filePath,
          title,
          type: path.extname(filePath).toLowerCase().replace('.', '') || 'mobi',
          extractor: 'mobi',
          mobiHeader: parsed.mobiHeader
            ? {
                compression: parsed.mobiHeader.compression,
                encoding: parsed.mobiHeader.encoding,
                textRecordCount: parsed.mobiHeader.textRecordCount
              }
            : undefined
        },
        warnings: text ? [] : ['MOBI extraction produced no text']
      };
    } catch (error: any) {
      logger.warn('MOBI extraction failed', { filePath, error: error.message });
      return {
        text: '',
        metadata: {
          source: filePath,
          title: path.basename(filePath),
          type: path.extname(filePath).toLowerCase().replace('.', '') || 'mobi',
          error: `MOBI extraction failed: ${error.message}`
        },
        warnings: [`MOBI extraction failed: ${error.message}`]
      };
    }
  }

  private htmlToText(html: string): string {
    const $ = cheerio.load(html, { xmlMode: false });
    $('script, style, guide, reference').remove();
    const parts: string[] = [];

    $('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, div').each((_index, element) => {
      const text = this.cleanText($(element).text());
      if (text && parts[parts.length - 1] !== text) {
        parts.push(text);
      }
    });

    return parts.length > 0
      ? parts.join('\n\n')
      : this.cleanText($.root().text() || html);
  }

  private cleanText(value: string): string {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim();
  }
}
