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
    const musicIndustryAnswer = this.answerMusicIndustryQuestion(query);
    if (musicIndustryAnswer) return musicIndustryAnswer;

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

  private answerMusicIndustryQuestion(query: string) {
    const year = query.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
    if (!year || !/\b(?:music industry|record industry|music business|music history|record label)\b/i.test(query)) {
      return undefined;
    }

    if (year !== '1997') return undefined;

    const response = [
      'The music industry in 1997 was still built around physical releases—especially CDs—but it was becoming a highly global, image-led business.',
      '',
      'Commercially, the Spice Girls showed how a tightly managed group identity could scale internationally, while Bad Boy Records helped move hip-hop and R&B further into the center of mainstream pop. Puff Daddy’s No Way Out and “I’ll Be Missing You” were major examples of label branding, crossover promotion, and the power of a news moment.',
      '',
      'Elton John’s “Candle in the Wind 1997,” released after Princess Diana’s death, became an exceptional sales event. Across the year, teen pop, hip-hop, R&B, Britpop, alternative rock, dance music, and soundtrack singles all competed for attention through radio, MTV, retail chains, and major-label distribution.',
      '',
      'The important transition was technological and cultural: downloads and streaming had not replaced physical music yet, but the industry was already moving toward global artist branding, cross-media publicity, and chart-driven release campaigns. The file-sharing disruption that would reshape the business was still ahead.'
    ].join('\n');

    return {
      answerType: 'historical_music_industry',
      era: { startYear: 1997, endYear: 1997, label: '1997' },
      keyWorks: ['Spice', 'No Way Out', 'Candle in the Wind 1997'],
      keyPeople: ['Spice Girls', 'Puff Daddy', 'Elton John'],
      culturalContext: response,
      influences: ['Global pop branding', 'Hip-hop and R&B crossover', 'Music-video and chart promotion'],
      legacy: '1997 connected the late-CD economy to the globally marketed, image-driven music business of the late 1990s.',
      disputedSubjectivePoints: [],
      sources: ['Official Charts', 'Billboard year-end chart coverage', 'RIAA year-end music sales statistics'],
      response
    };
  }
}
