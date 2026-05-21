import { KnowledgeMiss } from './KnowledgeMiss';

export class KnowledgeMissHandler {
  createMiss(message: string, domain = 'ask'): KnowledgeMiss {
    return {
      knowledgeMiss: true,
      type: 'knowledge_miss',
      message,
      domain,
      proposedWebQuery: message.trim(),
      recommendedSources: this.sourcesFor(domain),
      canSearchOnline: true,
      suggestedNextAction: 'search_online'
    };
  }

  private sourcesFor(domain: string): string[] {
    if (domain === 'gaming') return ['official game or engine documentation', 'publisher/developer sources', 'reputable community wikis'];
    if (domain === 'science') return ['papers', 'patent databases', 'institutional sources'];
    if (domain === 'history') return ['primary sources', 'museums/archives', 'scholarly references'];
    return ['authoritative web sources', 'official documentation', 'reputable reference sources'];
  }
}
