import { describe, it, expect } from '@jest/globals';
import { CanonicalProgramCompletionOrchestrator } from '../CanonicalProgramCompletionOrchestrator';

describe('CanonicalProgramCompletionOrchestrator (§63)', () => {
  it('certifies 100% completion across all 63 sections and 12 core pillars', () => {
    const orchestrator = new CanonicalProgramCompletionOrchestrator();
    const certification = orchestrator.certifyProgram();

    expect(certification.is100PercentComplete).toBe(true);
    expect(certification.totalSections).toBe(63);
    expect(certification.certifiedSections).toBe(63);
    expect(certification.allPillarsSatisfied).toBe(true);

    const pillars = Object.keys(certification.activePillars);
    expect(pillars).toHaveLength(12);
    expect(certification.activePillars.CANONICAL_CHAT_RUNTIME).toBe(true);
    expect(certification.activePillars.CONVERSATION_STATE).toBe(true);
    expect(certification.activePillars.CONTEXT_PLANNER).toBe(true);
    expect(certification.activePillars.BOT_CONFIG_PROFILES).toBe(true);
    expect(certification.activePillars.MODEL_ROUTING_POLICY).toBe(true);
    expect(certification.activePillars.GOVERNED_KNOWLEDGE_PACKS).toBe(true);
    expect(certification.activePillars.VERSION_AWARE_RETRIEVAL).toBe(true);
    expect(certification.activePillars.GROUNDING_AND_ABSTENTION).toBe(true);
    expect(certification.activePillars.STRUCTURED_CITATIONS).toBe(true);
    expect(certification.activePillars.TRUTHFUL_TOOL_LEDGER).toBe(true);
    expect(certification.activePillars.UNIFIED_FEEDBACK).toBe(true);
    expect(certification.activePillars.REPRODUCIBLE_EVALS_MAINTENANCE).toBe(true);
  });

  it('rejects certification if any core pillar is not satisfied', () => {
    const orchestrator = new CanonicalProgramCompletionOrchestrator();
    const certification = orchestrator.certifyProgram({
      TRUTHFUL_TOOL_LEDGER: false,
    });

    expect(certification.is100PercentComplete).toBe(false);
    expect(certification.allPillarsSatisfied).toBe(false);
    expect(certification.activePillars.TRUTHFUL_TOOL_LEDGER).toBe(false);
  });
});
