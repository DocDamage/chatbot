import crypto from 'crypto';

export interface OnlineSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface OnlineKnowledgePreview {
  query: string;
  domain: string;
  retrievedAt: string;
  answerPreview: string;
  sources: OnlineSearchResult[];
}

export class OnlineKnowledgeIngestionService {
  constructor(
    private readonly documentManager: { addText: (text: string, metadata: Record<string, any>) => Promise<any> },
    private readonly searcher: { search?: (query: string, options?: any) => Promise<OnlineSearchResult[]>; searchWeb?: (query: string, limit?: number) => Promise<OnlineSearchResult[]> }
  ) {}

  async searchAndSummarize(query: string, domain = 'ask'): Promise<OnlineKnowledgePreview> {
    const sources = await this.search(query);
    const answerPreview = sources.length > 0
      ? sources.map(source => `${source.title}: ${source.snippet}`).join('\n')
      : `No online results were returned for "${query}".`;
    return {
      query,
      domain,
      retrievedAt: new Date().toISOString(),
      answerPreview,
      sources
    };
  }

  async ingestApproved(preview: OnlineKnowledgePreview, approvedBy: string) {
    let ingested = 0;
    for (const source of preview.sources) {
      const text = [
        `Query: ${preview.query}`,
        `Title: ${source.title}`,
        `URL: ${source.url}`,
        `Retrieved: ${preview.retrievedAt}`,
        '',
        source.snippet
      ].join('\n');
      await this.documentManager.addText(text, {
        source: source.url,
        sourceUrl: source.url,
        title: source.title,
        retrievedAt: preview.retrievedAt,
        domain: preview.domain,
        originalQuery: preview.query,
        ingestionMethod: 'online-approved-summary',
        confidence: 0.65,
        approvedBy,
        contentHash: crypto.createHash('sha1').update(text).digest('hex')
      });
      ingested += 1;
    }
    return { ingested };
  }

  private async search(query: string): Promise<OnlineSearchResult[]> {
    if (this.searcher.search) return this.searcher.search(query, { limit: 5 });
    if (this.searcher.searchWeb) return this.searcher.searchWeb(query, 5);
    return [];
  }
}
