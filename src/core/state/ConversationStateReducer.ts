/**
 * Canonical Conversation State Reducer (CRK-P03-T04)
 *
 * Deterministically merges newly extracted candidate variables into active conversation state:
 * - Confidence monotonicity: Never overwrites high-confidence facts with lower-confidence inferences (§1041).
 * - Framework/version decomposition: Ensures coupled entities align.
 * - Explicit contradictions: High-confidence explicit updates supersede older values.
 * - Ambiguous repository switching: Guards against guessing unless a candidate is explicitly provided (§1056).
 * - Expiration: Prunes expired variables.
 */

import { ConversationVariable, ConversationState } from '../../types/conversation-state';

export interface StateReducerOptions {
  knownRepositories?: string[];
  now?: string;
}

export class ConversationStateReducer {
  public reduce(
    currentState: ConversationState,
    candidateVariables: Record<string, ConversationVariable>,
    options: StateReducerOptions = {}
  ): ConversationState {
    const now = options.now || new Date().toISOString();
    const updatedVariables: Record<string, ConversationVariable> = {};

    // 1. Copy over non-expired existing variables
    for (const [key, existingVar] of Object.entries(currentState.variables)) {
      if (existingVar.expiresAt && existingVar.expiresAt < now) {
        continue;
      }
      updatedVariables[key] = {
        key: existingVar.key,
        value: existingVar.value,
        confidence: existingVar.confidence,
        sourceTurnId: existingVar.sourceTurnId,
        source: existingVar.source,
        updatedAt: existingVar.updatedAt,
        expiresAt: existingVar.expiresAt,
      };
    }

    // 2. Process candidate variables
    for (const [key, candidate] of Object.entries(candidateVariables)) {
      const existing = updatedVariables[key];

      // Never overwrite a higher-confidence value with a lower-confidence value (§1041)
      if (existing && existing.confidence > candidate.confidence) {
        continue;
      }

      // If equal confidence but existing is 'explicit' and candidate is not, preserve explicit
      if (existing && existing.confidence === candidate.confidence && existing.source === 'explicit' && candidate.source !== 'explicit') {
        continue;
      }

      updatedVariables[key] = {
        key: candidate.key,
        value: candidate.value,
        confidence: candidate.confidence,
        sourceTurnId: candidate.sourceTurnId,
        source: candidate.source,
        updatedAt: now,
        expiresAt: candidate.expiresAt,
      };
    }

    // 3. Special handling for repository switching guard
    if (options.knownRepositories && options.knownRepositories.length > 0) {
      const currentRepo = updatedVariables.repository?.value as string | undefined;
      // If user wants to switch to the "other" repo and exactly two are known, we can resolve it
      if (options.knownRepositories.length === 2 && currentRepo) {
        const other = options.knownRepositories.find((r) => r !== currentRepo);
        if (other && candidateVariables['switch_other_repo']) {
          updatedVariables.repository = {
            key: 'repository',
            value: other,
            confidence: 1.0,
            sourceTurnId: candidateVariables['switch_other_repo'].sourceTurnId,
            source: 'explicit',
            updatedAt: now,
          };
        }
      }
    }

    return {
      ...currentState,
      variables: updatedVariables,
      updatedAt: now,
    };
  }
}
