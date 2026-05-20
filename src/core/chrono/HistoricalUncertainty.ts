import { ChronoDate } from './ChronoDate';

export class HistoricalUncertainty {
  describe(date?: ChronoDate): string | undefined {
    if (!date) return undefined;
    if (date.startYear < -3000 || date.calendar === 'approximate' || date.precision === 'approximate') {
      return 'Dates are approximate and based on archaeological interpretation.';
    }
    if (date.confidence < 0.7) return 'Date confidence is limited; interpretations may vary by source.';
    return undefined;
  }
}
