import { ChronoEvent } from './ChronoDate';

export class TimelineBuilder {
  build(events: ChronoEvent[]) {
    return [...events].sort((a, b) => a.date.startYear - b.date.startYear).map(event => ({
      year: event.date.endYear ? `${event.date.startYear} to ${event.date.endYear}` : String(event.date.startYear),
      precision: event.date.precision,
      confidence: event.date.confidence,
      event: event.name,
      description: event.description,
      sources: event.sourceIds
    }));
  }
}
