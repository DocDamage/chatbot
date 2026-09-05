/**
 * General Knowledge Types & Schema Tests (CRK Phase 19)
 */

import {
  wikipediaArticleSchema,
  wikipediaSectionChunkSchema,
  wikidataEntitySchema,
  entityLinkResultSchema,
  generalKnowledgeSnapshotSchema,
  WikipediaArticle,
  WikidataEntity,
} from './general-knowledge';

describe('General Knowledge Types & Schemas', () => {
  it('validates WikipediaSectionChunk and WikipediaArticle schemas', () => {
    const section = {
      chunkId: 'wiki-sec-101',
      articleId: 'wiki-art-42',
      articleTitle: 'Alan Turing',
      canonicalTitle: 'Alan_Turing',
      sectionTitle: 'Early life and education',
      sectionAnchor: 'Early_life_and_education',
      sectionLevel: 2,
      leadParagraph: false,
      content: 'Turing was born in Maida Vale, London on 23 June 1912.',
      wordCount: 11,
      language: 'en',
      sourceUrl: 'https://en.wikipedia.org/wiki/Alan_Turing#Early_life_and_education',
      revisionId: '1209384756',
      wikidataEntityId: 'Q7251',
      authority: 0.67,
      extractedAt: '2026-09-04T00:00:00Z',
    };

    const parsedSection = wikipediaSectionChunkSchema.parse(section);
    expect(parsedSection.chunkId).toBe('wiki-sec-101');
    expect(parsedSection.authority).toBe(0.67);

    const article: WikipediaArticle = {
      articleId: 'wiki-art-42',
      title: 'Alan Turing',
      canonicalTitle: 'Alan_Turing',
      language: 'en',
      namespace: 'main',
      revisionId: '1209384756',
      sourceUrl: 'https://en.wikipedia.org/wiki/Alan_Turing',
      wikidataEntityId: 'Q7251',
      summary: 'English mathematician, computer scientist, logician, cryptanalyst, philosopher, and theoretical biologist.',
      sections: [parsedSection],
      categories: ['English cryptanalysts', 'Fellows of the Royal Society'],
      redirects: ['Turing, Alan'],
    };

    const parsedArticle = wikipediaArticleSchema.parse(article);
    expect(parsedArticle.title).toBe('Alan Turing');
    expect(parsedArticle.sections).toHaveLength(1);
  });

  it('validates structured WikidataEntity schema and rejects non-QID format', () => {
    const entity: WikidataEntity = {
      entityId: 'Q7251',
      label: 'Alan Turing',
      description: 'English mathematician, computer scientist, logician, and cryptanalyst',
      aliases: ['Alan Mathison Turing'],
      instanceOf: ['Q5'], // human
      subclassOf: [],
      claims: [
        {
          propertyId: 'P31',
          propertyName: 'instance of',
          datatype: 'entity',
          value: 'Q5',
          valueLabel: 'human',
          references: ['https://en.wikipedia.org/wiki/Alan_Turing'],
          rank: 'preferred',
        },
        {
          propertyId: 'P569',
          propertyName: 'date of birth',
          datatype: 'time',
          value: '+1912-06-23T00:00:00Z',
          references: [],
          rank: 'normal',
        },
      ],
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Alan_Turing',
      provenance: {
        source: 'wikidata',
        snapshotVersion: '2026-09',
        license: 'CC0-1.0',
      },
    };

    const parsed = wikidataEntitySchema.parse(entity);
    expect(parsed.entityId).toBe('Q7251');
    expect(parsed.claims).toHaveLength(2);

    expect(() =>
      wikidataEntitySchema.parse({
        ...entity,
        entityId: 'INVALID_ID',
      })
    ).toThrow();
  });

  it('validates EntityLinkResult and snapshot schemas', () => {
    const linkResult = {
      textSpan: 'Alan Turing',
      entityId: 'Q7251',
      entityLabel: 'Alan Turing',
      confidence: 0.98,
      isLinked: true,
      matchType: 'exact_label' as const,
    };
    const parsedLink = entityLinkResultSchema.parse(linkResult);
    expect(parsedLink.confidence).toBe(0.98);

    const snapshot = {
      snapshotId: 'wiki-en-202609',
      version: '2026-09-01',
      dumpDate: '2026-09-01T00:00:00Z',
      articleCount: 6500000,
      entityCount: 100000000,
      license: 'CC-BY-SA-4.0 / CC0-1.0',
      checksum: 'sha256:abc123def456',
    };
    const parsedSnapshot = generalKnowledgeSnapshotSchema.parse(snapshot);
    expect(parsedSnapshot.snapshotId).toBe('wiki-en-202609');
  });
});
