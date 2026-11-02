/**
 * Research Paper Chunker (CRK Phase 20: CRK-P20-T02)
 *
 * Implements structural chunking preserving:
 * paper -> title -> abstract -> section -> subsection -> figures/tables.
 * Excludes bibliography from prose retrieval by default (§3179).
 */

import {
  ResearchPaper,
  ResearchChunk,
  ResearchSectionType,
  AcademicLicense,
} from '../../types/research-math-packs';

export interface RawResearchPaperInput {
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  arxivId?: string;
  venue?: string;
  field?: string;
  abstract: string;
  bodyMarkdown: string;
  sourceUrl: string;
  license: AcademicLicense;
  isRetracted?: boolean;
  hasErrata?: boolean;
  retractionReason?: string;
  publishedDate?: string;
}

export class ResearchPaperChunker {
  private static readonly BIBLIOGRAPHY_HEADERS = new Set([
    'references',
    'bibliography',
    'works cited',
    'literature cited',
  ]);

  /**
   * Chunks a scholarly paper preserving structural sections (§3155-3180)
   */
  public chunkPaper(input: RawResearchPaperInput): ResearchPaper {
    const sections: ResearchChunk[] = [];
    const publishedDate = input.publishedDate || `${input.year}-01-01`;
    const field = input.field || 'computer_science';

    // 1. Abstract Chunk
    sections.push({
      chunkId: `${input.paperId}#abstract`,
      paperId: input.paperId,
      doi: input.doi,
      arxivId: input.arxivId,
      title: input.title,
      authors: input.authors,
      year: input.year,
      venue: input.venue,
      field,
      sectionType: 'abstract',
      sectionTitle: 'Abstract',
      content: input.abstract.trim(),
      sourceUrl: `${input.sourceUrl}#abstract`,
      license: input.license,
      isRetracted: input.isRetracted || false,
      hasErrata: input.hasErrata || false,
      authority: 0.88,
      publishedDate,
    });

    // 2. Parse body sections
    const lines = input.bodyMarkdown.split(/\r?\n/);
    let currentTitle = 'Introduction';
    let currentLines: string[] = [];
    let sectionIdx = 1;

    const finalizeSection = () => {
      const text = currentLines.join('\n').trim();
      if (!text) return;

      const normalizedTitle = currentTitle.toLowerCase().replace(/^\d+[\.\s]+/, '');
      
      // Filter bibliography from equal-priority prose (§3179)
      if (ResearchPaperChunker.BIBLIOGRAPHY_HEADERS.has(normalizedTitle)) {
        currentLines = [];
        return;
      }

      const sectionType = this.inferSectionType(normalizedTitle);
      const anchor = currentTitle.replace(/\s+/g, '_');

      sections.push({
        chunkId: `${input.paperId}#sec-${sectionIdx++}`,
        paperId: input.paperId,
        doi: input.doi,
        arxivId: input.arxivId,
        title: input.title,
        authors: input.authors,
        year: input.year,
        venue: input.venue,
        field,
        sectionType,
        sectionTitle: currentTitle,
        content: text,
        sourceUrl: `${input.sourceUrl}#${anchor}`,
        license: input.license,
        isRetracted: input.isRetracted || false,
        hasErrata: input.hasErrata || false,
        authority: 0.88,
        publishedDate,
      });

      currentLines = [];
    };

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,4}\s+(.*)$/);
      if (headerMatch) {
        finalizeSection();
        currentTitle = headerMatch[1].trim();
      } else {
        currentLines.push(line);
      }
    }

    finalizeSection();

    return {
      paperId: input.paperId,
      doi: input.doi,
      arxivId: input.arxivId,
      title: input.title,
      authors: input.authors,
      year: input.year,
      venue: input.venue,
      field,
      abstract: input.abstract,
      sections,
      sourceUrl: input.sourceUrl,
      license: input.license,
      isRetracted: input.isRetracted || false,
      hasErrata: input.hasErrata || false,
      retractionReason: input.retractionReason,
      publishedDate,
    };
  }

  private inferSectionType(titleLower: string): ResearchSectionType {
    if (titleLower.includes('method') || titleLower.includes('architecture') || titleLower.includes('approach')) {
      return 'methodology';
    }
    if (titleLower.includes('result') || titleLower.includes('experiment') || titleLower.includes('evaluation')) {
      return 'results';
    }
    if (titleLower.includes('discuss') || titleLower.includes('analysis')) {
      return 'discussion';
    }
    if (titleLower.includes('conclu') || titleLower.includes('summary')) {
      return 'conclusion';
    }
    if (titleLower.includes('table') || titleLower.includes('figure')) {
      return 'figures_tables';
    }
    if (titleLower.includes('intro') || titleLower.includes('background')) {
      return 'introduction';
    }
    return 'methodology';
  }
}
