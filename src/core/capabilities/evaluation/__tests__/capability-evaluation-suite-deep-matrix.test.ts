import { CapabilityEvaluationSuite, EvaluationDomain } from '../CapabilityEvaluationSuite';

describe('B75-08: Capability Evaluation Suite Full Domain Matrix', () => {
  let suite: CapabilityEvaluationSuite;

  beforeEach(() => {
    suite = CapabilityEvaluationSuite.getInstance();
  });

  it('runs all 10 domain evaluations with full checks coverage', async () => {
    const allDomains = suite.getAllDomains();
    expect(allDomains.length).toBe(10);

    const fullResult = await suite.runSuite();
    expect(fullResult.id).toBeDefined();
    expect(fullResult.totalChecks).toBeGreaterThanOrEqual(10);
    expect(fullResult.sha256Digest).toBeDefined();
    expect(fullResult.checks.length).toBe(fullResult.totalChecks);

    for (const domain of allDomains) {
      expect(fullResult.domainSummaries[domain]).toBeDefined();
      expect(fullResult.domainSummaries[domain].total).toBeGreaterThanOrEqual(1);
    }
  });

  it('runs evaluations for filtered individual domains', async () => {
    const singleDomain: EvaluationDomain = 'path_containment_and_secret_denial';
    const singleResult = await suite.runSuite({ domains: [singleDomain] });

    expect(singleResult.totalChecks).toBeGreaterThanOrEqual(1);
    expect(singleResult.domainSummaries[singleDomain].total).toBeGreaterThanOrEqual(1);
  });
});
