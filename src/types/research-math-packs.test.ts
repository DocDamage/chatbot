/**
 * Research and Math Pack Schemas & Types Tests (CRK Phase 20)
 */

import {
  researchChunkSchema,
  researchPaperSchema,
  mathTheoremChunkSchema,
  mathDocumentSchema,
  ResearchPaper,
  MathTheoremChunk,
} from './research-math-packs';

describe('Research and Math Packs Types & Schemas', () => {
  it('validates ResearchPaper and ResearchChunk schemas', () => {
    const chunk = {
      chunkId: 'res-chunk-1',
      paperId: 'arxiv-2301-12345',
      arxivId: '2301.12345',
      doi: '10.1145/1234567',
      title: 'Attention Is All You Need',
      authors: ['Vaswani et al.'],
      year: 2017,
      venue: 'NeurIPS',
      field: 'artificial_intelligence',
      sectionType: 'methodology' as const,
      sectionTitle: '3. Model Architecture',
      content: 'The Transformer follows this overall architecture using stacked self-attention...',
      sourceUrl: 'https://arxiv.org/abs/2301.12345',
      license: 'arXiv-non-exclusive' as const,
      isRetracted: false,
      hasErrata: false,
      authority: 0.88,
      publishedDate: '2017-06-12',
    };

    const parsedChunk = researchChunkSchema.parse(chunk);
    expect(parsedChunk.chunkId).toBe('res-chunk-1');
    expect(parsedChunk.field).toBe('artificial_intelligence');

    const paper: ResearchPaper = {
      paperId: 'arxiv-2301-12345',
      arxivId: '2301.12345',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      year: 2017,
      field: 'computer_science',
      abstract: 'The dominant sequence transduction models are based on complex recurrent...',
      sections: [parsedChunk],
      sourceUrl: 'https://arxiv.org/abs/2301.12345',
      license: 'arXiv-non-exclusive',
      isRetracted: false,
      hasErrata: false,
      publishedDate: '2017-06-12',
    };

    const parsedPaper = researchPaperSchema.parse(paper);
    expect(parsedPaper.title).toBe('Attention Is All You Need');
    expect(parsedPaper.sections).toHaveLength(1);
  });

  it('validates MathTheoremChunk and MathDocument schemas with LaTeX equations', () => {
    const mathChunk: MathTheoremChunk = {
      chunkId: 'math-thm-pythagoras',
      docId: 'math-doc-euclid',
      title: 'Pythagorean Theorem',
      chunkType: 'theorem',
      identifier: 'Theorem 1.1',
      statement: 'In a right triangle with legs $a, b$ and hypotenuse $c$, $a^2 + b^2 = c^2$.',
      proofOrDerivation: 'By constructing four identical triangles within a square...',
      latexEquations: ['$a^2 + b^2 = c^2$'],
      dependencies: [],
      domain: 'geometry',
      sourceUrl: 'https://openwebmath.org/geometry/pythagoras',
      license: 'CC-BY-SA-4.0',
      authority: 0.88,
    };

    const parsed = mathTheoremChunkSchema.parse(mathChunk);
    expect(parsed.identifier).toBe('Theorem 1.1');
    expect(parsed.latexEquations).toContain('$a^2 + b^2 = c^2$');

    const doc = {
      docId: 'math-doc-euclid',
      title: 'Foundations of Euclidean Geometry',
      authors: ['Euclid'],
      domain: 'geometry',
      chunks: [parsed],
      license: 'CC-BY-SA-4.0',
    };
    const parsedDoc = mathDocumentSchema.parse(doc);
    expect(parsedDoc.chunks).toHaveLength(1);
  });
});
