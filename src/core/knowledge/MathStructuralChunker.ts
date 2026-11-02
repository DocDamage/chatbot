/**
 * Math Structural Chunker (CRK Phase 20: CRK-P20-T04 & T05)
 *
 * Preserves LaTeX delimiters, equation boundaries ($...$, $$...$$, \[...\]),
 * theorem/proof cohesive units, and mathematical definitions without breaking derivations.
 */

import { MathTheoremChunk, MathChunkType } from '../../types/research-math-packs';

export interface RawMathDocumentInput {
  docId: string;
  title: string;
  authors?: string[];
  bodyMarkdownOrLatex: string;
  domain?: string;
  sourceUrl?: string;
  license?: string;
}

export class MathStructuralChunker {
  private static readonly THEOREM_KEYWORDS: Array<{ keyword: RegExp; type: MathChunkType }> = [
    { keyword: /^(?:###?\s+)?(?:Theorem|Thm)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'theorem' },
    { keyword: /^(?:###?\s+)?(?:Lemma)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'lemma' },
    { keyword: /^(?:###?\s+)?(?:Corollary)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'corollary' },
    { keyword: /^(?:###?\s+)?(?:Definition|Def)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'definition' },
    { keyword: /^(?:###?\s+)?(?:Derivation)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'derivation' },
    { keyword: /^(?:###?\s+)?(?:Formula)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'formula' },
    { keyword: /^(?:###?\s+)?(?:Example)\s*(\d+(?:\.\d+)*)?[:\.\s-]*(.*)$/i, type: 'example' },
  ];

  /**
   * Extracts LaTeX equations from a text span (§3201-3203)
   */
  public extractLatexEquations(text: string): string[] {
    const equations: string[] = [];
    // Display math: $$...$$ or \[...\]
    const displayMatches = text.match(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g);
    if (displayMatches) {
      for (const eq of displayMatches) equations.push(eq.trim());
    }
    // Inline math: $...$
    const inlineMatches = text.match(/\$(?!\$)[^$\n]+?\$/g);
    if (inlineMatches) {
      for (const eq of inlineMatches) equations.push(eq.trim());
    }
    return equations;
  }

  /**
   * Chunks math documents keeping theorem statements, definitions, and proofs bonded (§3208-3215)
   */
  public chunkMathDocument(input: RawMathDocumentInput): MathTheoremChunk[] {
    const lines = input.bodyMarkdownOrLatex.split(/\r?\n/);
    const chunks: MathTheoremChunk[] = [];
    const domain = input.domain || 'mathematics';
    const license = input.license || 'CC-BY-SA-4.0';

    let currentTitle = input.title;
    let currentType: MathChunkType = 'definition';
    let currentId = 'Def 1';
    let statementLines: string[] = [];
    let proofLines: string[] = [];
    let inProof = false;
    let chunkCounter = 1;

    const finalizeChunk = () => {
      const statement = statementLines.join('\n').trim();
      if (!statement) return;

      const proof = proofLines.join('\n').trim();
      const combinedText = `${statement}\n\n${proof}`.trim();
      const equations = this.extractLatexEquations(combinedText);

      chunks.push({
        chunkId: `${input.docId}#chunk-${chunkCounter++}`,
        docId: input.docId,
        title: currentTitle,
        chunkType: currentType,
        identifier: currentId,
        statement,
        proofOrDerivation: proof.length > 0 ? proof : undefined,
        latexEquations: equations,
        dependencies: this.extractDependencies(statement),
        domain,
        sourceUrl: input.sourceUrl,
        license,
        authority: 0.88,
      });

      statementLines = [];
      proofLines = [];
      inProof = false;
    };

    for (const line of lines) {
      // Check for theorem/definition/lemma headers
      let matchedType: MathChunkType | null = null;
      let matchedId = '';
      let matchedTitle = '';

      for (const pattern of MathStructuralChunker.THEOREM_KEYWORDS) {
        const match = line.match(pattern.keyword);
        if (match) {
          matchedType = pattern.type;
          matchedId = match[1] ? `${matchedType} ${match[1]}` : matchedType;
          matchedTitle = match[2] ? match[2].trim() : `${matchedId}`;
          break;
        }
      }

      if (matchedType) {
        finalizeChunk();
        currentType = matchedType;
        currentId = matchedId;
        currentTitle = matchedTitle || `${input.title} - ${matchedId}`;
        continue;
      }

      // Check for proof boundary (keep bonded to current theorem/lemma, do not split)
      if (/^(?:###?\s+)?(?:Proof|Pf[:\.\s])/i.test(line)) {
        inProof = true;
        proofLines.push(line);
        continue;
      }

      if (inProof) {
        proofLines.push(line);
      } else {
        statementLines.push(line);
      }
    }

    finalizeChunk();
    return chunks;
  }

  private extractDependencies(text: string): string[] {
    const matches = text.match(/(?:Theorem|Lemma|Definition)\s+\d+(?:\.\d+)*/gi);
    return matches ? Array.from(new Set(matches)) : [];
  }
}
