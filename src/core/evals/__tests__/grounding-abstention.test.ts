/**
 * Grounding, Evidence Sufficiency, and Abstention Integration Tests
 * CRK Phase 12: CRK-P12-T01 to T05 & Phase 12 Exit Gate
 */

import { GroundingEvaluator } from '../GroundingEvaluator';
import { GroundingEscalationFlow } from '../GroundingEscalationFlow';
import { ResponseWordingPolicy } from '../ResponseWordingPolicy';
import { CANONICAL_ANSWERABILITY_BENCHMARK } from '../AnswerabilityEvalSet';

describe('Grounding & Abstention Suite (Phase 12 Exit Gate)', () => {
  it('should evaluate all 7 canonical answerability benchmark scenarios accurately (CRK-P12-T04)', () => {
    for (const scenario of CANONICAL_ANSWERABILITY_BENCHMARK) {
      const decision = GroundingEvaluator.evaluate({
        query: scenario.query,
        chunks: scenario.chunks,
      });

      expect(decision.sufficient).toBe(scenario.expectedSufficiency);
      expect(decision.recommendedAction).toBe(scenario.expectedAction);
    }
  });

  it('should separate broaden-local and online escalation stages (CRK-P12-T03)', async () => {
    let localBroadenCalled = false;
    let onlineSearchCalled = false;

    // Step 1: Initial empty retrieval with local broadening enabled
    const resultStage2 = await GroundingEscalationFlow.execute(
      {
        query: 'How to configure clustering?',
        chunks: [],
        onlineSearchAllowed: true,
      },
      {
        broadenLocalRetrieval: async () => {
          localBroadenCalled = true;
          return [
            {
              id: 'local-broadened-1',
              content: 'Clustering configuration details in local cluster.config.json',
              sourceUri: 'file://cluster.config.json',
              authority: 0.9,
              compositeScore: 0.85,
            },
          ];
        },
        onlineSearchRetrieval: async () => {
          onlineSearchCalled = true;
          return [];
        },
      }
    );

    // Broaden-local succeeded, so online search was NOT called!
    expect(localBroadenCalled).toBe(true);
    expect(onlineSearchCalled).toBe(false);
    expect(resultStage2.escalationStage).toBe('broaden-local');
    expect(resultStage2.finalDecision.sufficient).toBe(true);

    // Step 2: If broaden-local returns nothing, escalate to online search
    localBroadenCalled = false;
    const resultStage3 = await GroundingEscalationFlow.execute(
      {
        query: 'What is deep sparse autoencoder?',
        chunks: [],
        onlineSearchAllowed: true,
      },
      {
        broadenLocalRetrieval: async () => {
          localBroadenCalled = true;
          return []; // nothing found locally
        },
        onlineSearchRetrieval: async () => {
          onlineSearchCalled = true;
          return [
            {
              id: 'online-1',
              content: 'A deep sparse autoencoder enforces sparsity constraints on hidden layers.',
              sourceUri: 'https://arxiv.org/abs/1234.5678',
              authority: 0.92,
              compositeScore: 0.88,
            },
          ];
        },
      }
    );

    expect(localBroadenCalled).toBe(true);
    expect(onlineSearchCalled).toBe(true);
    expect(resultStage3.escalationStage).toBe('search-online');
    expect(resultStage3.finalDecision.sufficient).toBe(true);
  });

  it('should verify that citation presence does not substitute for evidence sufficiency', () => {
    // A chunk with high authority and a citation URL, but completely irrelevant to query
    const irrelevantChunk = {
      id: 'irrelevant-citation',
      content: 'Bananas are rich in potassium and grow in tropical regions.',
      sourceUri: 'https://en.wikipedia.org/wiki/Banana',
      authority: 0.95,
      compositeScore: 0.2, // low score, 0 query coverage
    };

    const decision = GroundingEvaluator.evaluate({
      query: 'What is the transaction isolation level in PostgreSQL?',
      chunks: [irrelevantChunk],
    });

    expect(decision.sufficient).toBe(false);
    expect(decision.recommendedAction).not.toBe('answer');
  });

  it('should format abstention response without leaking internal hidden reasoning (CRK-P12-T05, §2303)', () => {
    const decision = GroundingEvaluator.evaluate({
      query: 'What is the undocumented opcode in Chip 999?',
      chunks: [],
    });

    const abstention = ResponseWordingPolicy.formatAbstention(
      'undocumented opcode in Chip 999',
      decision
    );

    expect(abstention.userMessage).toContain('I do not have sufficient evidence');
    expect(abstention.userMessage).toContain('does not mean the fact does not exist');
    expect(abstention.distinction).toBe('insufficient-local-knowledge');
    // Ensure hidden chain-of-thought is not exposed to user
    expect(abstention.userMessage).not.toContain('conflictingEvidence: false');
    expect(abstention.userMessage).not.toContain('reasons: [');
  });
});
