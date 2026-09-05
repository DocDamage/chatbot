import {
  educationalDocumentSchema,
  multilingualDocumentSchema,
  embeddingCompatibilitySchema,
} from './educational-multilingual';

describe('educational-multilingual schemas', () => {
  it('validates a correct educational document', () => {
    const doc = {
      id: 'edu-doc-1',
      title: 'Introduction to Algorithms',
      content: 'An algorithm is a finite sequence of well-defined instructions...',
      topic: 'software',
      language: 'en',
      qualityScore: {
        score: 0.88,
        educationalValue: 0.9,
        clarity: 0.85,
        structureScore: 0.9,
      },
      extractedDate: new Date().toISOString(),
      contentHash: 'hash123456',
    };
    const parsed = educationalDocumentSchema.parse(doc);
    expect(parsed.id).toBe('edu-doc-1');
    expect(parsed.topic).toBe('software');
  });

  it('validates multilingual document and embedding compatibility', () => {
    const multiDoc = {
      id: 'multi-fr-1',
      language: 'fr',
      title: 'Introduction aux algorithmes',
      content: 'Un algorithme est une suite finie et non ambigue d instructions...',
      domain: 'computer_science',
      nativeGlossaryTerms: ['algorithme', 'structure de donnees'],
    };
    const parsedMulti = multilingualDocumentSchema.parse(multiDoc);
    expect(parsedMulti.language).toBe('fr');

    const compat = {
      packId: 'multilingual-fr',
      language: 'fr',
      modelName: 'text-embedding-3-large',
      dimension: 3072,
      modelVersion: 'v1',
      isMultilingual: true,
      migrationRequired: false,
    };
    const parsedCompat = embeddingCompatibilitySchema.parse(compat);
    expect(parsedCompat.isMultilingual).toBe(true);
  });
});
