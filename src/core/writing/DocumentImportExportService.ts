/**
 * Document Import/Export Service (PX14-T04)
 *
 * Implements format conversions (Markdown, Text, HTML, DOCX, PDF) with source provenance retention.
 */

import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { CanonicalDocument } from './WritingTypes';

export interface ImportResult {
  document: CanonicalDocument;
  importedFormat: string;
  sourceDigest: string;
  conversionWarnings: string[];
  isLossless: boolean;
}

export interface ExportResult {
  content: string | Buffer;
  format: 'markdown' | 'html' | 'pdf_html' | 'docx_xml';
  mimeType: string;
  byteSize: number;
}

export class DocumentImportExportService {
  /**
   * Imports content from supported formats into a CanonicalDocument.
   */
  public importDocument(
    sourceContent: string | Buffer,
    format: 'markdown' | 'text' | 'html' | 'docx' | 'pdf',
    fileName: string = 'imported-document'
  ): ImportResult {
    const rawBuffer = Buffer.isBuffer(sourceContent) ? sourceContent : Buffer.from(sourceContent, 'utf8');
    const sourceDigest = CanonicalDocumentModel.computeDigest(rawBuffer);
    const conversionWarnings: string[] = [];
    let markdownText = '';
    let isLossless = true;

    switch (format) {
      case 'markdown':
      case 'text': {
        markdownText = rawBuffer.toString('utf8');
        isLossless = true;
        break;
      }

      case 'html': {
        const htmlStr = rawBuffer.toString('utf8');
        markdownText = this.htmlToMarkdown(htmlStr);
        isLossless = false;
        conversionWarnings.push('HTML imported: structural styling converted to Markdown equivalent.');
        break;
      }

      case 'docx': {
        markdownText = this.docxToMarkdown(rawBuffer);
        isLossless = false;
        conversionWarnings.push('DOCX imported: parsed document body text and tables into Markdown.');
        break;
      }

      case 'pdf': {
        markdownText = this.pdfToMarkdown(rawBuffer);
        isLossless = false;
        conversionWarnings.push(
          'PDF converted: PDF is an explicit lossy extraction command, not a lossless open. Layout preserved as text flow.'
        );
        break;
      }

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }

    const doc = CanonicalDocumentModel.parseFromString(markdownText, {
      fileName,
      title: fileName.replace(/\.[^/.]+$/, '')
    });

    return {
      document: doc,
      importedFormat: format,
      sourceDigest,
      conversionWarnings,
      isLossless
    };
  }

  /**
   * Converts HTML text to clean Markdown.
   */
  public htmlToMarkdown(html: string): string {
    let md = html;

    // Remove script and style tags
    md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
    md = md.replace(/<style[\s\S]*?<\/style>/gi, '');

    // Headings
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
    md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
    md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');

    // Code blocks & inline code
    md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // Bold, Italic, Strike
    md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
    md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
    md = md.replace(/<(del|s|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');

    // Links & Images
    md = md.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img\s+(?:[^>]*?\s+)?src="([^"]*)"(?:\s+alt="([^"]*)")?[^>]*>/gi, '![$2]($1)');

    // Lists
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');

    // Paragraphs and breaks
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Unescape common HTML entities
    md = md
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    return md.trim();
  }

