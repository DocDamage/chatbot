import { describe, it, expect } from '@jest/globals';
import {
  knowledgePackSchema,
  INITIAL_KNOWLEDGE_PACKS,
} from './knowledge-packs';

describe('Knowledge Pack Schemas (CRK-P06-T02)', () => {
  it('validates all 8 canonical knowledge packs', () => {
    expect(INITIAL_KNOWLEDGE_PACKS).toHaveLength(8);

    const packIds = INITIAL_KNOWLEDGE_PACKS.map(p => p.id);
    expect(packIds).toContain('core-official-docs');
    expect(packIds).toContain('developer-qa');
    expect(packIds).toContain('curated-code');
    expect(packIds).toContain('general-knowledge');
    expect(packIds).toContain('research');
    expect(packIds).toContain('math');
    expect(packIds).toContain('educational-web');
    expect(packIds).toContain('multilingual');

    for (const pack of INITIAL_KNOWLEDGE_PACKS) {
      const parsed = knowledgePackSchema.safeParse(pack);
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects invalid pack with illegal characters in ID', () => {
    const invalidPack = {
      id: 'My Pack 123!',
      name: 'Invalid Pack',
      category: 'coding' as const,
      datasetIds: [],
    };

    const parsed = knowledgePackSchema.safeParse(invalidPack);
    expect(parsed.success).toBe(false);
  });
});
