/**
 * Study Source Ingest Engine (PX15-T02)
 *
 * Implements source segmentation, chapter/heading hierarchy extraction,
 * retrieval chunking, and glossary term extraction with source anchor citations.
 */

import * as crypto from 'crypto';
import { SourceChunk, StudySource, StudySourceAnchor } from './StudyTypes';

export interface StudyIngestionResult {
  sourceId: string;
  chapters: string[];
  chunks: SourceChunk[];
  glossaryTerms: Array<{ term: string; definition: string; anchor: StudySourceAnchor }>;
  totalChunkCount: number;
}

export class StudySourceIngestEngine {
  /**
   * Ingests and segments a source into retrieval chunks and glossary terms.
   */
  public ingestSource(source: StudySource, maxChunkChars: number = 2000): StudyIngestionResult {
    const rawText = source.content;
    const lines = rawText.split(/\r?\n/);

    const chapters: string[] = [];
    const chunks: SourceChunk[] = [];
    const glossaryTerms: Array<{ term: string; definition: string; anchor: StudySourceAnchor }> = [];

    let currentChapter = 'Overview';
    let currentChunkLines: string[] = [];
    let currentChunkStartOffset = 0;
    let currentOffset = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineLen = line.length + 1; // +1 for newline

      // Heading detection (# Chapter 1 / ## Section)
      const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
      if (headingMatch) {
        // Finalize previous chunk if exists
        if (currentChunkLines.length > 0) {
          const chunkText = currentChunkLines.join('\n');
          const anchor: StudySourceAnchor = {
            sourceId: source.id,
            sourceTitle: source.title,
            sectionTitle: currentChapter,
            startOffset: currentChunkStartOffset,
            endOffset: currentOffset,
            citationText: `[Source: ${source.title} - ${currentChapter}]`
          };

          chunks.push({
            chunkId: `chk-${crypto.randomUUID()}`,
            sourceId: source.id,
            sourceTitle: source.title,
            chapterTitle: currentChapter,
            text: chunkText,
            startOffset: currentChunkStartOffset,
            endOffset: currentOffset,
            anchor
          });
          currentChunkLines = [];
        }

        currentChapter = headingMatch[1].trim();
        if (!chapters.includes(currentChapter)) {
          chapters.push(currentChapter);
        }
        currentChunkStartOffset = currentOffset;
      } else {
        currentChunkLines.push(line);

        // Glossary pattern detection: e.g. "**Term**: Definition" or "Term — Definition"
        const glossaryMatch = line.match(/^\s*(?:\*\*|__)?([A-Za-z0-9\s-]+)(?:\*\*|__)?\s*(?::|—|-)\s+(.*)$/);
        if (glossaryMatch && glossaryMatch[1].length < 50 && glossaryMatch[2].length > 10) {
          const term = glossaryMatch[1].trim();
          const def = glossaryMatch[2].trim();
          glossaryTerms.push({
            term,
            definition: def,
            anchor: {
              sourceId: source.id,
              sourceTitle: source.title,
              sectionTitle: currentChapter,
              startOffset: currentOffset,
              endOffset: currentOffset + line.length,
              citationText: `[Source: ${source.title} - ${currentChapter}]`
            }
          });
        }
      }

      currentOffset += lineLen;

      // Check chunk length boundary
      const currentChunkLen = currentChunkLines.join('\n').length;
      if (currentChunkLen >= maxChunkChars) {
        const chunkText = currentChunkLines.join('\n');
        const anchor: StudySourceAnchor = {
          sourceId: source.id,
          sourceTitle: source.title,
          sectionTitle: currentChapter,
          startOffset: currentChunkStartOffset,
          endOffset: currentOffset,
          citationText: `[Source: ${source.title} - ${currentChapter}]`
        };

        chunks.push({
          chunkId: `chk-${crypto.randomUUID()}`,
          sourceId: source.id,
          sourceTitle: source.title,
          chapterTitle: currentChapter,
          text: chunkText,
          startOffset: currentChunkStartOffset,
          endOffset: currentOffset,
          anchor
        });

        currentChunkLines = [];
        currentChunkStartOffset = currentOffset;
      }
    }

    // Final trailing chunk
    if (currentChunkLines.length > 0) {
      const chunkText = currentChunkLines.join('\n');
      const anchor: StudySourceAnchor = {
        sourceId: source.id,
        sourceTitle: source.title,
        sectionTitle: currentChapter,
        startOffset: currentChunkStartOffset,
        endOffset: currentOffset,
        citationText: `[Source: ${source.title} - ${currentChapter}]`
      };

      chunks.push({
        chunkId: `chk-${crypto.randomUUID()}`,
        sourceId: source.id,
        sourceTitle: source.title,
        chapterTitle: currentChapter,
        text: chunkText,
        startOffset: currentChunkStartOffset,
        endOffset: currentOffset,
        anchor
      });
    }

    return {
      sourceId: source.id,
      chapters,
      chunks,
      glossaryTerms,
      totalChunkCount: chunks.length
    };
  }
}
