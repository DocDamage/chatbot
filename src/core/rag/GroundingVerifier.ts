import { DocumentChunk } from '../../types/rag';

export interface GroundingVerificationInput {
  answer: string;
  retrievedChunks: DocumentChunk[];
  requiredCitationCoverage?: number;
}

export interface GroundingVerificationResult {
  grounded: boolean;
  coverage: number;
  supportedClaims: string[];
  unsupportedClaims: string[];
  warnings: string[];
}

export class GroundingVerifier {
  static verify(input: GroundingVerificationInput): GroundingVerificationResult {
    const requiredCoverage = input.requiredCitationCoverage ?? 0.8;
    const claims = this.extractClaims(input.answer);
    const chunkText = input.retrievedChunks.map(chunk => chunk.content).join(' ').toLowerCase();
    const supportedClaims: string[] = [];
    const unsupportedClaims: string[] = [];

    for (const claim of claims) {
      const claimTokens = this.keyTokens(claim);
      if (claimTokens.length === 0) {
        continue;
      }

      const matched = claimTokens.filter(token => chunkText.includes(token)).length;
      const supportRatio = matched / claimTokens.length;

      if (supportRatio >= 0.6) {
        supportedClaims.push(claim);
      } else {
        unsupportedClaims.push(claim);
      }
    }

    const coverage = claims.length === 0 ? 1 : supportedClaims.length / claims.length;
    const warnings = unsupportedClaims.map(claim => `Unsupported claim: ${claim}`);

    return {
      grounded: coverage >= requiredCoverage && unsupportedClaims.length === 0,
      coverage,
      supportedClaims,
      unsupportedClaims,
      warnings
    };
  }

  private static extractClaims(answer: string): string[] {
    return answer
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
  }

  private static keyTokens(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'to', 'for', 'of', 'in', 'on', 'with',
      'is', 'are', 'was', 'were', 'it', 'this', 'that', 'by', 'as', 'from'
    ]);

    return text
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(token => token.length > 2 && !stopWords.has(token));
  }
}
