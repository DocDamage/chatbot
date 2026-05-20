import { ChronoKnowledgeEngine } from '../../chrono/ChronoKnowledgeEngine';
import { PopCultureIntentClassifier } from './PopCultureIntentClassifier';
import { PopCultureTimelineBuilder } from './PopCultureTimelineBuilder';
import { PopCultureCanonResolver } from './PopCultureCanonResolver';
import { PopCultureSourceRouter } from './PopCultureSourceRouter';
import { FranchiseKnowledgeGraph } from './FranchiseKnowledgeGraph';

export class PopCultureGeniusAgent {
  private classifier = new PopCultureIntentClassifier();
  private timelineBuilder = new PopCultureTimelineBuilder();
  private canon = new PopCultureCanonResolver();
  private sources = new PopCultureSourceRouter();
  private franchises = new FranchiseKnowledgeGraph();

  constructor(private readonly chrono = new ChronoKnowledgeEngine()) {}

  async ask(query: string) {
    const base = await this.chrono.ask({ query, domain: 'pop_culture', includeTimeline: true });
    const keyWorks = ['Use TMDB/MusicBrainz/Open Library metadata for exact works before firm claims.'];

    return {
      answerType: this.classifier.classify(query).kind,
      era: base.date,
      keyWorks,
      keyPeople: ['Resolve through Wikidata entity graph.'],
      culturalContext: base.answer,
      influences: ['Influence claims require source-ranked evidence.'],
      legacy: 'Legacy depends on explicit criteria and source support.',
      disputedSubjectivePoints: this.canon.resolve(query).disputedSubjectivePoints,
      sources: this.sources.route(query),
      response: `Era\n${JSON.stringify(base.date)}\nKey works\n${keyWorks.join('; ')}\nCultural context\n${base.answer}\nDisputed/subjective points\n${this.canon.resolve(query).disputedSubjectivePoints.join(' ')}\nSources\n${this.sources.route(query).join(', ')}`
    };
  }

  async timeline(query: string) {
    return { answerType: 'timeline', timeline: this.timelineBuilder.build(query), sources: this.sources.route(query) };
  }

  async franchise(query: string) {
    return { answerType: 'franchise_graph', graph: this.franchises.graph(query), sources: this.sources.route(query) };
  }

  async compare(query: string) {
    return { answerType: 'compare', response: 'Compare by release era, production context, genre conventions, audience, influence, and source-backed reception.', sources: this.sources.route(query) };
  }
}
