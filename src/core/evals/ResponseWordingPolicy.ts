/**
 * Response Wording Policy
 * CRK Phase 12: Response Wording Policy (CRK-P12-T05)
 */

import {
  AbstentionDistinction,
  AbstentionResponse,
  GroundingDecision,
} from '../../types/grounding-eval';

export class ResponseWordingPolicy {
  /**
   * Generates a truthful, non-hallucinatory abstention response
   * adhering strictly to §2345-2353 and §2303 (no leaked internal chain of thought).
   */
  public static formatAbstention(
    topic: string,
    decision: GroundingDecision,
    missingDetails?: string
  ): AbstentionResponse {
    let distinction: AbstentionDistinction = 'insufficient-local-knowledge';
    let userMessage = '';
    let suggestedAction: string | undefined;

    const missingInfo =
      missingDetails ||
      `verified documentation or source records regarding "${topic}" in installed datasets.`;

    if (decision.recommendedAction === 'ask-clarification') {
      distinction = 'conflict';
      userMessage =
        `I found conflicting information in the available knowledge regarding "${topic}". ` +
        `Could you clarify which specific version or context you are targeting?`;
      suggestedAction = 'Specify target version or context.';
    } else if (decision.features?.topScore === 0 && !decision.features.conflictingEvidence) {
      distinction = 'insufficient-local-knowledge';
      userMessage =
        `I do not have sufficient evidence in my installed knowledge datasets to answer your question regarding "${topic}". ` +
        `Specifically, missing: ${missingInfo} ` +
        `This does not mean the fact does not exist, only that it is not verified in my current local knowledge.`;

      suggestedAction =
        decision.recommendedAction === 'search-online'
          ? 'Enable online documentation search or ingest relevant documentation packs.'
          : 'Install or enable the relevant knowledge dataset or documentation pack.';
    } else {
      distinction = 'insufficient-local-knowledge';
      userMessage =
        `The available local evidence does not provide enough verified detail to reliably answer your question about "${topic}". ` +
        `Missing details: ${missingInfo}`;
      suggestedAction = 'Broaden search criteria or consult official vendor documentation.';
    }

    return {
      userMessage,
      missingInfoDescription: missingInfo,
      suggestedAction,
      distinction,
      decision,
    };
  }
}
