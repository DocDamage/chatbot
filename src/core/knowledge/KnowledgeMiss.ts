export interface KnowledgeMiss {
  knowledgeMiss: true;
  message: string;
  domain: string;
  proposedWebQuery: string;
  recommendedSources: string[];
  canSearchOnline: true;
  suggestedNextAction: 'search_online';
}
