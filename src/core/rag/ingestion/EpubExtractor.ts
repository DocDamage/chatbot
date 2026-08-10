/**
 * Extracts readable text and book metadata from EPUB archives.
 */

import * as path from 'path';
import * as cheerio from 'cheerio';
import { logger } from '../../observability/logger';
import { ExtractedDocument, FileExtractionOptions, FileExtractor } from './ExtractedDocument';

interface ManifestItem {
  id: string;
  href: string;
  mediaType?: string;
}

export class EpubExtractor implements FileExtractor {
  canExtract(ext: string): boolean {
    return ext === '.epub';
  }

  async extract(filePath: string, _options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    const warnings: string[] = [];

    try {
      // adm-zip and xml2js are runtime dependencies; keep their looser types isolated here.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AdmZip = require('adm-zip');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { parseStringPromise } = require('xml2js');
      const zip = new AdmZip(filePath);
      const entryMap = new Map<string, any>();
      for (const entry of zip.getEntries()) {
        entryMap.set(this.normalizeZipPath(entry.entryName), entry);
      }

      const containerXml = this.getEntryText(entryMap, 'META-INF/container.xml');
      if (!containerXml) {
        return this.unsupported(filePath, 'Missing META-INF/container.xml');
      }

      const container = await parseStringPromise(containerXml, { explicitArray: false });
      const rootfile = this.firstArrayValue(container?.container?.rootfiles?.rootfile);
      const opfPath = rootfile?.$?.['full-path'];
      if (!opfPath) {
        return this.unsupported(filePath, 'EPUB container did not declare a package document');
      }

      const opfXml = this.getEntryText(entryMap, opfPath);
      if (!opfXml) {
        return this.unsupported(filePath, `Missing package document: ${opfPath}`);
      }

      const opf = await parseStringPromise(opfXml, { explicitArray: false });
      const packageDoc = opf.package;
      const metadata = packageDoc?.metadata || {};
      const manifest = this.readManifest(packageDoc);
      const spineIds = this.readSpineIds(packageDoc);
      const opfDir = path.posix.dirname(this.normalizeZipPath(opfPath));

      const readingOrder = spineIds.length > 0
        ? spineIds.map(id => manifest.get(id)).filter((item): item is ManifestItem => !!item)
        : Array.from(manifest.values());

      const chapters: Array<{ title: string; text: string }> = [];
      for (const item of readingOrder) {
        if (!this.isReadableHtml(item)) {
          continue;
        }

        const entryPath = this.resolveZipPath(opfDir, item.href);
        const html = this.getEntryText(entryMap, entryPath);
        if (!html) {
          warnings.push(`Missing EPUB spine item: ${entryPath}`);
          continue;
        }

        const chapter = this.htmlToText(html, path.posix.basename(item.href));
        if (chapter.text) {
          chapters.push(chapter);
        }
      }

      if (chapters.length === 0) {
        return this.unsupported(filePath, 'No readable XHTML/HTML spine content found', warnings);
      }

      const title = this.firstText(metadata['dc:title']) || path.basename(filePath);
      const author = this.firstText(metadata['dc:creator']);
      const language = this.firstText(metadata['dc:language']);
      const publisher = this.firstText(metadata['dc:publisher']);
      const publishedDate = this.firstText(metadata['dc:date']);
      const identifier = this.firstText(metadata['dc:identifier']);
      const text = chapters
        .map(chapter => chapter.title ? `${chapter.title}\n\n${chapter.text}` : chapter.text)
        .join('\n\n');

      return {
        text,
        metadata: {
          source: filePath,
          title,
          author,
          language,
          publisher,
          publishedDate,
          identifier,
          type: 'epub',
          extractor: 'epub',
          chapters: chapters.length,
          chapterTitles: chapters.map(chapter => chapter.title).filter(Boolean).slice(0, 50)
        },
        warnings
      };
    } catch (error: any) {
      logger.warn('EPUB extraction failed', { filePath, error: error.message });
      return this.unsupported(filePath, `EPUB extraction failed: ${error.message}`);
    }
  }

  private readManifest(packageDoc: any): Map<string, ManifestItem> {
    const manifest = new Map<string, ManifestItem>();
    const items = this.toArray(packageDoc?.manifest?.item);

    for (const item of items) {
      const attrs = item?.$ || {};
      if (!attrs.id || !attrs.href) {
        continue;
      }

      manifest.set(attrs.id, {
        id: attrs.id,
        href: attrs.href,
        mediaType: attrs['media-type']
      });
    }

    return manifest;
  }

  private readSpineIds(packageDoc: any): string[] {
    return this.toArray(packageDoc?.spine?.itemref)
      .map(itemref => itemref?.$?.idref)
      .filter(Boolean);
  }

  private isReadableHtml(item: ManifestItem): boolean {
    const ext = path.posix.extname(item.href).toLowerCase();
    return item.mediaType === 'application/xhtml+xml'
      || item.mediaType === 'text/html'
      || ['.xhtml', '.html', '.htm'].includes(ext);
  }

  private htmlToText(html: string, fallbackTitle: string): { title: string; text: string } {
    const $ = cheerio.load(html, { xmlMode: false });
    $('script, style, nav, header, footer').remove();

    const title = this.cleanText(
      $('body h1').first().text()
      || $('body h2').first().text()
      || $('title').first().text()
      || fallbackTitle
    );

    const parts: string[] = [];
    $('body h1, body h2, body h3, body h4, body h5, body h6, body p, body li, body blockquote').each((_index, element) => {
      const text = this.cleanText($(element).text());
      if (text) {
        parts.push(text);
      }
    });

    const text = parts.length > 0
      ? parts.join('\n\n')
      : this.cleanText($('body').text() || $.root().text());

    return { title, text };
  }

  private getEntryText(entryMap: Map<string, any>, requestedPath: string): string | undefined {
    const candidates = [
      requestedPath,
      this.safeDecodeURIComponent(requestedPath)
    ].map(candidate => this.normalizeZipPath(candidate));

    for (const candidate of candidates) {
      const entry = entryMap.get(candidate);
      if (entry && !entry.isDirectory) {
        return entry.getData().toString('utf-8');
      }
    }

    return undefined;
  }

  private resolveZipPath(baseDir: string, href: string): string {
    const decodedHref = this.safeDecodeURIComponent(href.split('#')[0]);
    const base = baseDir === '.' ? '' : baseDir;
    return this.normalizeZipPath(path.posix.normalize(path.posix.join(base, decodedHref)));
  }

  private normalizeZipPath(value: string): string {
    return value.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  private firstText(value: any): string | undefined {
    const candidate = this.firstArrayValue(value);
    if (candidate === undefined || candidate === null) {
      return undefined;
    }

    if (typeof candidate === 'string') {
      return this.cleanText(candidate);
    }

    if (typeof candidate._ === 'string') {
      return this.cleanText(candidate._);
    }

    return undefined;
  }

  private firstArrayValue(value: any): any {
    return Array.isArray(value) ? value[0] : value;
  }

  private toArray(value: any): any[] {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private cleanText(value: string): string {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim();
  }

  private safeDecodeURIComponent(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private unsupported(filePath: string, reason: string, priorWarnings: string[] = []): ExtractedDocument {
    return {
      text: '',
      metadata: {
        source: filePath,
        title: path.basename(filePath),
        type: 'epub',
        error: reason
      },
      warnings: [...priorWarnings, reason]
    };
  }
}
