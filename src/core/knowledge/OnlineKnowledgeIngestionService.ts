import crypto from 'crypto';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { logger } from '../observability/logger';

export interface OnlineSearchResult {
  title: string;
  url: string;
  snippet: string;
  category?: string;
  categories?: string[];
  content?: string;
  fetchStatus?: 'fetched' | 'snippet-only';
  datePublished?: string;
}

export interface OnlineKnowledgePreview {
  query: string;
  domain: string;
  retrievedAt: string;
  answerPreview: string;
  sources: OnlineSearchResult[];
  reviewToken: string;
  requiresApproval: true;
  sourcePolicy: {
    accepted: number;
    rejected: Array<{ url: string; reason: string }>;
  };
  researchType?: 'search-summary' | 'deep-dive';
  primaryCategory?: string;
  relatedCategories?: string[];
  researchQueries?: Array<{ category: string; query: string }>;
  crossReferences?: Array<{ category: string; reason: string; query: string }>;
  synthesis?: string;
  researchDocument?: string;
}

export interface OnlineKnowledgeApproval {
  approved: boolean;
  approvedBy: string;
  reviewedAt?: string;
  notes?: string;
}

interface IngestionRecord {
  ingestionId: string;
  contentHashes: string[];
  chunkIds: string[];
  createdAt: string;
  approvedBy: string;
}

export class OnlineKnowledgeIngestionService {
  private static readonly ingestedHashes = new Set<string>();
  private static readonly ingestionRecords = new Map<string, IngestionRecord>();

  constructor(
    private readonly documentManager: {
      addText: (text: string, metadata: Record<string, any>) => Promise<any>;
      deleteByMetadata?: (metadata: Record<string, any>) => Promise<number>;
      deleteByIds?: (ids: string[]) => Promise<number>;
    },
    private readonly searcher: { search?: (query: string, options?: any) => Promise<any>; searchWeb?: (query: string, limit?: number) => Promise<any> },
    private readonly options: {
      llmAdapter?: { generate: (options: any) => Promise<{ content: string }> };
      fetchPage?: (url: string) => Promise<string>;
    } = {}
  ) {}

  async searchAndSummarize(query: string, domain = 'ask'): Promise<OnlineKnowledgePreview> {
    const { accepted: sources, rejected } = await this.search(query);
    const answerPreview = sources.length > 0
      ? sources.map(source => `${source.title}: ${source.snippet}`).join('\n')
      : `No online results were returned for "${query}".`;
    const retrievedAt = new Date().toISOString();
    return {
      query,
      domain,
      retrievedAt,
      answerPreview,
      sources,
      reviewToken: this.createReviewToken(query, domain, retrievedAt, sources),
      requiresApproval: true,
      researchType: 'search-summary',
      sourcePolicy: { accepted: sources.length, rejected }
    };
  }

  async deepResearch(query: string, domain = 'ask'): Promise<OnlineKnowledgePreview> {
    const primaryCategory = domain || 'ask';
    const relatedCategories = this.relatedCategories(primaryCategory);
    const researchQueries = [primaryCategory, ...relatedCategories].map(category => ({
      category,
      query: category === primaryCategory ? query : `${query} ${category}`
    }));

    const searched = await Promise.all(researchQueries.map(async plan => ({
      ...plan,
      ...(await this.search(plan.query, 5))
    })));

    const uniqueSources = new Map<string, OnlineSearchResult>();
    for (const plan of searched) {
      for (const result of plan.accepted) {
        const normalizedUrl = new URL(result.url).toString();
        const existing = uniqueSources.get(normalizedUrl);
        if (existing) {
          existing.categories = Array.from(new Set([...(existing.categories || []), plan.category]));
          continue;
        }

        uniqueSources.set(normalizedUrl, {
          ...result,
          category: plan.category,
          categories: [plan.category]
        });
      }
    }

    const sources = await Promise.all(Array.from(uniqueSources.values()).slice(0, 12).map(async source => {
      const content = await this.fetchSourceContent(source.url);
      return {
        ...source,
        content: content || undefined,
        fetchStatus: content ? 'fetched' as const : 'snippet-only' as const
      };
    }));

    const retrievedAt = new Date().toISOString();
    const synthesis = await this.synthesizeDeepResearch(query, primaryCategory, relatedCategories, sources);
    const crossReferences = relatedCategories.map(category => ({
      category,
      reason: `Related ${category} context was searched to broaden and verify the ${primaryCategory} answer.`,
      query: `${query} ${category}`
    }));
    const researchDocument = this.buildResearchDocument(
      query,
      primaryCategory,
      relatedCategories,
      synthesis,
      sources,
      retrievedAt
    );

    const preview: OnlineKnowledgePreview = {
      query,
      domain: primaryCategory,
      retrievedAt,
      answerPreview: synthesis,
      sources,
      reviewToken: '',
      requiresApproval: true,
      researchType: 'deep-dive',
      primaryCategory,
      relatedCategories,
      researchQueries,
      crossReferences,
      synthesis,
      researchDocument,
      sourcePolicy: {
        accepted: sources.length,
        rejected: searched.flatMap(plan => plan.rejected)
      }
    };

    preview.reviewToken = this.createReviewToken(query, primaryCategory, retrievedAt, sources, {
      researchType: preview.researchType,
      relatedCategories: preview.relatedCategories,
      researchQueries: preview.researchQueries,
      crossReferences: preview.crossReferences,
      synthesis: preview.synthesis,
      researchDocument: preview.researchDocument
    });
    return preview;
  }

