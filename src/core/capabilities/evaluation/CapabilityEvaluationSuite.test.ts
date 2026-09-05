import {
  CapabilityEvaluationSuite,
  EvaluationCheck,
  EvaluationSuiteResult
} from './CapabilityEvaluationSuite';

describe('CapabilityEvaluationSuite', () => {
  let suite: CapabilityEvaluationSuite;

  beforeEach(() => {
    suite = CapabilityEvaluationSuite.getInstance();
  });

  it('runs complete evaluation suite across all 10 domain areas', async () => {
    const result = await suite.runSuite();

    expect(result).toBeDefined();
    expect(result.id).toMatch(/^eval-run-/);
    expect(result.totalChecks).toBeGreaterThanOrEqual(10);
    expect(result.passedChecks).toBeGreaterThan(0);
    expect(result.overallScore).toBeGreaterThanOrEqual(0.8);
    expect(result.sha256Digest).toHaveLength(64);

    // Verify all 10 domains are summarized
    const allDomains = suite.getAllDomains();
    expect(allDomains).toHaveLength(10);
    for (const domain of allDomains) {
      expect(result.domainSummaries[domain]).toBeDefined();
      expect(result.domainSummaries[domain].total).toBeGreaterThan(0);
      expect(result.domainSummaries[domain].passed).toBeGreaterThan(0);
    }
  });

  it('supports running evaluation on a filtered subset of domains', async () => {
    const subsetResult = await suite.runSuite({
      domains: ['path_containment_and_secret_denial', 'deterministic_game_replay']
    });

    expect(subsetResult.domainSummaries['path_containment_and_secret_denial']).toBeDefined();
    expect(subsetResult.domainSummaries['deterministic_game_replay']).toBeDefined();
    expect(subsetResult.domainSummaries['lexical_hybrid_retrieval_ranking'].total).toBe(0);
  });

  it('handles an explicitly empty domain set without inventing a score', async () => {
    const result = await suite.runSuite({ domains: [], profile: 'hosted' });
    expect(result).toMatchObject({
      runtimeProfile: 'hosted', totalChecks: 0, passedChecks: 0,
      failedChecks: 0, warnedChecks: 0, overallScore: 0, status: 'passed'
    });
    expect(Object.values(result.domainSummaries).every(summary => summary.total === 0)).toBe(true);
  });

  it('classifies high-scoring failures as degraded and lower scores as failed', async () => {
    const domain = 'architecture_graph_determinism_and_recall' as const;
    const makeCheck = (status: EvaluationCheck['status'], score: number): EvaluationCheck => ({
      id: `${status}-${score}`, name: 'Synthetic classification check', domain,
      status, score, durationMs: 0, details: 'Synthetic status aggregation fixture'
    });
    const evaluateSpy = jest.spyOn(suite as any, 'evaluateDomain');

    evaluateSpy.mockResolvedValueOnce([makeCheck('failed', 0.8), makeCheck('passed', 1)]);
    const degraded = await suite.runSuite({ domains: [domain], profile: 'local' });
    expect(degraded).toMatchObject({ status: 'degraded', failedChecks: 1, overallScore: 0.9 });

    evaluateSpy.mockResolvedValueOnce([makeCheck('failed', 0), makeCheck('warned', 0.5)]);
    const failed = await suite.runSuite({ domains: [domain], profile: 'local' });
    expect(failed).toMatchObject({ status: 'failed', failedChecks: 1, warnedChecks: 1, overallScore: 0.25 });
  });

  it('returns no checks for an unknown runtime domain', async () => {
    await expect((suite as any).evaluateDomain('unknown-domain', 'local')).resolves.toEqual([]);
  });

  it('reports the active hosted profile while still proving local capability denial', async () => {
    const result = await suite.runSuite({ domains: ['hosted_mode_denial'], profile: 'hosted' });
    expect(result.status).toBe('passed');
    expect(result.checks[0].details).toContain('Active profile is HOSTED');
  });

  it('scrubs sensitive credentials, tokens, and PII from text', () => {
    const raw = 'Auth token sk-live-abc123456789 with email developer@example.com and password: "SecretPassword123"';
    const scrubbed = suite.scrubSensitiveData(raw);

    expect(scrubbed).not.toContain('sk-live-abc123456789');
    expect(scrubbed).not.toContain('developer@example.com');
    expect(scrubbed).not.toContain('SecretPassword123');
    expect(scrubbed).toContain('[REDACTED_API_KEY]');
    expect(scrubbed).toContain('[REDACTED_EMAIL]');
  });

  it('scrubs bearer credentials and unquoted secret assignments', () => {
    const scrubbed = suite.scrubSensitiveData('Bearer abcdefghijklmnop secret=my-secret token:token-value');
    expect(scrubbed).toContain('Bearer [REDACTED_TOKEN]');
    expect(scrubbed).toContain('secret=[REDACTED]');
    expect(scrubbed).toContain('token=[REDACTED]');
    expect(scrubbed).not.toContain('abcdefghijklmnop');
    expect(scrubbed).not.toContain('my-secret');
  });

  it('generates a reproducible Markdown evaluation report', async () => {
    const result = await suite.runSuite();
    const markdown = suite.generateMarkdownReport(result);

    expect(markdown).toContain('# Capability Fusion Evaluation Report');
    expect(markdown).toContain(result.id);
    expect(markdown).toContain(result.sha256Digest);
    expect(markdown).toContain('## Domain Summaries');
    expect(markdown).toContain('## Detailed Checks');
  });

  it('renders warning, failure, and remediation details in Markdown', () => {
    const domain = 'sanitized_logs_and_support_bundles' as const;
    const result: EvaluationSuiteResult = {
      id: 'eval-report-fixture', timestamp: '2026-08-25T00:00:00.000Z', runtimeProfile: 'local',
      totalChecks: 2, passedChecks: 0, failedChecks: 1, warnedChecks: 1,
      overallScore: 0.4, status: 'failed', sha256Digest: 'a'.repeat(64),
      domainSummaries: Object.fromEntries(suite.getAllDomains().map(item => [item, {
        total: item === domain ? 2 : 0, passed: 0, failed: item === domain ? 1 : 0,
        averageScore: item === domain ? 0.4 : 0
      }])) as EvaluationSuiteResult['domainSummaries'],
      checks: [
        { id: 'WARN-1', name: 'Warning fixture', domain, status: 'warned', score: 0.8, durationMs: 2, details: 'warning' },
        { id: 'FAIL-1', name: 'Failure fixture', domain, status: 'failed', score: 0, durationMs: 3, details: 'failure', remediation: 'Fix the fixture' }
      ]
    };
    const markdown = suite.generateMarkdownReport(result);
    expect(markdown).toContain('### [WARN] WARN-1');
    expect(markdown).toContain('### [FAIL] FAIL-1');
    expect(markdown).toContain('**Remediation**: Fix the fixture');
  });

  it('produces the same evidence digest for the same checks despite run timestamps', async () => {
    const options = { domains: ['deterministic_game_replay', 'hosted_mode_denial'] as const };
    const first = await suite.runSuite({ domains: [...options.domains] });
    const second = await suite.runSuite({ domains: [...options.domains] });
    expect(first.sha256Digest).toBe(second.sha256Digest);
  });
});
