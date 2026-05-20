import { ChronoKnowledgeEngine } from '../../chrono/ChronoKnowledgeEngine';
import { HistoryIntentClassifier } from './HistoryIntentClassifier';
import { HistoricalTimelineBuilder } from './HistoricalTimelineBuilder';
import { CivilizationGraph } from './CivilizationGraph';
import { EventCausalityAnalyzer } from './EventCausalityAnalyzer';
import { PrimarySourceRetriever } from './PrimarySourceRetriever';

export class HistoryGeniusAgent {
  private classifier = new HistoryIntentClassifier();
  private timelineBuilder = new HistoricalTimelineBuilder();
  private civilizationGraph = new CivilizationGraph();
  private causality = new EventCausalityAnalyzer();
  private primary = new PrimarySourceRetriever();

  constructor(private readonly chrono = new ChronoKnowledgeEngine()) {}

  async ask(query: string) {
    const base = await this.chrono.ask({ query, domain: 'history', includeTimeline: true });
    return {
      answerType: this.classifier.classify(query).kind,
      periodAndPlace: base.date,
      timeline: base.timeline,
      mainActors: this.civilizationGraph.describe(query).nodes,
      causes: this.causality.analyze(query).causes,
      consequences: this.causality.analyze(query).consequences,
      evidenceQuality: base.evidenceQuality,
      disputes: base.disputedPoints,
      sources: base.sources,
      response: `Period and place\n${JSON.stringify(base.date)}\nTimeline\n${JSON.stringify(base.timeline)}\nMain actors\n${this.civilizationGraph.describe(query).nodes.join(', ')}\nEvidence quality\n${base.evidenceQuality}\nDisputes\n${base.disputedPoints.join('; ')}\nSources\n${base.sources.map(s => s.title).join(', ')}\n${base.answer}`
    };
  }

  async timeline(query: string) {
    return { answerType: 'timeline', timeline: await this.timelineBuilder.build(query) };
  }

  async compare(query: string) {
    return { answerType: 'compare_civilizations', graph: this.civilizationGraph.describe(query), caveat: 'Avoid flattening cultures into single-cause comparisons.' };
  }

  async primarySources(query: string) {
    return { answerType: 'primary_sources', ...this.primary.retrieve(query) };
  }
}
