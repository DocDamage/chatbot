/**
 * Mathematics & Formal Proofs Pack (CRK Phase 20: CRK-P20-T04 & T05)
 *
 * Manages mathematical definitions, theorems, derivations, and formulas
 * while preserving LaTeX boundaries and symbolic notation integrity.
 */

import { MathTheoremChunk, MathDocument } from '../../types/research-math-packs';
import { MathStructuralChunker, RawMathDocumentInput } from './MathStructuralChunker';

export class MathPack {
  public readonly packId = 'math';
  private enabled = true;
  private chunker: MathStructuralChunker;

  private documents: Map<string, MathDocument> = new Map();
  private chunks: Map<string, MathTheoremChunk> = new Map();

  constructor(chunker?: MathStructuralChunker) {
    this.chunker = chunker || new MathStructuralChunker();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Ingests a mathematical document into structured theorem/proof chunks (§3192-3215)
   */
  public indexDocument(input: RawMathDocumentInput): MathDocument {
    const theoremChunks = this.chunker.chunkMathDocument(input);

    const doc: MathDocument = {
      docId: input.docId,
      title: input.title,
      authors: input.authors || [],
      domain: input.domain || 'mathematics',
      chunks: theoremChunks,
      license: input.license || 'CC-BY-SA-4.0',
      sourceUrl: input.sourceUrl,
    };

    this.documents.set(doc.docId, doc);
    for (const chunk of theoremChunks) {
      this.chunks.set(chunk.chunkId, chunk);
    }

    return doc;
  }

  public getChunk(chunkId: string): MathTheoremChunk | undefined {
    return this.chunks.get(chunkId);
  }

  public getAllChunks(): MathTheoremChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Search mathematical knowledge base preserving LaTeX equations (§3208-3230)
   */
  public search(query: string, limit = 5): MathTheoremChunk[] {
    if (!this.enabled) return [];

    const normalized = query.toLowerCase();
    const keywords = normalized.split(/\s+/).filter((k) => k.length >= 2);
    if (keywords.length === 0) return [];

    const matches: Array<{ chunk: MathTheoremChunk; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      const eqText = chunk.latexEquations.join(' ').toLowerCase();
      const fullText = `${chunk.title} ${chunk.identifier || ''} ${chunk.statement} ${chunk.proofOrDerivation || ''} ${chunk.domain} ${eqText}`.toLowerCase();

      let matchCount = 0;
      for (const kw of keywords) {
        if (fullText.includes(kw)) matchCount++;
      }

      if (matchCount > 0) {
        let score = (matchCount / keywords.length) * chunk.authority;

        // Definition boost when query asks for definition
        if (normalized.includes('definition') && chunk.chunkType === 'definition') {
          score += 0.25;
        }

        // Theorem / proof boost when query asks for theorem or proof
        if ((normalized.includes('theorem') || normalized.includes('proof')) && (chunk.chunkType === 'theorem' || chunk.proofOrDerivation)) {
          score += 0.25;
        }

        matches.push({ chunk, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map((m) => m.chunk);
  }
}
