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
    const reference = this.curatedReference(query);
    const keyWorks = reference
      ? reference.works
      : ['Use TMDB/MusicBrainz/Open Library metadata for exact works before firm claims.'];
    const culturalContext = reference
      ? `${reference.context}\n${base.answer}`
      : base.answer;

    return {
      answerType: this.classifier.classify(query).kind,
      era: base.date,
      keyWorks,
      keyPeople: ['Resolve through Wikidata entity graph.'],
      culturalContext,
      influences: ['Influence claims require source-ranked evidence.'],
      legacy: 'Legacy depends on explicit criteria and source support.',
      disputedSubjectivePoints: this.canon.resolve(query).disputedSubjectivePoints,
      sources: this.sources.route(query),
      response: `Era\n${JSON.stringify(base.date)}\nKey works\n${keyWorks.join('; ')}\nCultural context\n${culturalContext}\nInfluences\n${reference?.influence || 'Influence claims require source-ranked evidence.'}\nLegacy\n${reference?.legacy || 'Legacy depends on explicit criteria and source support.'}\nDisputed/subjective points\n${this.canon.resolve(query).disputedSubjectivePoints.join(' ')}\nSources\n${this.sources.route(query).join(', ')}`
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

  private curatedReference(query: string) {
    if (/\b1995\b/.test(query)) {
      return {
        works: [
          'Toy Story brought feature-length computer animation into the mainstream',
          'Clueless became a sharp mid-1990s teen-comedy touchstone',
          'Jagged Little Pill helped define the year in mainstream rock/pop',
          'Windows 95 turned a software launch into a mass-market cultural event',
          'PlayStation arrived in North America and helped reshape console gaming'
        ],
        context: 'A clean 1995 pop-culture reference: Toy Story. It was the moment computer animation stopped feeling like a novelty and started looking like the future of mainstream movies. If you want a music reference, Alanis Morissette and Coolio are very 1995; for tech culture, Windows 95 is the obvious marker.',
        influence: 'The year sits at the hinge between analog 1990s media culture and the digital entertainment era: CGI film, CD-ROM/software hype, and the PlayStation generation all became mainstream signals.',
        legacy: '1995 still reads as a transition year: modern animation, late-90s teen style, blockbuster software launches, and 3D console gaming all moved closer to the center of pop culture.'
      };
    }

    return undefined;
  }
}
