import {
  RuntimeDoDCertification,
  DefinitionOfDoneEvaluationInput,
  DoDDomain,
} from './runtime-definition-of-done';

describe('Runtime Definition of Done Types', () => {
  it('allows structured evaluation input across all 6 domains', () => {
    const input: DefinitionOfDoneEvaluationInput = {
      runtime: {
        allDefaultChatApisCanonical: true,
        truthfulFallback: true,
      },
      knowledge: {
        datasetsAndPacksVersioned: true,
      },
      data: {
        sqliteMigrationsPass: true,
      },
      quality: {
        goldenSuiteMeetsThresholds: true,
      },
      ui: {
        defaultChatRemainsSimple: true,
      },
      operations: {
        runtimeStageMetricsExist: true,
      },
    };

    expect(input.runtime?.allDefaultChatApisCanonical).toBe(true);
    expect(input.knowledge?.datasetsAndPacksVersioned).toBe(true);
  });

  it('verifies certification structure completeness', () => {
    const domains: DoDDomain[] = ['runtime', 'knowledge', 'data', 'quality', 'ui', 'operations'];
    const mockDomainResults = domains.reduce((acc, domain) => {
      acc[domain] = {
        domain,
        totalCriteria: 5,
        passedCriteria: 5,
        isSatisfied: true,
        unmetCriteria: [],
      };
      return acc;
    }, {} as RuntimeDoDCertification['domainResults']);

    const certification: RuntimeDoDCertification = {
      isCertified: true,
      totalCriteria: 30,
      passedCriteria: 30,
      completionRate: 1.0,
      domainResults: mockDomainResults,
      allUnmetCriteria: [],
      evaluatedAt: new Date().toISOString(),
    };

    expect(certification.isCertified).toBe(true);
    expect(certification.completionRate).toBe(1.0);
    expect(certification.domainResults.runtime.isSatisfied).toBe(true);
  });
});
