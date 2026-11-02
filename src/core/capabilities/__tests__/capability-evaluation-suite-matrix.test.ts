import { CapabilityEvaluationSuite } from '../evaluation/CapabilityEvaluationSuite';

describe('B75-08: CapabilityEvaluationSuite All 10 Domains and Digest Matrix', () => {
  let suite: CapabilityEvaluationSuite;

  beforeEach(() => {
    suite = new CapabilityEvaluationSuite();
  });

  it('runs all 10 domain evaluations across local and hosted profiles', async () => {
    const allDomains = suite.getAllDomains();
    expect(allDomains.length).toBe(10);

    // Run full evaluation suite
    const fullResult = await suite.runSuite({ targetRepoPath: process.cwd() });
    expect(fullResult.id).toBeDefined();
    expect(fullResult.sha256Digest).toBeDefined();
    expect(fullResult.totalChecks).toBeGreaterThanOrEqual(10);
    expect(Object.keys(fullResult.domainSummaries).length).toBe(10);
    expect(fullResult.overallScore).toBeGreaterThanOrEqual(0);

    // Run each domain individually
    for (const domain of allDomains) {
      const domainResult = await suite.runSuite({ domains: [domain], targetRepoPath: process.cwd() });
      expect(domainResult.domainSummaries[domain].total).toBeGreaterThan(0);
      expect(domainResult.checks.length).toBeGreaterThan(0);
    }
  });

  it('evaluates hosted mode denial when runtime profile is hosted', async () => {
    const hostedChecks = await (suite as any).evalHostedModeDenial('hosted');
    expect(hostedChecks.length).toBeGreaterThanOrEqual(1);
    expect(hostedChecks.every((c: any) => c.status === 'passed')).toBe(true);

    const localChecks = await (suite as any).evalHostedModeDenial('local_full');
    expect(localChecks.length).toBeGreaterThanOrEqual(1);
  });
});
