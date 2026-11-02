/**
 * Grounded Response Validator (CRK-P17-T03)
 *
 * Enforces evidence grounding rules for evidence-required tasks (§2941-2949):
 * - Response has sufficient evidence (§2945)
 * - Cited sources were present in selected context (§2946)
 * - Version claims align with source metadata (§2947)
 * - High-impact contradictions trigger warning or abstention (§2948)
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import { ResponseValidationContext, ValidationIssue } from '../../types/response-quality';
import { GroundingEvaluator } from '../evals/GroundingEvaluator';

export class GroundedResponseValidator {
  /**
   * Validates response grounding when requiresGrounding is enabled.
   */
  public static validate(context: ResponseValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Only enforce grounded validation if task explicitly requires grounding
    if (!context.requiresGrounding) {
      return issues;
    }

    const chunks = context.retrievedChunks || [];
    const responseText = context.response || '';

    // 1. Evidence sufficiency check (§2945)
    if (chunks.length === 0) {
      issues.push({
        code: 'INSUFFICIENT_EVIDENCE',
        message: 'Query requires grounding, but no evidence chunks were retrieved.',
        severity: 'error',
        field: 'retrievedChunks',
        suggestedFix: 'Broaden retrieval or state that local documentation is missing.',
      });
      return issues;
    }

    const groundingDecision = GroundingEvaluator.evaluate({
      query: context.userMessage,
      chunks: chunks.map((c) => ({
        id: c.chunkId,
        content: c.content,
        sourceUri: c.sourceUrl || `doc://${c.sourceId}`,
        authority: c.authority ?? 0.8,
        compositeScore: c.authority ?? 0.8,
        version: c.version,
      })),
    });

    if (!groundingDecision.sufficient) {
      issues.push({
        code: 'LOW_GROUNDING_CONFIDENCE',
        message: `Grounding confidence (${(groundingDecision.confidence * 100).toFixed(0)}%) is below sufficiency threshold.`,
        severity: 'warning',
        field: 'grounding',
        suggestedFix: 'Clarify uncertainty or abstain from unverified factual assertions.',
      });
    }

    // 2. High-impact contradiction detection (§2948)
    if (groundingDecision.features?.conflictingEvidence) {
      issues.push({
        code: 'CONTRADICTORY_EVIDENCE',
        message: 'Retrieved sources contain conflicting information on this topic.',
        severity: 'warning',
        field: 'retrievedChunks',
        suggestedFix: 'Explicitly explain the discrepancy or version differences to the user.',
      });
    }

    // 3. Cited sources were in selected context (§2946)
    const contextSourceIds = new Set(chunks.map((c) => c.sourceId));
    const contextChunkIds = new Set(chunks.map((c) => c.chunkId));

    if (context.citations && context.citations.length > 0) {
      for (const cit of context.citations) {
        if (!contextChunkIds.has(cit.chunkId) && !contextSourceIds.has(cit.sourceId)) {
          issues.push({
            code: 'UNSELECTED_CONTEXT_CITATION',
            message: `Cited source "${cit.title || cit.sourceId}" was not among selected context chunks.`,
            severity: 'error',
            field: 'citations',
            suggestedFix: 'Only generate citations matching retrieved chunks in context.',
          });
        }
      }
    }

    // 4. Version claims align with source metadata (§2947)
    const versionRegex = /\b(?:v|version)\s*(\d+(?:\.\d+)*)\b/gi;
    const claimedVersions: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = versionRegex.exec(responseText)) !== null) {
      claimedVersions.push(match[1]);
    }

    if (claimedVersions.length > 0) {
      const knownVersions = new Set<string>();
      for (const chunk of chunks) {
        if (chunk.version) {
          knownVersions.add(chunk.version);
        }
        // Also extract versions mentioned in chunk content
        let chunkMatch: RegExpExecArray | null;
        const chunkRegex = /\b(?:v|version)\s*(\d+(?:\.\d+)*)\b/gi;
        while ((chunkMatch = chunkRegex.exec(chunk.content)) !== null) {
          knownVersions.add(chunkMatch[1]);
        }
      }

      if (knownVersions.size > 0) {
        for (const v of claimedVersions) {
          // If a major version is claimed that has zero presence in known versions
          const major = v.split('.')[0];
          const hasMajorMatch = Array.from(knownVersions).some((kv) => kv.startsWith(major));
          if (!hasMajorMatch) {
            issues.push({
              code: 'VERSION_MISMATCH_CLAIM',
              message: `Response claims version "${v}", which does not match retrieved source versions (${Array.from(knownVersions).join(', ')}).`,
              severity: 'warning',
              field: 'response',
              suggestedFix: `Align version statements with source evidence (${Array.from(knownVersions).join(', ')}).`,
            });
            break;
          }
        }
      }
    }

    return issues;
  }
}
