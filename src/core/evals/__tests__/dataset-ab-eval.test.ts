import { DatasetAbEvaluator } from '../DatasetAbEvaluator';
import { RetrievalWeightTuner, EvaluationItem } from '../RetrievalWeightTuner';
import { AbComparativeMetrics } from '../../../types/ab-evaluation';

describe('Phase 25: Dataset and Policy A/B Evaluation', () => {
  const evaluator = new DatasetAbEvaluator();

  it('promotes official documentation pack to PROMOTED_DEFAULT based on positive empirical delta (§3697)', () => {
    const officialDocsMetrics: AbComparativeMetrics = {
      correctnessRateA: 0.81,
      correctnessRateB: 0.92, // +11%
      outdatedAnswerRateA: 0.14,
      outdatedAnswerRateB: 0.06, // -8%
      unsupportedClaimsRateA: 0.05,
      unsupportedClaimsRateB: 0.02,
      citationCorrectnessA: 0.82,
      citationCorrectnessB: 0.98,
      avgRetrievalLatencyMsA: 25,
      avgRetrievalLatencyMsB: 65, // +40ms
      storageAddedBytes: 3_100_000_000,
      sourceDiversityScore: 0.88,
    };

    const decision = evaluator.evaluatePromotion('core-official-docs', officialDocsMetrics);
    expect(decision.status).toBe('PROMOTED_DEFAULT');
    expect(decision.rationale).toContain('DEFAULT');
    expect(decision.metrics.correctnessRateB).toBe(0.92);
  });

  it('promotes educational web pack to PROMOTED_OPTIONAL (§3704)', () => {
    const eduWebMetrics: AbComparativeMetrics = {
      correctnessRateA: 0.85,
      correctnessRateB: 0.87, // +2% (modest gain)
      outdatedAnswerRateA: 0.08,
      outdatedAnswerRateB: 0.09, // +1% (within 2% limit)
      unsupportedClaimsRateA: 0.04,
      unsupportedClaimsRateB: 0.06, // +2% (within 3% limit)
      citationCorrectnessA: 0.85,
      citationCorrectnessB: 0.91,
      avgRetrievalLatencyMsA: 30,
      avgRetrievalLatencyMsB: 150, // +120ms
      storageAddedBytes: 5_200_000_000,
      sourceDiversityScore: 0.92,
    };

    const decision = evaluator.evaluatePromotion('educational-web', eduWebMetrics, {
      targetStatus: 'OPTIONAL',
    });
    expect(decision.status).toBe('PROMOTED_OPTIONAL');
    expect(decision.rationale).toContain('OPTIONAL');
  });

  it('rejects a pack that degrades correctness or increases outdated answers (§3686)', () => {
    const degradedMetrics: AbComparativeMetrics = {
      correctnessRateA: 0.90,
      correctnessRateB: 0.84, // -6% degradation!
      outdatedAnswerRateA: 0.05,
      outdatedAnswerRateB: 0.15, // +10% outdated!
      unsupportedClaimsRateA: 0.03,
      unsupportedClaimsRateB: 0.10, // +7% hallucination!
      citationCorrectnessA: 0.95,
      citationCorrectnessB: 0.70,
      avgRetrievalLatencyMsA: 20,
      avgRetrievalLatencyMsB: 200,
      storageAddedBytes: 2_000_000_000,
      sourceDiversityScore: 0.40,
    };

    const decision = evaluator.evaluatePromotion('unverified-forum-pack', degradedMetrics);
    expect(decision.status).toBe('REJECTED');
    expect(decision.rationale).toContain('Correctness degraded');
    expect(decision.rationale).toContain('Outdated answers increased');
  });

  it('rejects a pack that violates storage quota (§3691)', () => {
    const hugeMetrics: AbComparativeMetrics = {
      correctnessRateA: 0.85,
      correctnessRateB: 0.90,
      outdatedAnswerRateA: 0.08,
      outdatedAnswerRateB: 0.07,
      unsupportedClaimsRateA: 0.04,
      unsupportedClaimsRateB: 0.03,
      citationCorrectnessA: 0.88,
      citationCorrectnessB: 0.95,
      avgRetrievalLatencyMsA: 30,
      avgRetrievalLatencyMsB: 70,
      storageAddedBytes: 15_000_000_000, // 15 GB (exceeds 10 GB limit)
      sourceDiversityScore: 0.90,
    };

    const decision = evaluator.evaluatePromotion('massive-unfiltered-corpus', hugeMetrics);
    expect(decision.status).toBe('REJECTED');
    expect(decision.rationale).toContain('exceeds budget');
  });

  it('tunes retrieval weights against held-out validation cases (§3715)', () => {
    const tuner = new RetrievalWeightTuner();

    const heldOutCases: EvaluationItem[] = [
      {
        query: 'How to sort arrays in TypeScript',
        expectedTopDocId: 'doc-official-ts',
        candidateDocs: [
          {
            docId: 'doc-official-ts',
            authority: 0.95,
            freshness: 0.9,
            quality: 0.9,
            versionScore: 1.0,
            textMatch: 0.8,
          },
          {
            docId: 'doc-old-blog',
            authority: 0.4,
            freshness: 0.2,
            quality: 0.5,
            versionScore: 0.3,
            textMatch: 0.9,
          },
        ],
      },
    ];

    const weightCandidates = [
      // Authority-prioritized weights
      { authority: 0.4, freshness: 0.1, quality: 0.2, versionScore: 0.2, textMatch: 0.1 },
      // Pure text-match weights (which would pick old blog)
      { authority: 0.05, freshness: 0.05, quality: 0.05, versionScore: 0.05, textMatch: 0.8 },
    ];

    const tuned = tuner.tuneHeldOutWeights(heldOutCases, weightCandidates);
    expect(tuned.heldOutEvaluationScore).toBe(1.0);
    expect(tuned.weights.authority).toBe(0.4);
    expect(tuned.version).toBeDefined();
  });
});