  async ingestApproved(preview: OnlineKnowledgePreview, approval: OnlineKnowledgeApproval | string) {
    const normalizedApproval = typeof approval === 'string'
      ? { approved: true, approvedBy: approval }
      : approval;

    this.validateApproval(preview, normalizedApproval);

    const ingestionId = randomUUID();
    let ingested = 0;
    let skippedDuplicates = 0;
    const contentHashes: string[] = [];
    const chunkIds: string[] = [];

    if (preview.researchDocument) {
      const result = await this.ingestDocument(
        preview.researchDocument,
        {
          source: `online-research:${ingestionId}`,
          title: `Deep research: ${preview.query}`,
          retrievedAt: preview.retrievedAt,
          domain: preview.domain,
          primaryCategory: preview.primaryCategory || preview.domain,
          categories: preview.relatedCategories
            ? [preview.primaryCategory || preview.domain, ...preview.relatedCategories]
            : [preview.domain],
          relatedCategories: preview.relatedCategories || [],
          crossReferences: preview.crossReferences || [],
          originalQuery: preview.query,
          ingestionMethod: 'online-approved-deep-research',
          confidence: 0.75,
          approvedBy: normalizedApproval.approvedBy,
          approvalStatus: 'approved',
          reviewedAt: normalizedApproval.reviewedAt || new Date().toISOString(),
          reviewNotes: normalizedApproval.notes || '',
          onlineIngestionId: ingestionId,
          provenance: {
            retrievedAt: preview.retrievedAt,
            query: preview.query,
            reviewToken: preview.reviewToken,
            researchType: preview.researchType,
            sources: preview.sources.map(source => source.url)
          }
        },
        ingestionId,
        contentHashes,
        chunkIds
      );
      ingested += result.ingested;
      skippedDuplicates += result.skippedDuplicates;
    }

    for (const source of preview.sources) {
      const text = [
        `Query: ${preview.query}`,
        `Category: ${source.category || preview.domain}`,
        `Title: ${source.title}`,
        `URL: ${source.url}`,
        `Retrieved: ${preview.retrievedAt}`,
        '',
        source.content || source.snippet
      ].join('\n');
      const result = await this.ingestDocument(text, {
        source: source.url,
        sourceUrl: source.url,
        title: source.title,
        retrievedAt: preview.retrievedAt,
        domain: preview.domain,
        primaryCategory: preview.primaryCategory || preview.domain,
        category: source.category || preview.domain,
        categories: source.categories || [source.category || preview.domain],
        relatedCategories: preview.relatedCategories || [],
        crossReferences: preview.crossReferences || [],
        originalQuery: preview.query,
        ingestionMethod: preview.researchType === 'deep-dive' ? 'online-approved-deep-research-source' : 'online-approved-summary',
        confidence: this.sourceConfidence(source),
        approvedBy: normalizedApproval.approvedBy,
        approvalStatus: 'approved',
        reviewedAt: normalizedApproval.reviewedAt || new Date().toISOString(),
        reviewNotes: normalizedApproval.notes || '',
        onlineIngestionId: ingestionId,
        provenance: {
          sourceUrl: source.url,
          retrievedAt: preview.retrievedAt,
          query: preview.query,
          reviewToken: preview.reviewToken,
          categories: source.categories || [source.category || preview.domain]
        }
      }, ingestionId, contentHashes, chunkIds);
      ingested += result.ingested;
      skippedDuplicates += result.skippedDuplicates;
    }

    OnlineKnowledgeIngestionService.ingestionRecords.set(ingestionId, {
      ingestionId,
      contentHashes,
      chunkIds,
      createdAt: new Date().toISOString(),
      approvedBy: normalizedApproval.approvedBy
    });

    return {
      ingested,
      skippedDuplicates,
      ingestionId,
      rollbackToken: ingestionId
    };
  }

