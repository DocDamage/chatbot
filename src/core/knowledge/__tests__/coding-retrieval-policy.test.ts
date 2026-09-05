import { CodingRetrievalPolicyEngine } from '../CodingRetrievalPolicyEngine';
import { PrioritizedCodingSource } from '../../../types/coding-retrieval-policy';

describe('CodingRetrievalPolicyEngine (§50)', () => {
  let engine: CodingRetrievalPolicyEngine;

  beforeEach(() => {
    engine = new CodingRetrievalPolicyEngine();
  });

  it('§50.1: analyzes request using project evidence before guessing', () => {
    const mockPackageJson = {
      name: 'chatbot',
      dependencies: {
        react: '^18.2.0',
        typescript: '^5.4.0'
      }
    };

    const evidence = engine.analyzeRequest('TS2345: Argument of type string is not assignable', mockPackageJson);

    expect(evidence.language).toBe('TypeScript');
    expect(evidence.framework).toBe('React');
    expect(evidence.evidenceSource).toBe('package_json');
    expect(evidence.detectedErrorCodes).toContain('TS2345');
  });

  it('§50.2: orders candidate sources strictly by canonical source hierarchy', () => {
    const sources: PrioritizedCodingSource[] = [
      {
        tier: '5_curated_code_examples',
        sourceId: 's5',
        title: 'Example Snippet',
        content: '',
        authority: 0.85,
        isCurrentRepo: false
      },
      {
        tier: '1_project_instructions_repository',
        sourceId: 's1',
        title: 'Local Repo Doc',
        content: '',
        authority: 0.90,
        isCurrentRepo: true
      },
      {
        tier: '4_high_quality_developer_qa',
        sourceId: 's4',
        title: 'StackOverflow QA',
        content: '',
        authority: 0.80,
        isCurrentRepo: false
      },
      {
        tier: '2_official_docs_compatible_version',
        sourceId: 's2',
        title: 'Official Handbook',
        content: '',
        authority: 0.95,
        isCurrentRepo: false
      }
    ];

    const prioritized = engine.prioritizeSources(sources);

    expect(prioritized[0].tier).toBe('1_project_instructions_repository');
    expect(prioritized[1].tier).toBe('2_official_docs_compatible_version');
    expect(prioritized[2].tier).toBe('4_high_quality_developer_qa');
    expect(prioritized[3].tier).toBe('5_curated_code_examples');
  });

  it('§50.3: sanitizes private paths and secrets in error query expansion', () => {
    const rawError = 'Error at C:\\Users\\Doc\\secret_project\\src\\index.ts:42 with token ghp_123456789012345678901234567890123456 failed with TS2304';
    const expansion = engine.expandErrorQuery({
      rawErrorText: rawError,
      errorCode: 'TS2304',
      language: 'TypeScript'
    });

    expect(expansion.onlineSafe).toBe(true);
    expect(expansion.sanitizedErrorText).not.toContain('C:\\Users\\Doc');
    expect(expansion.sanitizedErrorText).toContain('<REDACTED_LOCAL_PATH>');
    expect(expansion.sanitizedErrorText).not.toContain('ghp_');
    expect(expansion.sanitizedErrorText).toContain('<REDACTED_SECRET>');
    expect(expansion.redactedPaths.length).toBeGreaterThan(0);
    expect(expansion.redactedSecrets.length).toBeGreaterThan(0);
  });

  it('§50.4: validates code adaptation against local styles and types', () => {
    const code = 'const result: MyLocalInterface = { id: "123" };';
    const evalResult = engine.validateCodeAdaptation(code, {
      projectStyle: ['no-var'],
      targetAPIVersions: ['18.2'],
      localTypesOrInterfaces: ['MyLocalInterface'],
      testRequirements: [],
      userRequirements: []
    });

    expect(evalResult.adapted).toBe(true);
    expect(evalResult.adheresToProjectStyle).toBe(true);
    expect(evalResult.satisfiesLocalTypes).toBe(true);
  });

  it('§50.5: reports unavailable verification checks honestly', () => {
    const fullPlan = engine.generateVerificationPlan({
      hasTypecheck: true,
      hasLint: true,
      hasTests: true,
      hasNativeChecks: true
    });
    expect(fullPlan.honestReport).toContain('All standard verification checks are configured and available.');

    const partialPlan = engine.generateVerificationPlan({
      hasTypecheck: true,
      hasLint: false,
      hasTests: false,
      hasNativeChecks: true
    });
    expect(partialPlan.lint.status).toBe('unavailable');
    expect(partialPlan.focusedTests.status).toBe('unavailable');
    expect(partialPlan.honestReport).toContain('Honest verification report: The following checks are unavailable in the current environment: lint, tests.');
  });
});
