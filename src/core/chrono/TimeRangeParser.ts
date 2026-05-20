import { ChronoDate } from './ChronoDate';

export class TimeRangeParser {
  parse(input: string): ChronoDate {
    const text = input.trim().toLowerCase();

    const decade = text.match(/\b(\d{3,4})0s\b/);
    if (decade) {
      const startYear = Number(decade[1]) * 10;
      return { startYear, endYear: startYear + 9, precision: 'decade', calendar: 'gregorian', confidence: 0.95 };
    }

    const millenniumBc = text.match(/\b(\d+)(?:st|nd|rd|th)\s+millennium\s+bc\b/);
    if (millenniumBc) {
      const ordinal = Number(millenniumBc[1]);
      return {
        startYear: -ordinal * 1000,
        endYear: -((ordinal - 1) * 1000 + 1),
        precision: 'millennium',
        calendar: 'approximate',
        confidence: 0.65,
        note: 'Millennium BCE ranges are approximate and convention-dependent.'
      };
    }

    const bc = text.match(/\b(\d{1,6})\s*(bc|bce)\b/);
    if (bc) {
      const year = -Number(bc[1]);
      return {
        startYear: year,
        precision: Math.abs(year) > 3000 ? 'approximate' : 'year',
        calendar: Math.abs(year) > 3000 ? 'approximate' : 'bce_ce',
        confidence: Math.abs(year) > 3000 ? 0.55 : 0.75,
        note: Math.abs(year) > 3000 ? 'Prehistoric dates are approximate archaeological estimates.' : undefined
      };
    }

    const range = text.match(/(-?\d{1,6})\s*(?:to|-)\s*(-?\d{1,6})/);
    if (range) {
      return { startYear: Number(range[1]), endYear: Number(range[2]), precision: 'range', calendar: 'bce_ce', confidence: 0.8 };
    }

    const year = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    if (year) {
      return { startYear: Number(year[1]), precision: 'year', calendar: 'gregorian', confidence: 0.9 };
    }

    return { startYear: 0, precision: 'unknown', calendar: 'approximate', confidence: 0.2, note: 'No reliable date expression found.' };
  }
}