  async rollbackIngestion(ingestionId: string) {
    const record = OnlineKnowledgeIngestionService.ingestionRecords.get(ingestionId);
    if (!record) {
      return { rolledBack: false, removed: 0, reason: 'Ingestion record not found' };
    }

    let removed = 0;
    if (this.documentManager.deleteByIds && record.chunkIds.length > 0) {
      removed = await this.documentManager.deleteByIds(record.chunkIds);
    } else if (this.documentManager.deleteByMetadata) {
      removed = await this.documentManager.deleteByMetadata({ onlineIngestionId: ingestionId });
    } else {
      return {
        rolledBack: false,
        removed: 0,
        reason: 'Document manager does not support deletion for online ingestions'
      };
    }

    for (const hash of record.contentHashes) {
      OnlineKnowledgeIngestionService.ingestedHashes.delete(hash);
    }
    OnlineKnowledgeIngestionService.ingestionRecords.delete(ingestionId);
    return { rolledBack: true, removed };
  }

  private async search(query: string, limit = 5): Promise<{ accepted: OnlineSearchResult[]; rejected: Array<{ url: string; reason: string }> }> {
    if (this.searcher.search) {
      const result = await this.searcher.search(query, limit);
      return this.applySourcePolicy(Array.isArray(result) ? result : result?.data?.results || []);
    }
    if (this.searcher.searchWeb) {
      const result = await this.searcher.searchWeb(query, limit);
      return this.applySourcePolicy(Array.isArray(result) ? result : result?.data?.results || []);
    }
    return { accepted: [], rejected: [] };
  }

  private async fetchSourceContent(url: string): Promise<string> {
    if (this.options.fetchPage) {
      try {
        return (await this.options.fetchPage(url)).slice(0, 12000);
      } catch {
        return '';
      }
    }

    try {
      const response = await axios.get(url, {
        timeout: 8000,
        responseType: 'text',
        maxContentLength: 1_500_000,
        headers: { 'User-Agent': 'AI-Chatbot-KnowledgeResearch/1.0' }
      });
      return this.extractPageText(String(response.data || '')).slice(0, 12000);
    } catch (error: any) {
      logger.debug('Deep research source fetch skipped', { url, error: error.message });
      return '';
    }
  }

  private extractPageText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async synthesizeDeepResearch(
    query: string,
    primaryCategory: string,
    relatedCategories: string[],
    sources: OnlineSearchResult[]
  ): Promise<string> {
    const context = sources.map((source, index) => [
      `[Source ${index + 1}] ${source.title}`,
      `Category: ${source.category || primaryCategory}`,
      `URL: ${source.url}`,
      source.content || source.snippet
    ].join('\n')).join('\n\n---\n\n');

    if (!this.options.llmAdapter) {
      return [
        `Deep research summary for: ${query}`,
        `Primary category: ${primaryCategory}`,
        `Related categories searched: ${relatedCategories.join(', ') || 'none'}`,
        '',
        ...sources.slice(0, 8).map((source, index) => `${index + 1}. ${source.title}: ${source.snippet}`)
      ].join('\n');
    }

    try {
      const response = await this.options.llmAdapter.generate({
        prompt: `Research question: ${query}\n\nPrimary category: ${primaryCategory}\nRelated categories: ${relatedCategories.join(', ') || 'none'}\n\nEvidence:\n${context.slice(0, 36000)}`,
        systemPrompt: 'You are a careful deep-research synthesizer. Produce a structured, source-grounded answer using only the supplied evidence. Use [Source N] citations, identify agreement and disagreement, distinguish facts from interpretation, include dates and uncertainty where relevant, and end with a short cross-category perspective.',
        maxTokens: 2400,
        temperature: 0.2
      });
      return response.content.trim() || 'No synthesis was generated from the accepted sources.';
    } catch (error: any) {
      logger.warn('Deep research synthesis failed; using evidence summary', { error: error.message });
      return sources.slice(0, 8).map((source, index) => `${index + 1}. ${source.title}: ${source.snippet}`).join('\n');
    }
  }

  private buildResearchDocument(
    query: string,
    primaryCategory: string,
    relatedCategories: string[],
    synthesis: string,
    sources: OnlineSearchResult[],
    retrievedAt: string
  ): string {
    return [
      `Deep research topic: ${query}`,
      `Retrieved: ${retrievedAt}`,
      `Primary category: ${primaryCategory}`,
      `Related categories: ${relatedCategories.join(', ') || 'none'}`,
      '',
      'Synthesis:',
      synthesis,
      '',
      'Evidence sources:',
      ...sources.map((source, index) => `[Source ${index + 1}] ${source.title} (${source.category || primaryCategory})\nURL: ${source.url}\n${source.content || source.snippet}`)
    ].join('\n');
  }

