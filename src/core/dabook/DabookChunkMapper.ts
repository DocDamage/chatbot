/**
 * Maps DABOOK `rag.jsonl` records onto the Chatbot's `DocumentChunk` shape.
 *
 * The mapping preserves what makes DABOOK chunks worth having: the page range, the
 * chapter/section path (for "Book › Chapter › Section, p. 42" citations), the node types and a
 * quality score. Chunk ids are stable across re-ingests of the same PDF.
 */

import { DocumentChunk } from '../../types/rag';
import { DabookBookReport, DabookRagRecord } from './DabookContract';

export const DABOOK_BREADCRUMB_SEPARATOR = ' › ';

export interface DabookChunkContext {
  /** Original PDF path; becomes `metadata.source`, which the store groups and replaces by. */
  sourcePath: string;
  book: Pick<DabookBookReport, 'sha256' | 'title' | 'pages' | 'doc_type' | 'quality_score' | 'license_status'>;
  dabookVersion?: string;
}

/** `dabook:<sha12>`, shared by every chunk of a book (`metadata.bookKey` and the id prefix). */
export function dabookBookKey(sha256: string): string {
  return `dabook:${sha256.slice(0, 12)}`;
}

export function dabookChunkId(sha256: string, chunkId: string): string {
  return `${dabookBookKey(sha256)}:${chunkId}`;
}

export function formatBreadcrumbs(breadcrumbs: readonly string[]): string {
  return breadcrumbs.map(part => part.trim()).filter(Boolean).join(DABOOK_BREADCRUMB_SEPARATOR);
}

export function mapRagRecordToChunk(
  record: DabookRagRecord,
  context: DabookChunkContext,
  chunkIndex: number
): DocumentChunk {
  const sha = context.book.sha256;
  const title = context.book.title || record.book_title || undefined;
  // No `parentId`: document_chunks.parent_id is a foreign key to another *chunk*, and a book is
  // not one. `metadata.bookKey` groups a book's chunks instead.
  return {
    id: dabookChunkId(sha, record.chunk_id),
    content: record.content,
    metadata: {
      source: context.sourcePath,
      title,
      type: 'pdf',
      originalExtension: '.pdf',
      extractor: 'dabook',
      structured: true,
      page: record.page_start,
      pageEnd: record.page_end,
      section: formatBreadcrumbs(record.breadcrumbs) || undefined,
      breadcrumbs: record.breadcrumbs,
      nodeTypes: record.node_types,
      nodeIds: record.node_ids,
      hasCode: record.has_code,
      tokenCount: record.token_count,
      qualityScore: record.quality ?? context.book.quality_score ?? undefined,
      bookSha256: sha,
      bookKey: dabookBookKey(sha),
      dabookChunkId: record.chunk_id,
      dabookVersion: context.dabookVersion,
      docType: context.book.doc_type ?? undefined,
      pages: context.book.pages ?? undefined,
      licenseStatus: context.book.license_status ?? undefined,
      chunkIndex
    }
  };
}

export function mapRagRecords(records: readonly DabookRagRecord[], context: DabookChunkContext): DocumentChunk[] {
  return records.map((record, index) => mapRagRecordToChunk(record, context, index));
}
