/**
 * Intent Router - Classifies user requests and routes to appropriate handlers
 */

import { IntentType, IntentClassification } from '../../types/intent';
import { logger } from '../observability/logger';

export class IntentRouter {
  private intentPatterns: Map<IntentType, string[]> = new Map([
    [IntentType.LORE_QUERY, ['what is', 'explain', 'tell me about', 'how does', 'define', 'what are', 'describe']],
    [IntentType.NARRATIVE_DIALOGUE, ['chat', 'talk', 'conversation', 'discuss', 'tell me a story', 'narrative']],
    [IntentType.PLAYER_SUPPORT, ['help', 'support', 'problem', 'issue', 'error', 'bug', 'fix', 'how to']],
    [IntentType.BUILD_OPTIMIZATION, ['build', 'optimize', 'best', 'recommend', 'suggest', 'guide']],
    [IntentType.SYSTEMS_DESIGN, ['design', 'architecture', 'system', 'structure', 'plan']]
  ]);

  /**
   * Classify user intent from message with improved pattern matching
   */
  classifyIntent(message: string): IntentClassification {
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for question patterns
    const questionPattern = /^(what|how|why|when|where|who|which|can|could|should|would|is|are|do|does|did)\s+/i;
    const isQuestion = questionPattern.test(message);

    // Score each intent type
    const scores = new Map<IntentType, number>();

    for (const [intent, patterns] of this.intentPatterns.entries()) {
      let score = 0;
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores.set(intent, score);
      }
    }

    // Boost score for questions (likely lore queries)
    if (isQuestion && scores.has(IntentType.LORE_QUERY)) {
      scores.set(IntentType.LORE_QUERY, (scores.get(IntentType.LORE_QUERY) || 0) + 0.5);
    }

    // Find best match
    let bestIntent = IntentType.GENERAL_QUERY;
    let bestScore = 0;

    for (const [intent, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    // Calculate confidence (normalize to 0-1)
    const confidence = Math.min(0.9, 0.5 + (bestScore * 0.1));

    return {
      intent: bestIntent,
      confidence,
      suggested_contract: this.getContractForIntent(bestIntent)
    };
  }

  private getContractForIntent(intent: IntentType): string {
    const contractMap: Record<IntentType, string> = {
      [IntentType.LORE_QUERY]: 'lore-query-v1',
      [IntentType.NARRATIVE_DIALOGUE]: 'dialogue-v1',
      [IntentType.QUEST_SUGGESTION]: 'quest-v1',
      [IntentType.QUEST_VALIDATION]: 'quest-v1',
      [IntentType.COMBAT_EXPLANATION]: 'combat-v1',
      [IntentType.BUILD_OPTIMIZATION]: 'build-v1',
      [IntentType.SYSTEMS_DESIGN]: 'design-v1',
      [IntentType.MOD_VALIDATION]: 'mod-v1',
      [IntentType.PLAYER_SUPPORT]: 'support-v1',
      [IntentType.GENERAL_QUERY]: 'default-general-chat'
    };
    return contractMap[intent] || 'default-general-chat';
  }

  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }
}

