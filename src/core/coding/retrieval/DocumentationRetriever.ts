import { ContextEvidence } from '../types';

export interface DocumentationRequest { query: string; language?: string; version?: string; entries: Array<{ title: string; content: string; source: string; authority: 'official' | 'curated' | 'learned'; language?: string; version?: string; }>; maxItems?: number; }

export class DocumentationRetriever {
  retrieve(request: DocumentationRequest): ContextEvidence[] {
    const terms = request.query.toLowerCase().split(/\W+/).filter(Boolean);
    return request.entries
      .filter(entry => !request.language || !entry.language || entry.language === request.language)
      .map(entry => {
        const text = `${entry.title} ${entry.content}`.toLowerCase();
        const termScore = terms.filter(term => text.includes(term)).length;
        const versionScore = request.version && entry.version === request.version ? 2 : 0;
        return { entry, score: termScore + versionScore };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || this.rank(b.entry.authority) - this.rank(a.entry.authority))
      .slice(0, request.maxItems || 8)
      .map(item => ({ kind: 'documentation' as const, label: item.entry.title, content: item.entry.content, authority: item.entry.authority, reason: `matched repository task terms${request.version ? ' and version' : ''}`, confidence: Math.min(1, item.score / Math.max(1, terms.length + 2)) }));
  }

  private rank(authority: DocumentationRequest['entries'][number]['authority']): number { return { official: 3, curated: 2, learned: 1 }[authority]; }
}
