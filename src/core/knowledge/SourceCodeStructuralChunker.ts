/**
 * Source Code Structural Chunker (CRK Phase 14: CRK-P14-T05, T06, T09)
 * Performs syntax/symbol-aware chunking preserving hierarchy, relationships, and license provenance.
 */

import {
  CodeChunk,
  CodeSymbolInfo,
  CodeRelationshipMetadata,
  CodeProvenanceMetadata,
  WhitelistedLanguage,
} from '../../types/source-code-pack';
import { SourceCodeDeduplicator } from './SourceCodeDeduplicator';

export interface StructuralChunkInput {
  repository: string;
  commit: string;
  path: string;
  language: WhitelistedLanguage;
  content: string;
  repoLicense: string;
  datasetLicense?: string;
  sourceUrl?: string;
}

export class SourceCodeStructuralChunker {
  private deduplicator: SourceCodeDeduplicator;

  private static readonly SYMBOL_PATTERNS = [
    { type: 'class' as const, regex: /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/m },
    { type: 'interface' as const, regex: /^(?:export\s+)?interface\s+([A-Za-z0-9_]+)/m },
    { type: 'struct' as const, regex: /^(?:pub\s+)?struct\s+([A-Za-z0-9_]+)/m },
    {
      type: 'function' as const,
      regex: /^(?:export\s+|pub\s+|public\s+|private\s+|protected\s+)?(?:async\s+)?(?:def|fn|function|func)\s+([A-Za-z0-9_]+)/m,
    },
  ];

  constructor(deduplicator?: SourceCodeDeduplicator) {
    this.deduplicator = deduplicator || new SourceCodeDeduplicator();
  }

  public extractRelationships(content: string): CodeRelationshipMetadata {
    const lines = content.split('\n');
    const imports: string[] = [];
    const exports: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(?:import|from|use|require|#include)\s+/.test(trimmed)) {
        imports.push(trimmed);
      } else if (/^(?:export\s+|pub\s+)/.test(trimmed)) {
        exports.push(trimmed);
      }
    }

    return { imports: imports.slice(0, 15), exports: exports.slice(0, 15) };
  }

  public extractSymbols(content: string): CodeSymbolInfo[] {
    const symbols: CodeSymbolInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SourceCodeStructuralChunker.SYMBOL_PATTERNS) {
        const match = line.match(pattern.regex);
        if (match) {
          const name = match[1];
          // Find boundary or capture next 30 lines
          const startLine = i + 1;
          const endLine = Math.min(lines.length, startLine + 35);
          symbols.push({
            name,
            type: pattern.type,
            startLine,
            endLine,
            signature: line.trim(),
          });
          break;
        }
      }
    }

    return symbols;
  }

  public chunk(input: StructuralChunkInput): CodeChunk[] {
    const symbols = this.extractSymbols(input.content);
    const relationships = this.extractRelationships(input.content);
    const lines = input.content.split('\n');
    const chunks: CodeChunk[] = [];

    const baseProvenance: Omit<CodeProvenanceMetadata, 'startLine' | 'endLine'> = {
      repository: input.repository,
      commit: input.commit,
      path: input.path,
      repoLicense: input.repoLicense,
      datasetLicense: input.datasetLicense || 'Apache-2.0',
      sourceUrl: input.sourceUrl || `https://github.com/${input.repository}/blob/${input.commit}/${input.path}`,
    };

    if (symbols.length === 0) {
      // Small or script file: chunk entire content
      const exactHash = this.deduplicator.computeExactHash(input.content);
      const simHash = this.deduplicator.computeSimHash(input.content);

      if (!this.deduplicator.isExactDuplicate(exactHash) && !this.deduplicator.isNearDuplicate(simHash)) {
        const chunkId = `code-${input.repository}-${input.path}-full`.replace(/[^a-zA-Z0-9_-]/g, '_');
        this.deduplicator.register(chunkId, exactHash, simHash);
        chunks.push({
          chunkId,
          language: input.language,
          relationships,
          provenance: { ...baseProvenance, startLine: 1, endLine: lines.length },
          content: input.content,
          exactHash,
          simHash,
          authority: 0.85,
        });
      }
      return chunks;
    }

    // Chunk per symbol preserving hierarchy and relationships
    for (const symbol of symbols) {
      const symbolLines = lines.slice(symbol.startLine - 1, symbol.endLine);
      const symbolContent = symbolLines.join('\n');

      const exactHash = this.deduplicator.computeExactHash(symbolContent);
      const simHash = this.deduplicator.computeSimHash(symbolContent);

      if (this.deduplicator.isExactDuplicate(exactHash) || this.deduplicator.isNearDuplicate(simHash)) {
        continue;
      }

      const chunkId = `code-${input.repository}-${input.path}-${symbol.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      this.deduplicator.register(chunkId, exactHash, simHash);

      chunks.push({
        chunkId,
        language: input.language,
        symbol,
        relationships,
        provenance: { ...baseProvenance, startLine: symbol.startLine, endLine: symbol.endLine },
        content: symbolContent,
        exactHash,
        simHash,
        authority: 0.88,
      });
    }

    return chunks;
  }
}
