/**
 * Claim-Source Association Service (CRK-P15-T02)
 *
 * Maps assertions and claims in generated assistant responses to specific
 * citations, chunk IDs, sources, and dataset versions.
 *
 * In accordance with §2717, this service explicitly distinguishes between
 * verified sentence-level claim bindings and broader response-level source
 * references to prevent false claims of sentence-level precision.
 */

import { CitationRef, ClaimSourceAssociation } from '../../types/citation';

export interface ClaimAssociationOptions {
  minSentenceConfidence?: number;
  minResponseConfidence?: number;
  allowSentenceLevel?: boolean;
}

export class ClaimAssociationService {
  private readonly defaultSentenceThreshold: number;
  private readonly defaultResponseThreshold: number;

  constructor(options?: ClaimAssociationOptions) {
    this.defaultSentenceThreshold = options?.minSentenceConfidence ?? 0.45;
    this.defaultResponseThreshold = options?.minResponseConfidence ?? 0.20;
  }

  /**
   * Associates claims in the response with available citations.
   */
  public associateClaims(
    response: string,
    citations: CitationRef[],
    options?: ClaimAssociationOptions
  ): ClaimSourceAssociation[] {
    if (!response || response.trim().length === 0 || !citations || citations.length === 0) {
      return [];
    }

    const allowSentence = options?.allowSentenceLevel ?? true;
    const sentenceThreshold = options?.minSentenceConfidence ?? this.defaultSentenceThreshold;
    const responseThreshold = options?.minResponseConfidence ?? this.defaultResponseThreshold;

    const associations: ClaimSourceAssociation[] = [];
    const sentences = this.splitSentences(response);

    if (allowSentence && sentences.length > 1) {
      // Attempt sentence-level claim binding
      sentences.forEach((sentence, index) => {
        const matchingCitations = this.findMatchingCitations(sentence, citations, sentenceThreshold);
        if (matchingCitations.length > 0) {
          const primaryCit = matchingCitations[0].citation;
          associations.push({
            claimId: `clm-sent-${index + 1}`,
            claimText: sentence,
            citationIds: matchingCitations.map(m => m.citation.id),
            chunkIds: matchingCitations.map(m => m.citation.chunkId),
            sourceId: primaryCit.sourceId,
            datasetId: primaryCit.datasetId,
            version: primaryCit.version,
            level: 'sentence',
            confidence: matchingCitations[0].score,
          });
        }
      });
    }

    // If no sentence-level associations were qualified, or as response-level fallback
    if (associations.length === 0) {
      const responseMatches = this.findMatchingCitations(response, citations, responseThreshold);
      if (responseMatches.length > 0) {
        const primaryCit = responseMatches[0].citation;
        associations.push({
          claimId: 'clm-resp-1',
          claimText: response.trim(),
          citationIds: responseMatches.map(m => m.citation.id),
          chunkIds: responseMatches.map(m => m.citation.chunkId),
          sourceId: primaryCit.sourceId,
          datasetId: primaryCit.datasetId,
          version: primaryCit.version,
          level: 'response',
          confidence: responseMatches[0].score,
        });
      }
    }

    return associations;
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.?!])\s+(?=[A-Z0-9`"'])/)
      .map(s => s.trim())
      .filter(s => s.length > 15);
  }

  private findMatchingCitations(
    text: string,
    citations: CitationRef[],
    threshold: number
  ): Array<{ citation: CitationRef; score: number }> {
    const textWords = this.tokenize(text);
    if (textWords.size === 0) return [];

    const results: Array<{ citation: CitationRef; score: number }> = [];

    for (const citation of citations) {
      const titleWords = this.tokenize(citation.title);
      let matchCount = 0;
      for (const word of textWords) {
        if (titleWords.has(word)) {
          matchCount++;
        }
      }

      // Base overlap with title and available metadata
      const overlap = matchCount / Math.max(textWords.size, 1);
      const authorityBonus = (citation.authority ?? 0.8) * 0.15;
      const citationScore = citation.score ?? 0.5;
      const combinedScore = Math.min(1.0, (overlap * 1.5) + (citationScore * 0.5) + authorityBonus);

      if (combinedScore >= threshold) {
        results.push({ citation, score: parseFloat(combinedScore.toFixed(3)) });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private tokenize(text: string): Set<string> {
    const words = text.toLowerCase().match(/\b[a-z0-9_]{3,}\b/g) || [];
    const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'more', 'when', 'what', 'then', 'into']);
    return new Set(words.filter(w => !stopWords.has(w)));
  }
}
