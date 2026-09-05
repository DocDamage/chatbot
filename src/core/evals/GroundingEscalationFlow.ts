/**
 * Grounding Escalation Flow
 * CRK Phase 12: Escalation Flow (CRK-P12-T03)
 */

import {
  EvidenceChunk,
  GroundingDecision,
  GroundingEvaluationInput,
} from '../../types/grounding-eval';
import { GroundingEvaluator } from './GroundingEvaluator';

export interface EscalationProviders {
  broadenLocalRetrieval?: (query: string) => Promise<EvidenceChunk[]>;
  onlineSearchRetrieval?: (query: string) => Promise<EvidenceChunk[]>;
}

export interface EscalationResult {
  finalDecision: GroundingDecision;
  finalChunks: EvidenceChunk[];
  escalationStage: 'initial' | 'broaden-local' | 'search-online' | 'terminal';
}

export class GroundingEscalationFlow {
  public static async execute(
    input: GroundingEvaluationInput,
    providers?: EscalationProviders
  ): Promise<EscalationResult> {
    // 1. Initial retrieval evaluation
    let currentChunks = [...input.chunks];
    let decision = GroundingEvaluator.evaluate({
      ...input,
      chunks: currentChunks,
      localScopeBroadened: false,
    });

    if (decision.sufficient || decision.recommendedAction === 'answer') {
      return {
        finalDecision: decision,
        finalChunks: currentChunks,
        escalationStage: 'initial',
      };
    }

    // 2. Stage 2: Broaden installed/local sources (§2324)
    if (decision.recommendedAction === 'broaden-local' && providers?.broadenLocalRetrieval) {
      const broadened = await providers.broadenLocalRetrieval(input.query);
      currentChunks = this.mergeChunks(currentChunks, broadened);

      decision = GroundingEvaluator.evaluate({
        ...input,
        chunks: currentChunks,
        localScopeBroadened: true,
      });

      if (decision.sufficient || decision.recommendedAction === 'answer') {
        return {
          finalDecision: decision,
          finalChunks: currentChunks,
          escalationStage: 'broaden-local',
        };
      }
    }

    // 3. Stage 3: Online retrieval if allowed/available (§2327)
    if (
      (decision.recommendedAction === 'search-online' || input.onlineSearchAllowed) &&
      providers?.onlineSearchRetrieval
    ) {
      const onlineChunks = await providers.onlineSearchRetrieval(input.query);
      currentChunks = this.mergeChunks(currentChunks, onlineChunks);

      decision = GroundingEvaluator.evaluate({
        ...input,
        chunks: currentChunks,
        localScopeBroadened: true,
        onlineSearchAllowed: false, // already attempted
      });

      if (decision.sufficient || decision.recommendedAction === 'answer') {
        return {
          finalDecision: decision,
          finalChunks: currentChunks,
          escalationStage: 'search-online',
        };
      }
    }

    // 4. Terminal outcome: clarify or abstain (§2330)
    return {
      finalDecision: decision,
      finalChunks: currentChunks,
      escalationStage: 'terminal',
    };
  }

  private static mergeChunks(
    existing: EvidenceChunk[],
    incoming: EvidenceChunk[]
  ): EvidenceChunk[] {
    const seen = new Set(existing.map((c) => c.id || c.content));
    const merged = [...existing];
    for (const chunk of incoming) {
      const key = chunk.id || chunk.content;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(chunk);
      }
    }
    return merged;
  }
}
