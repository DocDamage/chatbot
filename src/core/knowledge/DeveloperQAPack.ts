/**
 * Developer Q&A Pack (CRK Phase 13: CRK-P13-T01, T04, T05)
 * Ingestion, chunking, and relationship preservation for Stack Overflow / Developer Q&A.
 */

import { QAPair, QAChunk } from '../../types/developer-qa';
import { DeveloperQAQualityFilter } from './DeveloperQAQualityFilter';
import { DeveloperQAVersionExtractor } from './DeveloperQAVersionExtractor';

export class DeveloperQAPack {
  private qualityFilter: DeveloperQAQualityFilter;
  private versionExtractor: DeveloperQAVersionExtractor;
  private chunks: Map<string, QAChunk> = new Map();

  constructor(qualityFilter?: DeveloperQAQualityFilter, versionExtractor?: DeveloperQAVersionExtractor) {
    this.qualityFilter = qualityFilter || new DeveloperQAQualityFilter();
    this.versionExtractor = versionExtractor || new DeveloperQAVersionExtractor();
  }

  public indexQAPair(pair: QAPair): QAChunk | null {
    const filterResult = this.qualityFilter.evaluate(pair);
    if (!filterResult.accepted) {
      return null;
    }

    const versions = this.versionExtractor.extract(pair.tags, pair.questionTitle, pair.answerBody);

    // Format coherent chunk keeping question title + context + answer + CC BY-SA attribution
    const attribution = `Source: ${pair.site} (${pair.sourceUrl}) by ${pair.author}, licensed under ${pair.license}.`;
    const formattedContent = [
      `Q: ${pair.questionTitle}`,
      pair.questionBody ? `Context: ${pair.questionBody.slice(0, 300)}...` : '',
      `A: ${pair.answerBody}`,
      `Attribution: ${attribution}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Baseline authority: 0.85 for accepted / high quality SO, modulated by qualityScore
    const authority = Math.round((0.80 + filterResult.qualityScore * 0.08) * 100) / 100;

    const chunk: QAChunk = {
      chunkId: `qa-${pair.site}-${pair.externalId}-${pair.answerId}`,
      questionId: pair.id || `q-${pair.externalId}`,
      answerId: pair.answerId,
      title: pair.questionTitle,
      content: formattedContent,
      tags: [...pair.tags],
      products: versions,
      license: pair.license,
      attribution,
      sourceUrl: pair.sourceUrl,
      authority,
      freshnessDate: pair.lastActivityDate || pair.creationDate,
    };

    this.chunks.set(chunk.chunkId, chunk);
    return chunk;
  }

  public getChunk(chunkId: string): QAChunk | undefined {
    return this.chunks.get(chunkId);
  }

  public getAllChunks(): QAChunk[] {
    return Array.from(this.chunks.values());
  }

  public search(query: string, limit = 5): QAChunk[] {
    const normalized = query.toLowerCase();
    const keywords = normalized.split(/\s+/).filter((k) => k.length >= 3);

    const matches: Array<{ chunk: QAChunk; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      const text = `${chunk.title} ${chunk.content} ${chunk.tags.join(' ')}`.toLowerCase();
      let matchCount = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }
      if (matchCount > 0) {
        const score = (matchCount / keywords.length) * chunk.authority;
        matches.push({ chunk, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map((m) => m.chunk);
  }
}
