/**
 * Extracts readable text from HTML/XHTML-style book files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

const HTML_EXTENSIONS = new Set(['.html', '.htm', '.xhtml', '.mht', '.mhtml']);

export class HtmlExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return HTML_EXTENSIONS.has(ext);
  }

  async extract(filePath: string, _options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html, { xmlMode: false });
    $('script, style, nav, header, footer, noscript').remove();

    const title = this.cleanText(
      $('title').first().text()
      || $('h1').first().text()
      || path.basename(filePath)
    );
    const parts: string[] = [];

    $('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre').each((_index, element) => {
      const text = this.cleanText($(element).text());
      if (text) {
        parts.push(text);
      }
    });

    const text = parts.length > 0
      ? parts.join('\n\n')
      : this.cleanText($('body').text() || $.root().text());

    return {
      text,
      metadata: {
        source: filePath,
        title,
        type: 'html',
        extractor: 'cheerio'
      },
      warnings: text ? [] : ['HTML extraction produced no text']
    };
  }

  private cleanText(value: string): string {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim();
  }
}
