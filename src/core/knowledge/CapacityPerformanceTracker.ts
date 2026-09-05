export interface ChatLatencyBudgetRecord {
  requestId: string;
  isRetrievalRequested: boolean;
  stageTimingsMs: {
    normalization: number;
    stateLoad: number;
    contextPlanning: number;
    retrieval: number;
    reranking: number;
    modelSelection: number;
    providerGeneration: number;
    validation: number;
    persistence: number;
  };
  totalLatencyMs: number;
  timestamp: string;
}

export interface KnowledgeQueryPerformance {
  queryId: string;
  lexicalLatencyMs: number;
  vectorLatencyMs: number;
  hybridMergeMs: number;
  rerankLatencyMs: number;
  totalRetrievalMs: number;
  selectedChunkCount: number;
  candidateCount: number;
}

export interface DatasetIndexSizeMetrics {
  packId: string;
  rawSourceBytes: number;
  normalizedBytes: number;
  chunkTextBytes: number;
  embeddingBytes: number;
  indexBytes: number;
  metadataBytes: number;
  totalBytes: number;
  updatedAt: string;
}

export interface EmbeddingThroughputMetrics {
  totalChunks: number;
  durationMs: number;
  chunksPerSecond: number;
  failures: number;
  retries: number;
  estimatedCostUsd: number;
}

export class CapacityPerformanceTracker {
  private static instance: CapacityPerformanceTracker | null = null;
  private chatLatencyRecords: ChatLatencyBudgetRecord[] = [];
  private queryPerfRecords: KnowledgeQueryPerformance[] = [];
  private indexSizeMap: Map<string, DatasetIndexSizeMetrics> = new Map();

  public static getInstance(): CapacityPerformanceTracker {
    if (!this.instance) {
      this.instance = new CapacityPerformanceTracker();
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }

  public recordChatLatency(
    requestId: string,
    isRetrievalRequested: boolean,
    timings: ChatLatencyBudgetRecord['stageTimingsMs']
  ): ChatLatencyBudgetRecord {
    const total = Object.values(timings).reduce((acc, v) => acc + v, 0);
    const record: ChatLatencyBudgetRecord = {
      requestId,
      isRetrievalRequested,
      stageTimingsMs: { ...timings },
      totalLatencyMs: total,
      timestamp: new Date().toISOString()
    };
    this.chatLatencyRecords.push(record);
    if (this.chatLatencyRecords.length > 500) {
      this.chatLatencyRecords.shift();
    }
    return record;
  }

  public recordQueryPerformance(perf: KnowledgeQueryPerformance): void {
    this.queryPerfRecords.push(perf);
    if (this.queryPerfRecords.length > 500) {
      this.queryPerfRecords.shift();
    }
  }

  public updateIndexSize(
    packId: string,
    breakdown: Omit<DatasetIndexSizeMetrics, 'packId' | 'totalBytes' | 'updatedAt'>
  ): DatasetIndexSizeMetrics {
    const totalBytes =
      breakdown.rawSourceBytes +
      breakdown.normalizedBytes +
      breakdown.chunkTextBytes +
      breakdown.embeddingBytes +
      breakdown.indexBytes +
      breakdown.metadataBytes;

    const metrics: DatasetIndexSizeMetrics = {
      packId,
      ...breakdown,
      totalBytes,
      updatedAt: new Date().toISOString()
    };
    this.indexSizeMap.set(packId, metrics);
    return metrics;
  }

  public getIndexSizeMetrics(packId: string): DatasetIndexSizeMetrics | undefined {
    return this.indexSizeMap.get(packId);
  }

  public getAllIndexSizes(): DatasetIndexSizeMetrics[] {
    return Array.from(this.indexSizeMap.values());
  }

  public calculateEmbeddingThroughput(
    chunksProcessed: number,
    durationMs: number,
    failures: number = 0,
    retries: number = 0,
    costPerMillionTokensUsd: number = 0.02,
    avgTokensPerChunk: number = 250
  ): EmbeddingThroughputMetrics {
    const seconds = Math.max(durationMs / 1000, 0.001);
    const chunksPerSecond = Math.round((chunksProcessed / seconds) * 100) / 100;
    const estimatedTokens = chunksProcessed * avgTokensPerChunk;
    const estimatedCostUsd = (estimatedTokens / 1_000_000) * costPerMillionTokensUsd;

    return {
      totalChunks: chunksProcessed,
      durationMs,
      chunksPerSecond,
      failures,
      retries,
      estimatedCostUsd: Math.round(estimatedCostUsd * 100000) / 100000
    };
  }

  public getAverageNoRetrievalLatencyMs(): number {
    const noRag = this.chatLatencyRecords.filter(r => !r.isRetrievalRequested);
    if (noRag.length === 0) return 0;
    return Math.round(noRag.reduce((sum, r) => sum + r.totalLatencyMs, 0) / noRag.length);
  }
}
