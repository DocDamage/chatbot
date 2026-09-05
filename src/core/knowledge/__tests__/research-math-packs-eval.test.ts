/**
 * Research & Math Packs Evaluation Suite & Phase 20 Exit Gate (CRK Phase 20: CRK-P20-T01 to T06)
 */

import { AcademicLicensePolicy } from '../AcademicLicensePolicy';
import { ResearchPaperChunker } from '../ResearchPaperChunker';
import { ResearchPack } from '../ResearchPack';
import { MathStructuralChunker } from '../MathStructuralChunker';
import { MathPack } from '../MathPack';
import { KnowledgeRouter } from '../KnowledgeRouter';

describe('Research and Math Packs (CRK Phase 20)', () => {
  describe('CRK-P20-T01: Academic License Policy', () => {
    let policy: AcademicLicensePolicy;

    beforeEach(() => {
      policy = new AcademicLicensePolicy();
    });

    it('accepts permissive academic licenses (CC-BY-4.0, arXiv-non-exclusive, OpenAccess)', () => {
      expect(policy.evaluate('CC-BY-4.0').accepted).toBe(true);
      expect(policy.evaluate('arXiv-non-exclusive').accepted).toBe(true);
      expect(policy.evaluate('OpenAccess-Permissive').accepted).toBe(true);
      expect(policy.evaluate('CC0-1.0').accepted).toBe(true);
    });

    it('strictly rejects proprietary closed-access research papers (§3151)', () => {
      const closed = policy.evaluate('proprietary-closed');
      expect(closed.accepted).toBe(false);
      expect(closed.rejectionReason).toContain('strictly prohibited');

      const unknown = policy.evaluate('unknown');
      expect(unknown.accepted).toBe(false);
    });
  });

  describe('CRK-P20-T02: Research Chunking & Bibliography Exclusion', () => {
    let chunker: ResearchPaperChunker;

    beforeEach(() => {
      chunker = new ResearchPaperChunker();
    });

    it('preserves abstract and sections while excluding bibliography from retrieval chunks (§3179)', () => {
      const markdown = `
# 1. Introduction
Deep learning has revolutionized computer vision and natural language processing.

# 2. Methodology
We propose a self-supervised transformer architecture.

# References
[1] Vaswani et al. Attention is all you need. 2017.
[2] Devlin et al. BERT. 2018.
`;

      const paper = chunker.chunkPaper({
        paperId: 'paper-transformer-01',
        title: 'Advances in Deep Transformers',
        authors: ['Researcher One', 'Researcher Two'],
        year: 2024,
        abstract: 'This paper studies self-supervised transformer scaling.',
        bodyMarkdown: markdown,
        sourceUrl: 'https://arxiv.org/abs/2401.00001',
        license: 'CC-BY-4.0',
      });

      expect(paper.sections.length).toBe(3); // Abstract + Introduction + Methodology
      expect(paper.sections[0].sectionType).toBe('abstract');
      expect(paper.sections[0].content).toContain('This paper studies');

      // Verify bibliography is NOT in search sections
      const bibSection = paper.sections.find((s) => s.sectionTitle.toLowerCase().includes('references'));
      expect(bibSection).toBeUndefined();
    });
  });

  describe('CRK-P20-T03: Research Freshness & Retraction Suppression', () => {
    let pack: ResearchPack;

    beforeEach(() => {
      pack = new ResearchPack();
    });

    it('suppresses retracted research papers from retrieval results (§3185)', () => {
      // Ingest legitimate paper
      pack.indexPaper({
        paperId: 'paper-valid-01',
        title: 'Quantum Advantage Demonstration',
        authors: ['Quantum Physicist'],
        year: 2023,
        abstract: 'We report quantum computational supremacy on random circuits.',
        bodyMarkdown: '# Results\nHigh fidelity quantum simulation.',
        sourceUrl: 'https://arxiv.org/abs/2301.00002',
        license: 'CC-BY-4.0',
        isRetracted: false,
      });

      // Ingest retracted paper
      pack.indexPaper({
        paperId: 'paper-retracted-01',
        title: 'Superconductivity at Room Temperature and Ambient Pressure',
        authors: ['Disputed Lab'],
        year: 2023,
        abstract: 'Room temperature ambient pressure superconductivity observed in modified lead-apatite.',
        bodyMarkdown: '# Claim\nZero resistance observed at 293K.',
        sourceUrl: 'https://arxiv.org/abs/2307.00003',
        license: 'CC-BY-4.0',
        isRetracted: true,
        retractionReason: 'Failed independent replication; data anomalies.',
      });

      const results = pack.search('superconductivity');
      expect(results).toHaveLength(0); // Retracted paper completely suppressed from search

      const validResults = pack.search('quantum supremacy computational');
      expect(validResults.length).toBeGreaterThan(0);
      expect(validResults[0].paperId).toBe('paper-valid-01');
    });

    it('rejects paper with non-permissive license during ingestion', () => {
      const result = pack.indexPaper({
        paperId: 'paper-closed-01',
        title: 'Secret Commercial Algorithm',
        authors: ['Corporate Lab'],
        year: 2024,
        abstract: 'Proprietary model.',
        bodyMarkdown: '# Text\nHidden.',
        sourceUrl: 'https://publisher.com/closed',
        license: 'proprietary-closed',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CRK-P20-T04 & T05: Math Structural Chunker & Pack', () => {
    let mathChunker: MathStructuralChunker;
    let mathPack: MathPack;

    beforeEach(() => {
      mathChunker = new MathStructuralChunker();
      mathPack = new MathPack(mathChunker);
    });

    it('preserves LaTeX display and inline equations without corrupting delimiters (§3201-3203)', () => {
      const text = `
### Definition 2.1: Fourier Transform
The continuous Fourier transform of a function $f(t)$ is defined by:
$$F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i \\omega t} dt$$
where $i = \\sqrt{-1}$.
`;

      const equations = mathChunker.extractLatexEquations(text);
      expect(equations).toContain('$f(t)$');
      expect(equations).toContain('$$F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i \\omega t} dt$$');
      expect(equations).toContain('$i = \\sqrt{-1}$');
    });

    it('bonds theorem statement with proof to prevent arbitrary token boundary splitting (§3208-3215)', () => {
      const docMarkdown = `
### Theorem 4.2: Infinitude of Primes
There are infinitely many prime numbers.

Proof:
Assume for contradiction that there are only finitely many primes $p_1, p_2, \\dots, p_n$.
Consider the integer $N = p_1 p_2 \\dots p_n + 1$.
Then $N$ is either prime or divisible by a prime not in the set, a contradiction. Q.E.D.
`;

      const chunks = mathChunker.chunkMathDocument({
        docId: 'doc-primes',
        title: 'Number Theory Primer',
        bodyMarkdownOrLatex: docMarkdown,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].chunkType).toBe('theorem');
      expect(chunks[0].statement).toContain('There are infinitely many prime numbers.');
      expect(chunks[0].proofOrDerivation).toBeDefined();
      expect(chunks[0].proofOrDerivation).toContain('Assume for contradiction');
      expect(chunks[0].proofOrDerivation).toContain('Q.E.D.');
    });

    it('supports definition and theorem retrieval in MathPack', () => {
      mathPack.indexDocument({
        docId: 'doc-calculus',
        title: 'Calculus Fundamental Theorems',
        bodyMarkdownOrLatex: `
### Definition 1.1: Limit
Let $f(x)$ be defined on an open interval containing $c$. We say $\\lim_{x \\to c} f(x) = L$ if...

### Theorem 1.2: Fundamental Theorem of Calculus
If $f$ is continuous on $[a, b]$ and $F$ is an antiderivative of $f$, then:
$$\\int_a^b f(x) dx = F(b) - F(a)$$

Proof:
Let $P = \\{x_0, x_1, \\dots, x_n\\}$ be a partition of $[a, b]$...
`,
      });

      const defResults = mathPack.search('definition of limit');
      expect(defResults.length).toBeGreaterThan(0);
      expect(defResults[0].chunkType).toBe('definition');

      const thmResults = mathPack.search('Fundamental Theorem Calculus proof');
      expect(thmResults.length).toBeGreaterThan(0);
      expect(thmResults[0].chunkType).toBe('theorem');
      expect(thmResults[0].proofOrDerivation).toBeDefined();
    });
  });

  describe('CRK-P20-T06 & Phase 20 Exit Gate Certification (§3232-3238)', () => {
    it('certifies all Phase 20 exit criteria', () => {
      const researchPack = new ResearchPack();
      const mathPack = new MathPack();

      // 1. Research and math are separate packs
      expect(researchPack.packId).toBe('research');
      expect(mathPack.packId).toBe('math');
      expect(researchPack.packId).not.toEqual(mathPack.packId);

      // 2. Licenses are recorded and validated
      const paperResult = researchPack.indexPaper({
        paperId: 'arxiv-2403-999',
        title: 'Modern Quantum Algorithms',
        authors: ['Alice Smith'],
        year: 2024,
        abstract: 'A survey of hybrid variational quantum algorithms.',
        bodyMarkdown: '# Intro\nOverview of VQE and QAOA.',
        sourceUrl: 'https://arxiv.org/abs/2403.999',
        license: 'arXiv-non-exclusive',
      });
      expect(paperResult.success).toBe(true);
      expect(paperResult.paper?.license).toBe('arXiv-non-exclusive');

      // 3. Equations/sections retain structure
      const mathDoc = mathPack.indexDocument({
        docId: 'doc-euler',
        title: 'Euler Formula',
        bodyMarkdownOrLatex: `
### Formula: Euler Identity
The famous formula relates five fundamental constants:
$$e^{i \\pi} + 1 = 0$$
`,
      });
      expect(mathDoc.chunks[0].latexEquations).toContain('$$e^{i \\pi} + 1 = 0$$');

      // 4. Domain-specific routing directs math and research accurately
      const router = new KnowledgeRouter();
      const mathRoute = router.route('math');
      expect(mathRoute.selectedPacks).toContain('math');

      const researchRoute = router.route('research');
      expect(researchRoute.selectedPacks).toContain('research');
    });
  });
});
