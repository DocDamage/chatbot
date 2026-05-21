import { SECFilingParser } from './SECFilingParser';

describe('SECFilingParser', () => {
  it('creates a fallback chunk for plain text', () => {
    const parsed = new SECFilingParser().parse('Plain report text without section markers.');

    expect(parsed.sections).toHaveLength(0);
    expect(parsed.chunks.length).toBeGreaterThan(0);
    expect(parsed.chunks[0].content).toContain('Plain report text');
  });

  it('flattens one numeric fact from a facts payload', () => {
    const flattened = new SECFilingParser().normalizeCompanyFacts({
      facts: {
        'us-gaap': {
          Revenues: {
            label: 'Revenue',
            units: {
              USD: [{ val: 1000, fy: 2024, fp: 'FY', form: '10-K', accn: '0000000000-24-000001' }]
            }
          }
        }
      }
    });

    expect(flattened).toHaveLength(1);
    expect(flattened[0].concept).toBe('Revenues');
    expect(flattened[0].valueNumeric).toBe(1000);
  });
});
