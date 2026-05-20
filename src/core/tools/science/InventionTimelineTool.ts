import { ChronoKnowledgeEngine } from '../../chrono/ChronoKnowledgeEngine';
export class InventionTimelineTool {
  constructor(private readonly chrono = new ChronoKnowledgeEngine()) {}
  async build(query: string) {
    return (await this.chrono.ask({ query, domain: 'science', includeTimeline: true })).timeline;
  }
}
