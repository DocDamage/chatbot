/**
 * Intent Routing - Classify user requests
 */

export enum IntentType {
  LORE_QUERY = 'LORE_QUERY',
  NARRATIVE_DIALOGUE = 'NARRATIVE_DIALOGUE',
  QUEST_SUGGESTION = 'QUEST_SUGGESTION',
  QUEST_VALIDATION = 'QUEST_VALIDATION',
  COMBAT_EXPLANATION = 'COMBAT_EXPLANATION',
  BUILD_OPTIMIZATION = 'BUILD_OPTIMIZATION',
  SYSTEMS_DESIGN = 'SYSTEMS_DESIGN',
  MOD_VALIDATION = 'MOD_VALIDATION',
  PLAYER_SUPPORT = 'PLAYER_SUPPORT',
  GENERAL_QUERY = 'GENERAL_QUERY'
}

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  entities?: string[];
  suggested_contract?: string;
}