  /**
   * Converts DOCX text/xml stream to Markdown.
   */
  private docxToMarkdown(buffer: Buffer): string {
    const rawStr = buffer.toString('utf8');
    // Extract <w:p> paragraphs and <w:t> text nodes if raw XML, or return decoded text
    if (rawStr.includes('<w:p') || rawStr.includes('<w:t')) {
      const paragraphs: string[] = [];
      const pMatches = rawStr.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
      for (const p of pMatches) {
        const textParts = (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []).map((t) =>
          t.replace(/<[^>]+>/g, '')
        );
        if (textParts.length > 0) {
          paragraphs.push(textParts.join(''));
        }
      }
      return paragraphs.join('\n\n');
    }
    // Plain fallback
    return Array.from(rawStr)
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 32 || codePoint === 9 || codePoint === 10 || codePoint === 13;
      })
      .join('')
      .trim();
  }

  /**
   * Converts PDF stream to text.
   */
  private pdfToMarkdown(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    const textChunks: string[] = [];
    const streamMatches = raw.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g) || [];

    for (const st of streamMatches) {
      const clean = st.replace(/^stream[\r\n]+/, '').replace(/[\r\n]+endstream$/, '');
      const textMatches = clean.match(/\(([^\)]+)\)\s*Tj/g) || [];
      for (const tm of textMatches) {
        const t = tm.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
        if (t.trim()) textChunks.push(t);
      }
    }

    if (textChunks.length > 0) {
      return textChunks.join(' ');
    }

    // Fallback printable text extraction
    const printable = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    return printable.replace(/\s{3,}/g, '\n\n').trim();
  }

  /**
   * Exports a CanonicalDocument to the requested format.
   */
  public exportDocument(
    doc: CanonicalDocument,
    format: 'markdown' | 'html' | 'pdf_html' | 'docx_xml',
    options: { stripComments?: boolean } = {}
  ): ExportResult {
    let contentStr = doc.rawText;

    if (options.stripComments) {
      contentStr = contentStr.replace(/<!--[\s\S]*?-->/g, '');
    }

    switch (format) {
      case 'markdown': {
        const buffer = Buffer.from(contentStr, 'utf8');
        return {
          content: contentStr,
          format: 'markdown',
          mimeType: 'text/markdown; charset=utf-8',
          byteSize: buffer.length
        };
      }

      case 'html': {
        const html = this.markdownToHtml(contentStr, doc.metadata.title);
        const buffer = Buffer.from(html, 'utf8');
        return {
          content: html,
          format: 'html',
          mimeType: 'text/html; charset=utf-8',
          byteSize: buffer.length
        };
      }

      case 'pdf_html': {
        const printHtml = this.markdownToPrintableHtml(contentStr, doc.metadata.title);
        const buffer = Buffer.from(printHtml, 'utf8');
        return {
          content: printHtml,
          format: 'pdf_html',
          mimeType: 'text/html; charset=utf-8',
          byteSize: buffer.length
        };
      }

      case 'docx_xml': {
        const docxXml = this.markdownToDocxXml(contentStr);
        const buffer = Buffer.from(docxXml, 'utf8');
        return {
          content: docxXml,
          format: 'docx_xml',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          byteSize: buffer.length
        };
      }

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Converts Markdown to self-contained HTML.
   */
  public markdownToHtml(md: string, title: string = 'Document'): string {
    let body = md;
    // Headings
    body = body.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
    body = body.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
    body = body.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    body = body.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    body = body.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    body = body.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Code blocks & inline
    body = body.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    body = body.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold / italic
    body = body.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    body = body.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    body = body.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Callouts
    body = body.replace(
      /^>\s*\[!([A-Z]+)\]\s*(.*)$/gm,
      '<div class="callout callout-$1"><strong>$1</strong>: $2</div>'
    );
    body = body.replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>');

    // Paragraphs
    body = body.replace(/\n\n/g, '</p><p>');
    body = `<p>${body}</p>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
    h1, h2, h3, h4 { color: #111; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { font-family: monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 4px; }
    blockquote { border-left: 4px solid #0066cc; margin: 0; padding-left: 16px; color: #555; }
    .callout { border-left: 4px solid #0088cc; background: #eef7ff; padding: 10px 14px; margin: 12px 0; border-radius: 4px; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
  }

  /**
   * Converts Markdown to print-ready PDF HTML.
   */
  private markdownToPrintableHtml(md: string, title: string): string {
    const standardHtml = this.markdownToHtml(md, title);
    return standardHtml.replace(
      '</style>',
      `
      @media print {
        body { margin: 20mm; font-size: 11pt; color: #000; }
        h1, h2, h3 { page-break-after: avoid; }
        pre, blockquote, table { page-break-inside: avoid; }
      }
    </style>`
    );
  }

  /**
   * Formats Markdown to DOCX XML structure.
   */
  private markdownToDocxXml(md: string): string {
    const lines = md.split(/\r?\n/);
    const pXml: string[] = [];

    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const safeText = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      pXml.push(`<w:p><w:r><w:t>${safeText}</w:t></w:r></w:p>`);
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${pXml.join('\n    ')}
  </w:body>
</w:document>`;
  }
}
