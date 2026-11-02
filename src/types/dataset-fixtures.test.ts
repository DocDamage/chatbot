import {
  DatasetFixtureCategorySchema
} from './dataset-fixtures';

describe('dataset-fixtures types (§49)', () => {
  it('validates all 10 canonical dataset fixture categories', () => {
    const categories = [
      'official_docs',
      'qa',
      'code',
      'encyclopedia',
      'research',
      'math',
      'prompt_injection',
      'duplicate_data',
      'outdated_version',
      'conflicting_sources'
    ];

    expect(categories.length).toBe(10);
    for (const cat of categories) {
      expect(DatasetFixtureCategorySchema.safeParse(cat).success).toBe(true);
    }
    expect(DatasetFixtureCategorySchema.safeParse('invalid_cat').success).toBe(false);
  });
});
