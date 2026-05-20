import { ChronoKnowledgeEngine } from '../../chrono/ChronoKnowledgeEngine';
import { ScienceIntentClassifier } from './ScienceIntentClassifier';
import { InventionTimelineBuilder } from './InventionTimelineBuilder';
import { DiscoveryGraph } from './DiscoveryGraph';
import { PatentRetriever } from './PatentRetriever';
import { ScientificPaperRetriever } from './ScientificPaperRetriever';
import { TheoryEvolutionAnalyzer } from './TheoryEvolutionAnalyzer';
import { ScientificConsensusTool } from '../../tools/science/ScientificConsensusTool';

export class ScienceInventionGeniusAgent {
  private classifier = new ScienceIntentClassifier();
  private timelineBuilder = new InventionTimelineBuilder();
  private graph = new DiscoveryGraph();
  private patentsRetriever = new PatentRetriever();
  private papersRetriever = new ScientificPaperRetriever();
  private theory = new TheoryEvolutionAnalyzer();
  private consensus = new ScientificConsensusTool();

  constructor(private readonly chrono = new ChronoKnowledgeEngine()) {}

  async ask(query: string) {
    const base = await this.chrono.ask({ query, domain: 'science', includeTimeline: true });
    const discoveryGraph = this.graph.graph(query);
    return {
      answerType: this.classifier.classify(query).kind,
      conceptOrInvention: query,
      approximateDate: base.date,
      inventorDiscovererOrCulture: 'Resolve through Wikidata, scholarly sources, patents, and archaeology; avoid single-inventor claims when evidence is collective.',
      predecessors: discoveryGraph.nodes,
      scientificPrinciple: 'Explain principle only after source-backed context is retrieved.',
      impact: base.answer,
      openDisputes: base.disputedPoints,
      sources: base.sources,
      response: `What it is\n${query}\nWhen/where\n${JSON.stringify(base.date)}\nPredecessors\n${discoveryGraph.nodes.join(', ')}\nWho contributed\nMultiple contributors/cultures may be involved.\nImpact\n${base.answer}\nUncertainty/disputes\n${base.disputedPoints.join('; ')}\nSources\n${base.sources.map(s => s.title).join(', ')}`
    };
  }

  async invention(query: string) {
    return this.ask(query);
  }

  async timeline(query: string) {
    return { answerType: 'scientific_timeline', timeline: await this.timelineBuilder.build(query) };
  }

  async papers(query: string) {
    return { answerType: 'paper_lookup', source: 'OpenAlex', result: await this.papersRetriever.search(query) };
  }

  async patents(query: string) {
    return { answerType: 'patent_lookup', result: await this.patentsRetriever.search(query) };
  }

  async consensusCheck(query: string) {
    return { answerType: 'consensus', consensus: this.consensus.assess(query), theory: this.theory.analyze(query) };
  }
}
