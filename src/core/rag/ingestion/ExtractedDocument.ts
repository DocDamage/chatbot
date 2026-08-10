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

export interface ExtractedDocument {
  text: string;
  metadata: Record<string, any>;
  warnings?: string[];
}

export interface FileExtractionOptions {
  enableImageOcr?: boolean;
  imageOcrLanguage?: string;
  maxGifFrames?: number;
  enableOfficeConversion?: boolean;
  enablePdfOcr?: boolean;
  pdfOcrMaxPages?: number;
  pdfOcrDpi?: number;
}

export interface FileExtractor {
  canExtract(ext: string, filePath: string): boolean;
  extract(filePath: string, options?: FileExtractionOptions): Promise<ExtractedDocument>;
}

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp']);
export const GIF_EXTENSIONS = new Set(['.gif']);
export const OFFICE_EXTENSIONS = new Set(['.doc', '.docx']);
