export interface KnowledgeMiss {
  knowledgeMiss: true;
  type: 'knowledge_miss';
  message: string;
  domain: string;
  proposedWebQuery: string;
  recommendedSources: string[];
  canSearchOnline: true;
  suggestedNextAction: 'search_online';
}
