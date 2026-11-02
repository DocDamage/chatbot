/**
 * Research Knowledge Pack (CRK Phase 20: CRK-P20-T01 to T03)
 *
 * Implements scholarly academic research retrieval with license validation,
 * retraction suppression, and field-specific freshness evaluation.
 */

import { ResearchPaper, ResearchChunk } from '../../types/research-math-packs';
import { AcademicLicensePolicy } from './AcademicLicensePolicy';
import { ResearchPaperChunker, RawResearchPaperInput } from './ResearchPaperChunker';

export class ResearchPack {
  public readonly packId = 'research';
  private enabled = true;
  private licensePolicy: AcademicLicensePolicy;
  private chunker: ResearchPaperChunker;

  private papers: Map<string, ResearchPaper> = new Map();
  private chunks: Map<string, ResearchChunk> = new Map();

  constructor(
    licensePolicy?: AcademicLicensePolicy,
    chunker?: ResearchPaperChunker
  ) {
    this.licensePolicy = licensePolicy || new AcademicLicensePolicy();
    this.chunker = chunker || new ResearchPaperChunker();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Ingests and validates an academic research paper (§3140-3180)
   */
  public indexPaper(input: RawResearchPaperInput): { success: boolean; paper?: ResearchPaper; error?: string } {
    const licenseCheck = this.licensePolicy.evaluate(input.license);
    if (!licenseCheck.accepted) {
      return {
        success: false,
        error: licenseCheck.rejectionReason,
      };
    }

    const paper = this.chunker.chunkPaper(input);
    this.papers.set(paper.paperId, paper);

    // Only index non-retracted sections for retrieval (§3183-3191)
    if (!paper.isRetracted) {
      for (const section of paper.sections) {
        this.chunks.set(section.chunkId, section);
      }
    }

    return {
      success: true,
      paper,
    };
  }

  public getPaper(paperId: string): ResearchPaper | undefined {
    return this.papers.get(paperId);
  }

  public getAllPapers(): ResearchPaper[] {
    return Array.from(this.papers.values());
  }

  public search(query: string, limit = 5): ResearchChunk[] {
    if (!this.enabled) return [];

    const normalized = query.toLowerCase();
    const keywords = normalized.split(/\s+/).filter((k) => k.length >= 3);
    if (keywords.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const matches: Array<{ chunk: ResearchChunk; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      // Retraction safety guard (§3185)
      if (chunk.isRetracted) continue;

      const text = `${chunk.title} ${chunk.sectionTitle} ${chunk.content} ${chunk.field}`.toLowerCase();
      let matchCount = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }

      if (matchCount > 0) {
        // Keyword score modulated by authority (0.88)
        let score = (matchCount / keywords.length) * chunk.authority;

        // Abstract boost
        if (chunk.sectionType === 'abstract') score += 0.15;

        // Freshness modulation (§3181-3191): decay per year difference
        const ageYears = Math.max(0, currentYear - chunk.year);
        const freshnessFactor = Math.max(0.70, 1.0 - (ageYears * 0.02)); // modest decay
        score *= freshnessFactor;

        matches.push({ chunk, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map((m) => m.chunk);
  }
}
