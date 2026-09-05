import {
  CanonicalModuleCategorySchema,
  CANONICAL_MODULE_RULES,
} from './file-map';

describe('Canonical File Map Types & Rules', () => {
  it('validates canonical module categories schema', () => {
    const validCategories = [
      'chat',
      'conversation',
      'workflows',
      'knowledge',
      'providers',
      'feedback',
      'evals',
      'governance',
      'migration',
      'observability',
      'types',
      'client',
      'docs',
    ];
    for (const cat of validCategories) {
      expect(CanonicalModuleCategorySchema.safeParse(cat).success).toBe(true);
    }
    expect(CanonicalModuleCategorySchema.safeParse('invalid_module').success).toBe(false);
  });

  it('verifies all categories have configured rules with line ceilings', () => {
    for (const [key, rule] of Object.entries(CANONICAL_MODULE_RULES)) {
      expect(rule.category).toBe(key);
      expect(rule.baseDirectory.length).toBeGreaterThan(0);
      expect(rule.maxFileLines).toBeGreaterThanOrEqual(300);
    }
  });

  it('verifies types category strictly forbids importing from core or server', () => {
    const typesRule = CANONICAL_MODULE_RULES.types;
    expect(typesRule.forbiddenImports).toContain('../core');
    expect(typesRule.forbiddenImports).toContain('../server');
  });
});
