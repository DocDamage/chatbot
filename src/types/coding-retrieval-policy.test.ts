import {
  CodingProjectEvidenceSchema,
  CodingSourceTierSchema
} from './coding-retrieval-policy';

describe('coding-retrieval-policy types (§50)', () => {
  it('validates project evidence schema', () => {
    const parsed = CodingProjectEvidenceSchema.parse({
      language: 'TypeScript',
      framework: 'React',
      frameworkVersion: '18.2.0',
      buildSystem: 'vite',
      operatingSystem: 'windows',
      compilerOrRuntime: 'node 22',
      repositoryOrProject: 'DocDamage/chatbot',
      detectedErrorCodes: ['TS2304', 'TS2345'],
      evidenceSource: 'package_json'
    });

    expect(parsed.language).toBe('TypeScript');
    expect(parsed.evidenceSource).toBe('package_json');
    expect(parsed.detectedErrorCodes).toHaveLength(2);
  });

  it('validates all 6 canonical coding source tiers in strict order', () => {
    const expectedTiers = [
      '1_project_instructions_repository',
      '2_official_docs_compatible_version',
      '3_project_tests_diagnostics',
      '4_high_quality_developer_qa',
      '5_curated_code_examples',
      '6_broader_sources'
    ];

    for (const tier of expectedTiers) {
      expect(CodingSourceTierSchema.safeParse(tier).success).toBe(true);
    }
    expect(CodingSourceTierSchema.safeParse('unranked_source').success).toBe(false);
  });
});
