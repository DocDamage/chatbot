import { ChronoKnowledgeEngine } from '../../chrono/ChronoKnowledgeEngine';
export class HistoricalTimelineBuilder {
  constructor(private readonly chrono = new ChronoKnowledgeEngine()) {}
  async build(query: string) {
    return (await this.chrono.ask({ query, domain: 'history', includeTimeline: true })).timeline;
  }
}
