import { ChronoDate, ChronoEvent, ChronoSource } from './ChronoDate';
import { EntityGraphStore } from './EntityGraphStore';
import { HistoricalUncertainty } from './HistoricalUncertainty';
import { SourceAuthorityRanker } from './SourceAuthorityRanker';
import { TimelineBuilder } from './TimelineBuilder';
import { TimeRangeParser } from './TimeRangeParser';

export interface ChronoAskRequest {
  query: string;
  domain: 'pop_culture' | 'history' | 'science' | 'invention' | string;
  timeRange?: Partial<ChronoDate>;
  includeTimeline?: boolean;
  sourceMode?: 'strict' | 'balanced' | 'open';
}

export class ChronoKnowledgeEngine {
  readonly graph = new EntityGraphStore();
  private parser = new TimeRangeParser();
  private uncertainty = new HistoricalUncertainty();
  private timelineBuilder = new TimelineBuilder();
  private ranker = new SourceAuthorityRanker();

  constructor() {
    this.seedSources();
  }

  async ask(request: ChronoAskRequest) {
    const date = this.resolveDate(request);
    const uncertaintyNote = this.uncertainty.describe(date);
    const sources = this.rankSources(request.domain);
    const events = this.buildSeedTimeline(request.domain, request.query, date);
    const timeline = request.includeTimeline ? this.timelineBuilder.build(events) : [];
    const answer = [
      this.domainIntro(request.domain, request.query),
      uncertaintyNote,
      this.formatBody(request.domain, request.query)
    ].filter(Boolean).join('\n');

    return {
      answer,
      domain: request.domain,
      date,
      timeline,
      evidenceQuality: uncertaintyNote ? 'archaeological / approximate; confidence varies by source' : 'ranked by source authority, metadata quality, and date precision',
      disputedPoints: this.disputedPoints(request.domain, request.query),
      sources
    };
  }

  private resolveDate(request: ChronoAskRequest): ChronoDate {
    if (request.timeRange?.startYear !== undefined) {
      return {
        startYear: request.timeRange.startYear,
        endYear: request.timeRange.endYear,
        precision: request.timeRange.precision || 'range',
        calendar: request.timeRange.calendar || (request.timeRange.startYear < 0 ? 'approximate' : 'gregorian'),
        confidence: request.timeRange.confidence || (request.timeRange.startYear < -3000 ? 0.55 : 0.8),
        note: request.timeRange.note
      };
    }
    return this.parser.parse(request.query);
  }

  private seedSources() {
    const sources: ChronoSource[] = [
      { id: 'wikidata', title: 'Wikidata entity graph', authority: 'reference', sourceType: 'structured', license: 'CC0', confidence: 0.82 },
      { id: 'wikimedia', title: 'Wikimedia dump text context', authority: 'reference', sourceType: 'text', confidence: 0.68 },
      { id: 'loc', title: 'Library of Congress APIs', authority: 'institutional', sourceType: 'institutional', confidence: 0.9 },
      { id: 'openalex', title: 'OpenAlex Works', authority: 'academic', sourceType: 'scholarly', confidence: 0.88 },
      { id: 'tmdb', title: 'TMDB metadata', authority: 'metadata', sourceType: 'metadata', confidence: 0.78 }
    ];
    sources.forEach(source => this.graph.addSource(source));
  }

  private rankSources(domain: string) {
    const sourceIds = domain === 'science' || domain === 'invention'
      ? ['openalex', 'wikidata']
      : domain === 'history'
        ? ['loc', 'wikidata', 'wikimedia']
        : ['tmdb', 'wikidata', 'wikimedia'];
    return this.ranker.rank(sourceIds.map(id => this.graph.sources.get(id)).filter(Boolean) as ChronoSource[], Number(new Date().getFullYear()) > 1990);
  }

  private buildSeedTimeline(domain: string, query: string, date: ChronoDate): ChronoEvent[] {
    const name = domain === 'science' || domain === 'invention'
      ? 'Technology diffusion and predecessor evidence'
      : domain === 'history'
        ? 'Material evidence and interpretive chronology'
        : 'Release, influence, and reception timeline';
    return [{
      id: 'seed-event',
      name,
      date,
      domain: domain === 'invention' ? 'science' : domain as any,
      entityIds: [],
      description: `Timeline anchor for: ${query}`,
      sourceIds: this.rankSources(domain).map(source => source.id)
    }];
  }

  private domainIntro(domain: string, query: string) {
    if (domain === 'pop_culture') return `Pop culture context for "${query}" separates release metadata from subjective canon or rankings.`;
    if (domain === 'history') return `Historical context for "${query}" separates primary sources, secondary interpretation, and reference summaries.`;
    return `Science and invention context for "${query}" separates invention, discovery, popularization, commercialization, and prior art.`;
  }

  private formatBody(domain: string, query: string) {
    if (domain === 'history' && /20000|prehistory|prehistoric/i.test(query)) {
      return 'Evidence usually comes from archaeology, radiocarbon dating, stratigraphy, material culture, genetic evidence, environmental proxies, and comparative interpretation rather than written records.';
    }
    if ((domain === 'science' || domain === 'invention') && /wheel/i.test(query)) {
      return 'Assigning a single inventor is misleading because evidence is archaeological, approximate, and points to multiple cultures and predecessor technologies.';
    }
    return 'Use the domain specialist for a stricter answer format with timeline, actors, source confidence, disputed points, and ranked sources.';
  }

  private disputedPoints(domain: string, query: string) {
    if ((domain === 'science' || domain === 'invention') && /wheel/i.test(query)) return ['Single-inventor claims are not supported by the evidence.'];
    if (domain === 'pop_culture') return ['Rankings and canon claims are subjective unless tied to explicit criteria.'];
    return ['Dates and causality can vary by chronology, archaeological interpretation, or historiography.'];
  }
}
