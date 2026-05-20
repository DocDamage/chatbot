import { TimeRangeParser } from './TimeRangeParser';

describe('TimeRangeParser', () => {
  it('parses decades, BCE years, and BCE millennia without fake exactness', () => {
    const parser = new TimeRangeParser();

    expect(parser.parse('1920s')).toMatchObject({
      startYear: 1920,
      endYear: 1929,
      precision: 'decade',
      confidence: 0.95
    });

    expect(parser.parse('20000 BC')).toMatchObject({
      startYear: -20000,
      precision: 'approximate',
      calendar: 'approximate'
    });

    expect(parser.parse('4th millennium BC')).toMatchObject({
      startYear: -4000,
      endYear: -3001,
      precision: 'millennium'
    });
  });
});
