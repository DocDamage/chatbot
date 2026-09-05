/**
 * Curated Source Code Pack Types Test (CRK Phase 14)
 */
import { CodeChunk, WhitelistedLanguage, RepoQualitySignals } from './source-code-pack';

describe('Source Code Pack Types', () => {
  it('should validate CodeChunk structure and whitelisted language', () => {
    const lang: WhitelistedLanguage = 'typescript';
    const chunk: CodeChunk = {
      chunkId: 'code-chunk-1',
      language: lang,
      symbol: {
        name: 'calculateScore',
        type: 'function',
        startLine: 10,
        endLine: 25,
        signature: 'function calculateScore(input: number): number',
      },
      relationships: {
        imports: ['import { MathUtils } from "./math"'],
        exports: ['calculateScore'],
      },
      provenance: {
        repository: 'owner/repo',
        commit: 'abc12345',
        path: 'src/calculator.ts',
        repoLicense: 'MIT',
        datasetLicense: 'Apache-2.0',
        sourceUrl: 'https://github.com/owner/repo/blob/abc12345/src/calculator.ts#L10-L25',
        startLine: 10,
        endLine: 25,
      },
      content: 'export function calculateScore(input: number): number { return input * 2; }',
      exactHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      simHash: '1010101010101010',
      authority: 0.85,
    };

    expect(chunk.chunkId).toBe('code-chunk-1');
    expect(chunk.language).toBe('typescript');
    expect(chunk.provenance.repoLicense).toBe('MIT');
    expect(chunk.symbol?.type).toBe('function');
  });

  it('should validate RepoQualitySignals', () => {
    const signals: RepoQualitySignals = {
      declaredLicense: 'MIT',
      hasReadme: true,
      hasTests: true,
      stars: 120,
      isFork: false,
    };

    expect(signals.declaredLicense).toBe('MIT');
    expect(signals.hasTests).toBe(true);
  });
});
