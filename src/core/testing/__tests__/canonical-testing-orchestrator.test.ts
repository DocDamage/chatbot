import {
  CanonicalTestingOrchestrator,
  MANDATORY_UNIT_SERVICES,
  MANDATORY_SECURITY_VECTORS,
} from '../CanonicalTestingOrchestrator';

describe('CanonicalTestingOrchestrator (Section 36 Testing Strategy)', () => {
  let orchestrator: CanonicalTestingOrchestrator;

  beforeEach(() => {
    orchestrator = new CanonicalTestingOrchestrator();
  });

  it('reports uncertified when tiers or services are missing', () => {
    orchestrator.registerSuite({
      suiteId: 'unit-part',
      name: 'Partial Unit',
      tier: 'UNIT',
      totalTests: 5,
      passedTests: 5,
      failedTests: 0,
      durationMs: 50,
      coveredServices: ['request_normalizer'],
    });

    const summary = orchestrator.evaluateCompliance();
    expect(summary.certified).toBe(false);
    expect(summary.missingUnitServices.length).toBeGreaterThan(0);
    expect(summary.missingSecurityVectors.length).toBe(MANDATORY_SECURITY_VECTORS.length);
  });

  it('certifies when all 6 tiers, 17 unit services, and 9 security vectors pass', () => {
    // 1. Unit tier
    orchestrator.registerSuite({
      suiteId: 'suite-unit-all',
      name: 'All Unit Services Suite',
      tier: 'UNIT',
      totalTests: 17,
      passedTests: 17,
      failedTests: 0,
      durationMs: 120,
      coveredServices: MANDATORY_UNIT_SERVICES,
    });

    // 2. Integration tier
    orchestrator.registerSuite({
      suiteId: 'suite-integration',
      name: 'Pipeline E2E Integration Suite',
      tier: 'INTEGRATION',
      totalTests: 10,
      passedTests: 10,
      failedTests: 0,
      durationMs: 340,
    });

    // 3. Database tier
    orchestrator.registerSuite({
      suiteId: 'suite-db',
      name: 'SQLite & Postgres Migrations Suite',
      tier: 'DATABASE',
      totalTests: 8,
      passedTests: 8,
      failedTests: 0,
      durationMs: 210,
    });

    // 4. Browser E2E tier
    orchestrator.registerSuite({
      suiteId: 'suite-e2e',
      name: 'Browser UI Spec Suite',
      tier: 'BROWSER_E2E',
      totalTests: 7,
      passedTests: 7,
      failedTests: 0,
      durationMs: 850,
    });

    // 5. Security tier
    orchestrator.registerSuite({
      suiteId: 'suite-security',
      name: 'Security Vectors Suite',
      tier: 'SECURITY',
      totalTests: 9,
      passedTests: 9,
      failedTests: 0,
      durationMs: 190,
      coveredSecurityVectors: MANDATORY_SECURITY_VECTORS,
    });

    // 6. Eval tier
    orchestrator.registerSuite({
      suiteId: 'suite-eval',
      name: 'Golden Suite and Retrieval Benchmarks',
      tier: 'EVAL',
      totalTests: 15,
      passedTests: 15,
      failedTests: 0,
      durationMs: 420,
    });

    const summary = orchestrator.evaluateCompliance();
    expect(summary.certified).toBe(true);
    expect(summary.totalSuites).toBe(6);
    expect(summary.totalTestsPassed).toBe(66);
    expect(summary.missingUnitServices).toHaveLength(0);
    expect(summary.missingSecurityVectors).toHaveLength(0);
  });

  it('fails certification if any test in any tier fails', () => {
    orchestrator.registerSuite({
      suiteId: 'suite-unit-all',
      name: 'All Unit Services Suite',
      tier: 'UNIT',
      totalTests: 17,
      passedTests: 16,
      failedTests: 1,
      durationMs: 120,
      coveredServices: MANDATORY_UNIT_SERVICES,
    });

    const summary = orchestrator.evaluateCompliance();
    expect(summary.certified).toBe(false);
    expect(summary.tierResults['UNIT']?.allPassed).toBe(false);
  });

  it('verifies chat runtime and knowledge ingestion integration pipelines', () => {
    const chatPipeline = orchestrator.verifyChatRuntimeIntegrationPipeline();
    expect(chatPipeline.verified).toBe(true);
    expect(chatPipeline.stages).toContain('context_plan');
    expect(chatPipeline.stages).toContain('persisted_trace');

    const ingestionPipeline = orchestrator.verifyKnowledgeIngestionPipeline();
    expect(ingestionPipeline.verified).toBe(true);
    expect(ingestionPipeline.stages).toContain('normalized_records');
    expect(ingestionPipeline.stages).toContain('citation');
  });
});
