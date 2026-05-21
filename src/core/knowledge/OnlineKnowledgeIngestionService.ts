import crypto from 'crypto';
import { randomUUID } from 'crypto';

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
  reviewToken: string;
  requiresApproval: true;
  sourcePolicy: {
    accepted: number;
    rejected: Array<{ url: string; reason: string }>;
  };
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
    private readonly searcher: { search?: (query: string, options?: any) => Promise<any>; searchWeb?: (query: string, limit?: number) => Promise<any> }
  ) {}

  async searchAndSummarize(query: string, domain = 'ask'): Promise<OnlineKnowledgePreview> {
    const { accepted, rejected } = await this.search(query);
    const sources = accepted;
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
      sourcePolicy: {
        accepted: sources.length,
        rejected
      }
    };
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

    for (const source of preview.sources) {
      const text = [
        `Query: ${preview.query}`,
        `Title: ${source.title}`,
        `URL: ${source.url}`,
        `Retrieved: ${preview.retrievedAt}`,
        '',
        source.snippet
      ].join('\n');
      const contentHash = crypto.createHash('sha256').update(text).digest('hex');

      if (OnlineKnowledgeIngestionService.ingestedHashes.has(contentHash)) {
        skippedDuplicates += 1;
        continue;
      }

      const chunks = await this.documentManager.addText(text, {
        source: source.url,
        sourceUrl: source.url,
        title: source.title,
        retrievedAt: preview.retrievedAt,
        domain: preview.domain,
        originalQuery: preview.query,
        ingestionMethod: 'online-approved-summary',
        confidence: this.sourceConfidence(source),
        approvedBy: normalizedApproval.approvedBy,
        approvalStatus: 'approved',
        reviewedAt: normalizedApproval.reviewedAt || new Date().toISOString(),
        reviewNotes: normalizedApproval.notes || '',
        contentHash,
        onlineIngestionId: ingestionId,
        provenance: {
          sourceUrl: source.url,
          retrievedAt: preview.retrievedAt,
          query: preview.query,
          reviewToken: preview.reviewToken
        }
      });

      OnlineKnowledgeIngestionService.ingestedHashes.add(contentHash);
      contentHashes.push(contentHash);
      if (Array.isArray(chunks)) {
        chunkIds.push(...chunks.map((chunk: any) => chunk.id).filter(Boolean));
      }
      ingested += 1;
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

  private async search(query: string): Promise<{ accepted: OnlineSearchResult[]; rejected: Array<{ url: string; reason: string }> }> {
    if (this.searcher.search) {
      const result = await this.searcher.search(query, 5);
      return this.applySourcePolicy(Array.isArray(result) ? result : result?.data?.results || []);
    }
    if (this.searcher.searchWeb) {
      const result = await this.searcher.searchWeb(query, 5);
      return this.applySourcePolicy(Array.isArray(result) ? result : result?.data?.results || []);
    }
    return { accepted: [], rejected: [] };
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
    const expectedToken = this.createReviewToken(preview.query, preview.domain, preview.retrievedAt, preview.sources);
    if (preview.reviewToken !== expectedToken) throw new Error('Online knowledge preview failed review-token validation');
  }

  private createReviewToken(query: string, domain: string, retrievedAt: string, sources: OnlineSearchResult[]): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({
        query,
        domain,
        retrievedAt,
        sources: sources.map(source => ({ title: source.title, url: source.url, snippet: source.snippet }))
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
