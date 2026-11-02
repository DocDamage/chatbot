import {
  TestTierSchema,
  RequiredUnitServiceSchema,
  SecurityTestVectorSchema,
  TestSuiteResultSchema,
  TestComplianceSummarySchema,
} from './testing-strategy';

describe('Testing Strategy Schemas (Section 36)', () => {
  it('validates test tiers correctly', () => {
    expect(TestTierSchema.parse('UNIT')).toBe('UNIT');
    expect(TestTierSchema.parse('SECURITY')).toBe('SECURITY');
    expect(() => TestTierSchema.parse('UNKNOWN')).toThrow();
  });

  it('validates required unit services', () => {
    expect(RequiredUnitServiceSchema.parse('request_normalizer')).toBe('request_normalizer');
    expect(RequiredUnitServiceSchema.parse('dataset_job_state_machine')).toBe('dataset_job_state_machine');
    expect(() => RequiredUnitServiceSchema.parse('random_service')).toThrow();
  });

  it('validates test suite result and compliance summary', () => {
    const result = TestSuiteResultSchema.parse({
      suiteId: 'unit-1',
      name: 'Request Normalizer Unit',
      tier: 'UNIT',
      totalTests: 10,
      passedTests: 10,
      failedTests: 0,
      durationMs: 45,
      coveredServices: ['request_normalizer'],
    });
    expect(result.passedTests).toBe(10);

    const summary = TestComplianceSummarySchema.parse({
      certified: true,
      totalTiersChecked: 6,
      totalSuites: 6,
      totalTestsPassed: 60,
      missingUnitServices: [],
      missingSecurityVectors: [],
      tierResults: {
        UNIT: { suitesCount: 1, testsPassed: 10, allPassed: true },
        INTEGRATION: { suitesCount: 1, testsPassed: 10, allPassed: true },
        DATABASE: { suitesCount: 1, testsPassed: 10, allPassed: true },
        BROWSER_E2E: { suitesCount: 1, testsPassed: 10, allPassed: true },
        SECURITY: { suitesCount: 1, testsPassed: 10, allPassed: true },
        EVAL: { suitesCount: 1, testsPassed: 10, allPassed: true },
      },
    });
    expect(summary.certified).toBe(true);
  });
});