  private relatedCategories(domain: string): string[] {
    const related: Record<string, string[]> = {
      ask: ['history', 'science', 'gaming', 'pop_culture', 'engineering'],
      gaming: ['history', 'science', 'pop_culture', 'business'],
      gamedev: ['gaming', 'engineering', 'business', 'pop_culture'],
      history: ['geography', 'pop_culture', 'science', 'gaming'],
      science: ['engineering', 'history', 'health', 'geography'],
      pop_culture: ['history', 'gaming', 'music', 'story'],
      music: ['pop_culture', 'history', 'business', 'gaming'],
      business: ['market', 'history', 'technology', 'engineering'],
      engineering: ['science', 'gamedev', 'business', 'geography']
    };
    return (related[domain] || ['history', 'science', 'pop_culture', 'engineering']).filter(category => category !== domain).slice(0, 4);
  }

  private async ingestDocument(
    text: string,
    metadata: Record<string, any>,
    ingestionId: string,
    contentHashes: string[],
    chunkIds: string[]
  ): Promise<{ ingested: number; skippedDuplicates: number }> {
    const contentHash = crypto.createHash('sha256').update(text).digest('hex');
    if (OnlineKnowledgeIngestionService.ingestedHashes.has(contentHash)) {
      return { ingested: 0, skippedDuplicates: 1 };
    }

    const chunks = await this.documentManager.addText(text, {
      ...metadata,
      contentHash,
      onlineIngestionId: ingestionId
    });
    OnlineKnowledgeIngestionService.ingestedHashes.add(contentHash);
    contentHashes.push(contentHash);
    if (Array.isArray(chunks)) {
      chunkIds.push(...chunks.map((chunk: any) => chunk.id).filter(Boolean));
    }
    return { ingested: 1, skippedDuplicates: 0 };
  }

  private applySourcePolicy(results: OnlineSearchResult[]): { accepted: OnlineSearchResult[]; rejected: Array<{ url: string; reason: string }> } {
    const accepted: OnlineSearchResult[] = [];
    const rejected: Array<{ url: string; reason: string }> = [];
    const seenUrls = new Set<string>();

    for (const result of results) {
      const policyError = this.sourcePolicyError(result.url);
      if (policyError) {
        rejected.push({ url: result.url, reason: policyError });
        continue;
      }

      const normalizedUrl = new URL(result.url).toString();
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);
      accepted.push({
        title: String(result.title || normalizedUrl),
        url: normalizedUrl,
        snippet: String(result.snippet || '').slice(0, 2000)
      });
    }

    return { accepted, rejected };
  }

  private sourcePolicyError(url: string): string | undefined {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'Invalid URL';
    }

    if (!['https:', 'http:'].includes(parsed.protocol)) return 'Unsupported URL protocol';
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local')) return 'Local sources are not allowed';
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)) return 'Private network sources are not allowed';
    return undefined;
  }

  private validateApproval(preview: OnlineKnowledgePreview, approval: OnlineKnowledgeApproval): void {
    if (!approval.approved) throw new Error('Online knowledge ingestion requires explicit approval');
    if (!approval.approvedBy) throw new Error('Online knowledge approval requires an approver');
    const expectedToken = this.createReviewToken(
      preview.query,
      preview.domain,
      preview.retrievedAt,
      preview.sources,
      preview.researchType === 'deep-dive'
        ? {
            researchType: preview.researchType,
            relatedCategories: preview.relatedCategories,
            researchQueries: preview.researchQueries,
            crossReferences: preview.crossReferences,
            synthesis: preview.synthesis,
            researchDocument: preview.researchDocument
          }
        : undefined
    );
    if (preview.reviewToken !== expectedToken) throw new Error('Online knowledge preview failed review-token validation');
  }

  private createReviewToken(
    query: string,
    domain: string,
    retrievedAt: string,
    sources: OnlineSearchResult[],
    researchData?: Record<string, any>
  ): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({
        query,
        domain,
        retrievedAt,
        sources: sources.map(source => ({
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          category: source.category,
          categories: source.categories,
          content: source.content
        })),
        researchData
      }))
      .digest('hex');
  }

  private sourceConfidence(source: OnlineSearchResult): number {
    const hostname = new URL(source.url).hostname;
    if (hostname.endsWith('.gov') || hostname.endsWith('.edu')) return 0.8;
    if (hostname.includes('docs.') || hostname.includes('developer.')) return 0.72;
    return 0.6;
  }
}
