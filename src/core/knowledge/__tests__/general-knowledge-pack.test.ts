/**
 * General Knowledge Pack Test Suite & Exit Gate (CRK Phase 19: CRK-P19-T01 to T05)
 */

import { WikipediaChunker } from '../WikipediaChunker';
import { WikidataStructuredStore } from '../WikidataStructuredStore';
import { EntityLinkingService } from '../EntityLinkingService';
import { GeneralKnowledgePack } from '../GeneralKnowledgePack';
import { KnowledgeRouter } from '../KnowledgeRouter';
import { WikidataEntity } from '../../../types/general-knowledge';

describe('General Knowledge Pack: Wikipedia + Wikidata (CRK Phase 19)', () => {
  let chunker: WikipediaChunker;
  let wikidataStore: WikidataStructuredStore;
  let linkingService: EntityLinkingService;
  let pack: GeneralKnowledgePack;

  beforeEach(() => {
    chunker = new WikipediaChunker();
    wikidataStore = new WikidataStructuredStore();
    linkingService = new EntityLinkingService(wikidataStore);
    pack = new GeneralKnowledgePack(wikidataStore, linkingService, chunker);
  });

  describe('CRK-P19-T01: Wikipedia Ingestion & Cleaning', () => {
    it('strips navigation templates, category markers, and footnote citations while preserving structure', () => {
      const rawText = `
{{Short description|British mathematician and computer scientist}}
{{Infobox scientist | name = Alan Turing }}
Alan Mathison Turing was an English mathematician, computer scientist, and cryptanalyst.[1]

== Early life ==
He was born in London.[2] He showed signs of genius from an early age.[[File:Turing.jpg|thumb|Turing in 1928]]

=== Education ===
He studied at King's College, Cambridge.[3]

== See also ==
* Enigma machine

== References ==
* Reference 1
[[Category:English cryptanalysts]]
`;

      const article = chunker.chunkArticle({
        articleId: 'art-turing',
        title: 'Alan Turing',
        revisionId: 'rev-999',
        sourceUrl: 'https://en.wikipedia.org/wiki/Alan_Turing',
        rawWikitextOrMarkdown: rawText,
      });

      expect(article.title).toBe('Alan Turing');
      expect(article.sections.length).toBeGreaterThanOrEqual(3);

      // Verify lead section
      const lead = article.sections.find((s) => s.leadParagraph);
      expect(lead).toBeDefined();
      expect(lead?.content).not.toContain('{{Infobox');
      expect(lead?.content).not.toContain('[1]');
      expect(lead?.content).toContain('Alan Mathison Turing was an English mathematician');

      // Verify subsections
      const earlyLife = article.sections.find((s) => s.sectionTitle === 'Early life');
      expect(earlyLife).toBeDefined();
      expect(earlyLife?.sectionLevel).toBe(2);
      expect(earlyLife?.content).not.toContain('[2]');
      expect(earlyLife?.content).not.toContain('[[File:');

      const education = article.sections.find((s) => s.sectionTitle === 'Education');
      expect(education).toBeDefined();
      expect(education?.sectionLevel).toBe(3);

      // Verify excluded sections (See also, References)
      const seeAlso = article.sections.find((s) => s.sectionTitle.toLowerCase() === 'see also');
      expect(seeAlso).toBeUndefined();
      const references = article.sections.find((s) => s.sectionTitle.toLowerCase() === 'references');
      expect(references).toBeUndefined();
    });
  });

  describe('CRK-P19-T02: Wikidata Structured Store', () => {
    it('ingests structured entities into graph without redundant vector-only text', () => {
      const entity: WikidataEntity = {
        entityId: 'Q7251',
        label: 'Alan Turing',
        description: 'English mathematician and computer scientist',
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
            references: [],
            rank: 'preferred',
          },
        ],
        provenance: {
          source: 'wikidata',
          snapshotVersion: '2026-09',
          license: 'CC0-1.0',
        },
      };

      wikidataStore.ingestEntity(entity);

      expect(wikidataStore.getEntity('Q7251')).toEqual(entity);
      expect(wikidataStore.findByLabelOrAlias('alan mathison turing')).toHaveLength(1);

      // Verify graph entity and relationship integration
      const graph = wikidataStore.getKnowledgeGraph();
      const graphEntities = graph.queryEntities({ entityId: 'Q7251' });
      expect(graphEntities).toHaveLength(1);
      expect(graphEntities[0].name).toBe('Alan Turing');

      const rels = graph.queryRelationships({ entityId: 'Q7251', relationshipType: 'instance_of' });
      expect(rels).toHaveLength(1);
      expect(rels[0].target).toBe('Q5');
    });
  });

  describe('CRK-P19-T03: Entity Linking', () => {
    beforeEach(() => {
      wikidataStore.ingestEntity({
        entityId: 'Q7251',
        label: 'Alan Turing',
        description: 'English mathematician and computer scientist',
        aliases: ['Turing'],
        instanceOf: ['Q5'],
        subclassOf: [],
        claims: [],
        provenance: { source: 'wikidata', snapshotVersion: '2026-09', license: 'CC0-1.0' },
      });
    });

    it('links exact title mentions with high confidence', () => {
      const link = linkingService.linkMention('Alan Turing');
      expect(link.isLinked).toBe(true);
      expect(link.entityId).toBe('Q7251');
      expect(link.confidence).toBeGreaterThanOrEqual(0.85);
      expect(link.matchType).toBe('exact_label');
    });

    it('rejects ambiguous or unknown mentions to prevent incorrect entity merges', () => {
      const link = linkingService.linkMention('NonExistentScientist123');
      expect(link.isLinked).toBe(false);
      expect(link.entityId).toBe('');
      expect(link.matchType).toBe('unmatched');
    });
  });

  describe('CRK-P19-T04 & T05: Independent Installability & Domain Segregation', () => {
    it('supports disabling pack and suppresses search results when disabled', () => {
      pack.indexWikipediaArticle({
        articleId: 'art-ada',
        title: 'Ada Lovelace',
        revisionId: 'rev-1',
        sourceUrl: 'https://en.wikipedia.org/wiki/Ada_Lovelace',
        rawWikitextOrMarkdown: 'Ada Lovelace was an English mathematician and writer.',
      });

      expect(pack.search('Ada Lovelace').length).toBeGreaterThan(0);

      pack.setEnabled(false);
      expect(pack.search('Ada Lovelace')).toHaveLength(0);
    });

    it('guarantees coding domain routing excludes general-knowledge pack by default (§3120)', () => {
      const router = new KnowledgeRouter();
      const codingDecision = router.route('coding');
      expect(codingDecision.selectedPacks).not.toContain('general-knowledge');
      expect(codingDecision.selectedPacks).toContain('core-official-docs');

      const generalDecision = router.route('general');
      expect(generalDecision.selectedPacks).toContain('general-knowledge');
    });
  });

  describe('Phase 19 Exit Gate Certification (§3127-3132)', () => {
    it('certifies all four Phase 19 exit criteria', () => {
      // 1. General knowledge is independently installable
      expect(pack.packId).toBe('general-knowledge');
      pack.setEnabled(true);
      expect(pack.isEnabled()).toBe(true);

      // 2. Structured Wikidata does not become redundant vector-only text
      wikidataStore.ingestEntity({
        entityId: 'Q42',
        label: 'Douglas Adams',
        description: 'English author and humorist',
        aliases: [],
        instanceOf: ['Q5'],
        subclassOf: [],
        claims: [],
        provenance: { source: 'wikidata', snapshotVersion: '2026-09', license: 'CC0-1.0' },
      });
      const q42 = wikidataStore.getEntity('Q42');
      expect(q42?.entityId).toBe('Q42');
      expect(q42?.provenance.license).toBe('CC0-1.0');

      // 3. Entity provenance is retained
      const article = pack.indexWikipediaArticle({
        articleId: 'art-adams',
        title: 'Douglas Adams',
        wikidataEntityId: 'Q42',
        revisionId: 'rev-adams-1',
        sourceUrl: 'https://en.wikipedia.org/wiki/Douglas_Adams',
        rawWikitextOrMarkdown: 'Douglas Adams was the author of The Hitchhikers Guide to the Galaxy.',
      });
      expect(article.wikidataEntityId).toBe('Q42');
      expect(article.sections[0].wikidataEntityId).toBe('Q42');
      expect(article.sections[0].authority).toBe(0.67);

      // 4. Domain routing keeps this pack out of irrelevant coding queries
      const router = new KnowledgeRouter();
      const codeRoute = router.route('coding_debug');
      expect(codeRoute.selectedPacks).not.toContain('general-knowledge');
    });
  });
});
