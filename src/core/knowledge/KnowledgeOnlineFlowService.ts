import { KnowledgeMissHandler } from './KnowledgeMissHandler';
import { OnlineKnowledgeApproval, OnlineKnowledgeIngestionService, OnlineKnowledgePreview } from './OnlineKnowledgeIngestionService';

export interface LocalKnowledgeAnswer {
  answer?: string;
  confidence?: number;
  sources?: any[];
  citations?: any[];
  retrievedChunks?: any[];
}

export interface KnowledgeOnlineFlowResult {
  answer: string;
  confidence: number;
  needsOnlineResearch: boolean;
  suggestedQuery: string;
  localAnswer?: LocalKnowledgeAnswer;
  miss?: ReturnType<KnowledgeMissHandler['createMiss']>;
}

export interface SearchAndIngestResult {
  preview: OnlineKnowledgePreview;
  ingestion?: any;
  ingested: boolean;
}

export class KnowledgeOnlineFlowService {
  constructor(
    private readonly dependencies: {
      ragService?: { processQuery: (query: string, generateResponse?: boolean) => Promise<any> };
      onlineKnowledgeService?: OnlineKnowledgeIngestionService;
      missHandler?: KnowledgeMissHandler;
    },
    private readonly confidenceThreshold = 0.55
  ) {}

  async answerOrRequestResearch(input: {
    question: string;
    domain?: string;
    confidenceThreshold?: number;
  }): Promise<KnowledgeOnlineFlowResult> {
    const question = String(input.question || '').trim();
    if (!question) throw new Error('question is required');

    const localAnswer = await this.localAnswer(question);
    const confidence = this.estimateConfidence(localAnswer);
    const threshold = input.confidenceThreshold ?? this.confidenceThreshold;

    if (confidence >= threshold) {
      return {
        answer: String(localAnswer?.answer || ''),
        confidence,
        needsOnlineResearch: false,
        suggestedQuery: question,
        localAnswer
      };
    }

    const missHandler = this.dependencies.missHandler || new KnowledgeMissHandler();
    return {
      answer: 'I do not have enough local knowledge to answer this reliably.',
      confidence,
      needsOnlineResearch: true,
      suggestedQuery: question,
      localAnswer,
      miss: missHandler.createMiss(question, input.domain || 'ask')
    };
  }

  async searchAndMaybeIngest(input: {
    query: string;
    domain?: string;
    approved?: boolean;
    approvedBy?: string;
    notes?: string;
  }): Promise<SearchAndIngestResult> {
    if (!this.dependencies.onlineKnowledgeService) {
      throw new Error('Online knowledge service is required');
    }

    const query = String(input.query || '').trim();
    if (!query) throw new Error('query is required');

    const preview = await this.dependencies.onlineKnowledgeService.searchAndSummarize(query, input.domain || 'ask');
    if (!input.approved) {
      return { preview, ingested: false };
    }

    const approval: OnlineKnowledgeApproval = {
      approved: true,
      approvedBy: input.approvedBy || 'system',
      notes: input.notes || ''
    };
    const ingestion = await this.dependencies.onlineKnowledgeService.ingestApproved(preview, approval);
    return { preview, ingestion, ingested: true };
  }

  private async localAnswer(question: string): Promise<LocalKnowledgeAnswer | undefined> {
    if (!this.dependencies.ragService) return undefined;
    const result = await this.dependencies.ragService.processQuery(question, true);
    return result as LocalKnowledgeAnswer;
  }

  private estimateConfidence(answer?: LocalKnowledgeAnswer): number {
    if (!answer) return 0;
    if (typeof answer.confidence === 'number' && Number.isFinite(answer.confidence)) {
      return Math.max(0, Math.min(1, answer.confidence));
    }

    const chunks = Array.isArray(answer.retrievedChunks) ? answer.retrievedChunks.length : 0;
    const sources = Array.isArray(answer.sources) ? answer.sources.length : Array.isArray(answer.citations) ? answer.citations.length : 0;
    const hasAnswer = Boolean(String(answer.answer || '').trim());

    if (!hasAnswer && chunks === 0 && sources === 0) return 0;
    if (chunks >= 3 || sources >= 2) return 0.7;
    if (chunks > 0 || sources > 0) return 0.5;
    return hasAnswer ? 0.35 : 0;
  }
}
