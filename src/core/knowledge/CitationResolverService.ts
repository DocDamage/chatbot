/**
 * Citation Resolver Service (CRK-P15-T05)
 *
 * Verifies citation targets against registered knowledge indexes and files.
 * If citations cannot be resolved, suppresses broken links, logs unresolved IDs,
 * surfaces diagnostic warnings, and verifies grounding sufficiency.
 */

import { CitationRef } from '../../types/citation';
import { logger } from '../observability/logger';

export interface CitationResolutionResult {
  validCitations: CitationRef[];
  unresolvedCitationIds: string[];
  warnings: string[];
  groundingMaintained: boolean;
}

export interface CitationTargetVerifier {
  verify(citation: CitationRef): Promise<boolean> | boolean;
}

export class CitationResolverService {
  constructor(private readonly verifier?: CitationTargetVerifier) {}

  /**
   * Resolves and validates an array of citations, separating valid citations
   * from unresolved references and generating necessary diagnostic warnings.
   */
  public async resolveCitations(
    citations: CitationRef[],
    minimumRequiredAuthority: number = 0.5
  ): Promise<CitationResolutionResult> {
    const validCitations: CitationRef[] = [];
    const unresolvedCitationIds: string[] = [];
    const warnings: string[] = [];

    for (const cit of citations) {
      const isValid = await this.verifyCitationTarget(cit);
      if (isValid) {
        validCitations.push(cit);
      } else {
        unresolvedCitationIds.push(cit.id);
        warnings.push(`Unresolved citation target for [${cit.id}]: "${cit.title}"`);
        logger.warn('Unresolved citation detected during resolution', {
          citationId: cit.id,
          sourceId: cit.sourceId,
          sourceUrl: cit.sourceUrl,
          path: cit.path,
        });
      }
    }

    // Check if grounding is maintained after dropping unresolved citations
    const remainingAuthority = validCitations.length > 0
      ? validCitations.reduce((acc, c) => acc + (c.authority ?? 0.7), 0) / validCitations.length
      : 0;

    const groundingMaintained = validCitations.length > 0 && remainingAuthority >= minimumRequiredAuthority;

    return {
      validCitations,
      unresolvedCitationIds,
      warnings,
      groundingMaintained,
    };
  }

  private async verifyCitationTarget(cit: CitationRef): Promise<boolean> {
    if (this.verifier) {
      try {
        return await this.verifier.verify(cit);
      } catch (e) {
        return false;
      }
    }

    // Default syntax/presence verification
    if (cit.sourceUrl) {
      try {
        const parsed = new URL(cit.sourceUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }

    if (cit.path) {
      return cit.path.trim().length > 0 && !cit.path.includes('\0');
    }

    // If neither URL nor path, check for valid non-empty chunkId and sourceId
    return Boolean(cit.sourceId && cit.chunkId);
  }
}
