import { CapacityPerformanceTracker } from '../CapacityPerformanceTracker';
import { ResourceGuardrailService } from '../ResourceGuardrailService';

describe('CapacityPerformanceTracker & ResourceGuardrails (Section 34 Compliance)', () => {
  beforeEach(() => {
    CapacityPerformanceTracker.resetInstance();
  });

  describe('34.1: Chat Latency Budget Tracking', () => {
    it('records and aggregates latency stages for no-retrieval requests', () => {
      const tracker = CapacityPerformanceTracker.getInstance();
      const record = tracker.recordChatLatency('req-001', false, {
        normalization: 5,
        stateLoad: 3,
        contextPlanning: 4,
        retrieval: 0, // no retrieval
        reranking: 0,
        modelSelection: 2,
        providerGeneration: 120,
        validation: 6,
        persistence: 5
      });

      expect(record.totalLatencyMs).toBe(145);
      expect(record.isRetrievalRequested).toBe(false);
      expect(record.stageTimingsMs.retrieval).toBe(0);
      expect(tracker.getAverageNoRetrievalLatencyMs()).toBe(145);
    });

    it('records latency when retrieval is active without distorting no-retrieval stats', () => {
      const tracker = CapacityPerformanceTracker.getInstance();
      tracker.recordChatLatency('req-002', true, {
        normalization: 5,
        stateLoad: 3,
        contextPlanning: 5,
        retrieval: 45,
        reranking: 20,
        modelSelection: 2,
        providerGeneration: 200,
        validation: 8,
        persistence: 7
      });

      // Average no-retrieval stays 0 because only retrieval request is in tracker
      expect(tracker.getAverageNoRetrievalLatencyMs()).toBe(0);
    });
  });

  describe('34.2 & 34.3: Query Benchmarking & Storage Breakdown', () => {
    it('tracks detailed index size breakdown in bytes', () => {
      const tracker = CapacityPerformanceTracker.getInstance();
      const metrics = tracker.updateIndexSize('pack-official-docs', {
        rawSourceBytes: 10_000_000,
        normalizedBytes: 8_000_000,
        chunkTextBytes: 6_000_000,
        embeddingBytes: 12_000_000,
        indexBytes: 3_000_000,
        metadataBytes: 1_000_000
      });

      expect(metrics.totalBytes).toBe(40_000_000);
      expect(tracker.getIndexSizeMetrics('pack-official-docs')?.totalBytes).toBe(40_000_000);
      expect(tracker.getAllIndexSizes()).toHaveLength(1);
    });

    it('calculates embedding throughput and cost projections', () => {
      const tracker = CapacityPerformanceTracker.getInstance();
      const throughput = tracker.calculateEmbeddingThroughput(1000, 2000, 0, 2, 0.02, 250);
      expect(throughput.chunksPerSecond).toBe(500);
      expect(throughput.totalChunks).toBe(1000);
      expect(throughput.estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('34.5: Resource Guardrails', () => {
    it('allows dataset jobs to proceed when all metrics are healthy', async () => {
      const guardrails = new ResourceGuardrailService({
        minFreeDiskGB: 10,
        diskCheckFn: async () => 80,
        dbCheckFn: async () => true,
        embeddingHealthCheckFn: async () => true
      });

      const state = await guardrails.evaluateGuardrails();
      expect(state.canProceed).toBe(true);
      expect(state.pauseReasons).toHaveLength(0);
    });

    it('pauses dataset jobs when disk space falls below safety threshold', async () => {
      const guardrails = new ResourceGuardrailService({
        minFreeDiskGB: 15,
        diskCheckFn: async () => 8 // only 8GB free!
      });

      const state = await guardrails.evaluateGuardrails();
      expect(state.canProceed).toBe(false);
      expect(state.pauseReasons[0]).toContain('below safety threshold');
    });

    it('pauses dataset jobs when database or embedding provider health probe fails', async () => {
      const guardrails = new ResourceGuardrailService({
        dbCheckFn: async () => false,
        embeddingHealthCheckFn: async () => false
      });

      const state = await guardrails.evaluateGuardrails();
      expect(state.canProceed).toBe(false);
      expect(state.pauseReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Database connection is unavailable'),
          expect.stringContaining('Embedding provider is unhealthy')
        ])
      );
    });
  });
});
