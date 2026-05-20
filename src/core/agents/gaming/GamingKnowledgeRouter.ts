export class GamingKnowledgeRouter {
  recommendedSources(intent: string): string[] {
    if (intent === 'lore') return ['official wiki or publisher materials', 'community-maintained wiki with revision history'];
    if (intent === 'speedrunning') return ['speedrun.com rules/resources', 'community route notes', 'video evidence with date'];
    if (intent === 'platform') return ['platform holder documentation', 'developer docs', 'hardware analysis'];
    if (intent === 'modding') return ['official modding docs', 'tool documentation', 'community guides'];
    return ['local gaming knowledge base', 'official documentation', 'reputable community sources'];
  }
}
