import { CapabilityEvaluationSuite } from './CapabilityEvaluationSuite';

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

  it('scrubs sensitive credentials, tokens, and PII from text', () => {
    const raw = 'Auth token sk-live-abc123456789 with email developer@example.com and password: "SecretPassword123"';
    const scrubbed = suite.scrubSensitiveData(raw);

    expect(scrubbed).not.toContain('sk-live-abc123456789');
    expect(scrubbed).not.toContain('developer@example.com');
    expect(scrubbed).not.toContain('SecretPassword123');
    expect(scrubbed).toContain('[REDACTED_API_KEY]');
    expect(scrubbed).toContain('[REDACTED_EMAIL]');
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

  it('produces the same evidence digest for the same checks despite run timestamps', async () => {
    const options = { domains: ['deterministic_game_replay', 'hosted_mode_denial'] as const };
    const first = await suite.runSuite({ domains: [...options.domains] });
    const second = await suite.runSuite({ domains: [...options.domains] });
    expect(first.sha256Digest).toBe(second.sha256Digest);
  });
});
