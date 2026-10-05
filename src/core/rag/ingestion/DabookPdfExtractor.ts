/**
 * Structure-aware PDF extraction through the DABOOK sidecar.
 *
 * Returns pre-chunked sections that carry page numbers, chapter/section breadcrumbs and a quality
 * score, with headers, footers and table-of-contents noise already removed. Every failure mode
 * (DABOOK disabled mid-flight, interpreter missing, timeout, scanned PDF, bad output...) falls
 * back to the flat `pdf-parse` extractor with an explicit `dabook-fallback: ...` warning, so
 * enabling DABOOK can never make ingestion worse than it is today.
 */

import { logger } from '../../observability/logger';
import { DabookBridge, DabookError, getDabookBridge } from '../../dabook';
import { dabookBookKey, mapRagRecords } from '../../dabook/DabookChunkMapper';
import { ExtractedDocument, FileExtractionOptions, FileExtractor, PreChunkedSection } from './ExtractedDocument';
import { PdfExtractor } from './PdfExtractor';

export class DabookPdfExtractor implements FileExtractor {
  constructor(
    private readonly bridge: DabookBridge = getDabookBridge(),
    private readonly fallback: FileExtractor = new PdfExtractor()
  ) {}

  canExtract(ext: string): boolean {
    return ext === '.pdf';
  }

  async extract(filePath: string, options: FileExtractionOptions = {}): Promise<ExtractedDocument> {
    if (options.preferStructuredPdf === false) {
      return this.fallback.extract(filePath, options);
    }
    if (!this.bridge.isEnabled()) {
      return this.fallbackWith(filePath, options, 'disabled', 'DABOOK is disabled');
    }

    try {
      const result = await this.bridge.ingest(filePath);
      const records = await this.bridge.readRagRecords(result);
      if (records.length === 0) {
        throw new DabookError('bad_output', 'DABOOK produced no retrieval chunks for this PDF', { report: result.report });
      }

      const chunks = mapRagRecords(records, {
        sourcePath: filePath,
        book: result.book,
        dabookVersion: result.report.dabook_version
      });
      const sections: PreChunkedSection[] = chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata
      }));

      const warnings = result.book.warnings.map(warning => `dabook: ${warning}`);
      logger.info('PDF extracted with DABOOK', {
        filePath,
        chunks: sections.length,
        pages: result.book.pages,
        quality: result.book.quality_score,
        durationMs: result.durationMs
      });

      return {
        text: sections.map(section => section.content).join('\n\n'),
        sections,
        metadata: {
          source: filePath,
          title: result.book.title || undefined,
          type: 'pdf',
          originalExtension: '.pdf',
          extractor: 'dabook',
          structured: true,
          pages: result.book.pages ?? undefined,
          docType: result.book.doc_type ?? undefined,
          qualityScore: result.book.quality_score ?? undefined,
          licenseStatus: result.book.license_status ?? undefined,
          bookSha256: result.book.sha256,
          bookKey: dabookBookKey(result.book.sha256),
          dabookVersion: result.report.dabook_version,
          dabookState: result.book.state
        },
        warnings
      };
    } catch (error) {
      const reason = error instanceof DabookError ? error.reason : 'unexpected';
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('DABOOK extraction failed; falling back to pdf-parse', { filePath, reason, message });
      return this.fallbackWith(filePath, options, reason, message);
    }
  }

  private async fallbackWith(
    filePath: string,
    options: FileExtractionOptions,
    reason: string,
    message: string
  ): Promise<ExtractedDocument> {
    const document = await this.fallback.extract(filePath, options);
    document.warnings = [...(document.warnings ?? []), `dabook-fallback: ${reason}: ${message}`];
    document.metadata = {
      ...document.metadata,
      extractor: 'pdf-parse',
      structured: false,
      dabookFallbackReason: reason
    };
    // A scanned PDF still ends up in the OCR queue unless the fallback's own OCR produced text.
    if (reason === 'needs_input' && !document.text.trim()) {
      document.metadata.needsOcr = true;
    }
    return document;
  }
}
