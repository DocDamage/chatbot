/**
 * Prompt Truncation Service
 * CRK Phase 11: Deterministic Truncation (CRK-P11-T05)
 */

import { PromptSection } from '../../types/prompt-assembler';
import { ContextBudgetService } from './ContextBudgetService';

export interface TruncationResult {
  retainedSections: PromptSection[];
  droppedSectionIds: string[];
  truncatedSectionIds: string[];
  totalTokensUsed: number;
}

export class PromptTruncationService {
  /**
   * Deterministically prunes sections according to §2231-2246:
   * Higher priority number indicates lower retention priority (pruned first).
   * 7: lower-value memories (pruned first)
   * 6: older/lower-priority conversation
   * 5: lower-ranked evidence
   * 4: workflow state
   * 3: explicit attachments
   * 2: user request (never dropped)
   * 1: system policy (never dropped)
   */
  public static truncateToBudget(
    sections: PromptSection[],
    availableTokens: number
  ): TruncationResult {
    const droppedSectionIds: string[] = [];
    const truncatedSectionIds: string[] = [];

    // Calculate current total
    let currentTotal = sections.reduce((sum, s) => sum + s.tokenEstimate, 0);
    if (currentTotal <= availableTokens) {
      return {
        retainedSections: sections.map((s) => ({ ...s, truncationStatus: 'full' })),
        droppedSectionIds,
        truncatedSectionIds,
        totalTokensUsed: currentTotal,
      };
    }

    // Sort descending by priority number (highest number = least important = prune first)
    const sortedCandidates = [...sections].sort((a, b) => b.priority - a.priority);
    const retainedMap = new Map<string, PromptSection>();
    for (const s of sections) {
      retainedMap.set(s.id, { ...s });
    }

    for (const candidate of sortedCandidates) {
      if (currentTotal <= availableTokens) break;

      // Priority 1 and 2 are never completely dropped
      if (candidate.priority <= 2) {
        // Attempt character truncation if necessary, but keep core content
        const excess = currentTotal - availableTokens;
        if (candidate.tokenEstimate > excess + 20) {
          const targetTokens = candidate.tokenEstimate - excess;
          const targetChars = targetTokens * 4;
          const original = candidate.content;
          const truncatedContent = original.slice(0, targetChars) + '... [truncated]';
          const newTokens = ContextBudgetService.estimateTokens(truncatedContent);

          currentTotal -= candidate.tokenEstimate - newTokens;
          retainedMap.set(candidate.id, {
            ...candidate,
            content: truncatedContent,
            tokenEstimate: newTokens,
            truncationStatus: 'truncated',
          });
          truncatedSectionIds.push(candidate.id);
        }
        continue;
      }

      // Drop candidate
      currentTotal -= candidate.tokenEstimate;
      retainedMap.set(candidate.id, {
        ...candidate,
        content: '',
        tokenEstimate: 0,
        truncationStatus: 'omitted',
      });
      droppedSectionIds.push(candidate.id);
    }

    const retainedSections = sections
      .map((s) => retainedMap.get(s.id)!)
      .filter((s) => s.truncationStatus !== 'omitted');

    return {
      retainedSections,
      droppedSectionIds,
      truncatedSectionIds,
      totalTokensUsed: currentTotal,
    };
  }
}
