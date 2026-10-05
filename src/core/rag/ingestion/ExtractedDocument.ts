/**
 * Shared file extraction contracts for RAG ingestion.
 */

export type ExtractedDocumentType =
  | 'text'
  | 'markdown'
  | 'json'
  | 'html'
  | 'rtf'
  | 'pdf'
  | 'epub'
  | 'mobi'
  | 'docx'
  | 'doc'
  | 'image'
  | 'gif'
  | 'unknown';

/**
 * A section an extractor has already split into retrieval-sized chunks. When an
 * `ExtractedDocument` carries sections, the ingester maps them straight to chunks and skips its
 * own word-window chunker (structure-aware extractors such as DABOOK know better where to cut).
 */
export interface PreChunkedSection {
  id: string;
  content: string;
  /** Merged over the document metadata (page, section, breadcrumbs, ...). */
  metadata: Record<string, any>;
  parentId?: string;
}

export interface ExtractedDocument {
  text: string;
  metadata: Record<string, any>;
  warnings?: string[];
  /** Pre-chunked content; when present it replaces generic chunking of `text`. */
  sections?: PreChunkedSection[];
}

export interface FileExtractionOptions {
  enableImageOcr?: boolean;
  imageOcrLanguage?: string;
  maxGifFrames?: number;
  enableOfficeConversion?: boolean;
  enablePdfOcr?: boolean;
  pdfOcrMaxPages?: number;
  pdfOcrDpi?: number;
  /**
   * Use the structure-aware PDF pipeline (DABOOK) when it is enabled. Set to `false` to force the
   * flat `pdf-parse` extractor for one call.
   */
  preferStructuredPdf?: boolean;
}

export interface FileExtractor {
  canExtract(ext: string, filePath: string): boolean;
  extract(filePath: string, options?: FileExtractionOptions): Promise<ExtractedDocument>;
}

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp']);
export const GIF_EXTENSIONS = new Set(['.gif']);
export const OFFICE_EXTENSIONS = new Set(['.doc', '.docx']);
