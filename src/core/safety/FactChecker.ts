/**
 * Fact Checker - Verify claims against knowledge base
 * Research: MIT Safer Chatbots, Fact-checking systems
 */

import { DocumentChunk } from '../../types/rag';
import { HybridRetriever } from '../rag/HybridRetriever';
import { logger } from '../observability/logger';

export interface FactCheckResult {
  verified: boolean;
  confidence: number;
  claims: Array<{
    claim: string;
    verified: boolean;
    confidence: number;
    sources?: DocumentChunk[];
  }>;
}

export class FactChecker {
  private retriever: HybridRetriever;

  constructor(retriever: HybridRetriever) {
    this.retriever = retriever;
  }

  /**
   * Check facts in content against knowledge base
   */
  async check(content: string): Promise<FactCheckResult> {
    // Extract claims from content (simple: look for factual statements)
    const claims = this.extractClaims(content);

    if (claims.length === 0) {
      return {
        verified: true,
        confidence: 1.0,
        claims: []
      };
    }

    const verifiedClaims = await Promise.all(
      claims.map(async (claim) => {
        // Search knowledge base for this claim
        const results = await this.retriever.retrieve(claim, 3);
        
        // Check if claim is supported
        const supported = results.length > 0 && results[0].score > 0.3;
        const confidence = supported ? results[0].score : 0.2;

        return {
          claim,
          verified: supported,
          confidence,
          sources: supported ? results.slice(0, 2).map(r => r.chunk) : undefined
        };
      })
    );

    const allVerified = verifiedClaims.every(c => c.verified);
    const avgConfidence = verifiedClaims.reduce((sum, c) => sum + c.confidence, 0) / verifiedClaims.length;

    logger.debug('Fact check completed', {
      claimsCount: claims.length,
      verifiedCount: verifiedClaims.filter(c => c.verified).length,
      avgConfidence
    });

    return {
      verified: allVerified,
      confidence: avgConfidence,
      claims: verifiedClaims
    };
  }

  /**
   * Extract factual claims from content
   */
  private extractClaims(content: string): string[] {
    // Simple extraction: look for statements with numbers, dates, or factual language
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const claims: string[] = [];

    for (const sentence of sentences) {
      // Check if sentence contains factual indicators
      const hasNumber = /\d+/.test(sentence);
      const hasDate = /\d{4}|\b(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(sentence);
      const hasFactualLanguage = /\b(is|are|was|were|has|have|contains|includes|consists)/i.test(sentence);

      if ((hasNumber || hasDate || hasFactualLanguage) && sentence.length > 20) {
        claims.push(sentence.trim());
      }
    }

    return claims.slice(0, 5); // Limit to 5 claims
  }
}

