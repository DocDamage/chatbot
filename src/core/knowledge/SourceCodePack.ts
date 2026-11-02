/**
 * Curated Source Code Pack (CRK Phase 14: CRK-P14-T01, T04, T10)
 * Coordinates filtering, deduplication, structural chunking, and code pattern retrieval.
 */

import { CodeChunk, RepoQualitySignals, WhitelistedLanguage } from '../../types/source-code-pack';
import { SourceCodeFileFilter } from './SourceCodeFileFilter';
import { SourceCodeStructuralChunker } from './SourceCodeStructuralChunker';
import { SourceCodeDeduplicator } from './SourceCodeDeduplicator';

export interface IndexFileInput {
  repository: string;
  commit: string;
  path: string;
  content: string;
  repoSignals: RepoQualitySignals;
}

export class SourceCodePack {
  private fileFilter: SourceCodeFileFilter;
  private chunker: SourceCodeStructuralChunker;
  private deduplicator: SourceCodeDeduplicator;
  private index: Map<string, CodeChunk> = new Map();

  constructor(
    fileFilter?: SourceCodeFileFilter,
    chunker?: SourceCodeStructuralChunker,
    deduplicator?: SourceCodeDeduplicator
  ) {
    this.deduplicator = deduplicator || new SourceCodeDeduplicator();
    this.fileFilter = fileFilter || new SourceCodeFileFilter();
    this.chunker = chunker || new SourceCodeStructuralChunker(this.deduplicator);
  }

  public validateRepo(signals: RepoQualitySignals): { valid: boolean; reason?: string } {
    if (!signals.declaredLicense) {
      return { valid: false, reason: 'Repository lacks declared open source license' };
    }
    if (signals.isFork) {
      return { valid: false, reason: 'Duplicate fork rejected to prevent retrieval swamp' };
    }
    if (!signals.hasReadme && !signals.hasTests) {
      return { valid: false, reason: 'Repository lacks tests and documentation quality signals' };
    }
    return { valid: true };
  }

  public indexFile(input: IndexFileInput): CodeChunk[] {
    const repoValidation = this.validateRepo(input.repoSignals);
    if (!repoValidation.valid) {
      return [];
    }

    const filterResult = this.fileFilter.filter(input.path, input.content);
    if (!filterResult.accepted || !filterResult.detectedLanguage) {
      return [];
    }

    const chunks = this.chunker.chunk({
      repository: input.repository,
      commit: input.commit,
      path: input.path,
      language: filterResult.detectedLanguage,
      content: input.content,
      repoLicense: input.repoSignals.declaredLicense,
    });

    for (const chunk of chunks) {
      this.index.set(chunk.chunkId, chunk);
    }

    return chunks;
  }

  public getChunk(chunkId: string): CodeChunk | undefined {
    return this.index.get(chunkId);
  }

  public getAllChunks(): CodeChunk[] {
    return Array.from(this.index.values());
  }

  public search(query: string, language?: WhitelistedLanguage, limit = 5): CodeChunk[] {
    const keywords = query
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((k) => k.length >= 2);

    const matches: Array<{ chunk: CodeChunk; score: number }> = [];

    for (const chunk of this.index.values()) {
      if (language && chunk.language !== language) {
        continue;
      }

      let matchCount = 0;
      const text = `${chunk.symbol?.name || ''} ${chunk.provenance.path} ${chunk.content}`.toLowerCase();

      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }

      if (matchCount > 0) {
        const symbolBoost = chunk.symbol && query.toLowerCase().includes(chunk.symbol.name.toLowerCase()) ? 0.3 : 0;
        const score = (matchCount / keywords.length) * chunk.authority + symbolBoost;
        matches.push({ chunk, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map((m) => m.chunk);
  }
}
