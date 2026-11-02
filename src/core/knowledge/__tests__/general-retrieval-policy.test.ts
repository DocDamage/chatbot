import { describe, it, expect } from '@jest/globals';
import { GeneralRetrievalPolicyEngine } from '../GeneralRetrievalPolicyEngine';
import { SnapshotMetadata } from '../../../types/general-retrieval-policy';

describe('GeneralRetrievalPolicyEngine (§51)', () => {
  const dummySnapshot: SnapshotMetadata = {
    snapshotId: 'wiki-snap-2023-q4',
    snapshotDate: '2023-12-31',
    cutoffDate: '2023-12-01',
    version: '1.0.0',
  };

  it('should classify normal facts and prefer structured knowledge & encyclopedia (§51.1)', () => {
    const engine = new GeneralRetrievalPolicyEngine();
    const plan = engine.createPlan('What is the capital of Japan?');

    expect(plan.category).toBe('normal_fact');
    expect(plan.preferredSourceOrder[0]).toBe('structured_knowledge');
    expect(plan.preferredSourceOrder[1]).toBe('encyclopedia');
    expect(plan.freshnessDisclosureRequired).toBe(false);
  });

  it('should classify scientific questions and prioritize research papers (§51.2)', () => {
    const engine = new GeneralRetrievalPolicyEngine();
    const plan = engine.createPlan('What are the latest findings in quantum superconductivity and thermodynamics?');

    // Has 'latest' but also scientific terms, check if scientific question gets research papers
    const engineOffline = new GeneralRetrievalPolicyEngine({ allowOnlineRetrieval: false });
    const planScientific = engineOffline.createPlan('Explain the quantum mechanics of molecular biology');

    expect(planScientific.category).toBe('scientific_question');
    expect(planScientific.preferredSourceOrder[0]).toBe('research_papers');
    expect(planScientific.preferredSourceOrder[1]).toBe('structured_knowledge');
  });

  it('should recommend online retrieval for time-sensitive queries when online is allowed (§51.3)', () => {
    const engine = new GeneralRetrievalPolicyEngine({ allowOnlineRetrieval: true });
    const plan = engine.createPlan('Who is the current prime minister of the UK in 2026?');

    expect(plan.category).toBe('time_sensitive_fact');
    expect(plan.onlineRetrievalRecommended).toBe(true);
    expect(plan.preferredSourceOrder[0]).toBe('live_web');
  });

  it('should enforce the No False Freshness Invariant when offline (§51.4)', () => {
    const engine = new GeneralRetrievalPolicyEngine({ allowOnlineRetrieval: false });
    const plan = engine.createPlan('What are the latest announcements from the 2026 summit?', dummySnapshot);

    expect(plan.category).toBe('time_sensitive_fact');
    expect(plan.onlineRetrievalRecommended).toBe(false);
    expect(plan.freshnessDisclosureRequired).toBe(true);
    expect(plan.disclosureMessage).toContain('[Freshness Notice]');
    expect(plan.disclosureMessage).toContain('wiki-snap-2023-q4');
    expect(plan.disclosureMessage).toContain('cutoff: 2023-12-01');
  });

  it('should accurately detect various temporal indicators and years', () => {
    const engine = new GeneralRetrievalPolicyEngine();
    const analysis = engine.analyzeTemporal('What is breaking now in recent space exploration?');

    expect(analysis.isTimeSensitive).toBe(true);
    expect(analysis.temporalIndicators).toContain('now');
    expect(analysis.temporalIndicators).toContain('recent');
  });
});
