export interface CountryProfileInput {
  query?: string;
}

const countryProfiles: Record<string, Record<string, unknown>> = {
  japan: {
    capital: 'Tokyo',
    region: 'East Asia',
    government: 'constitutional monarchy with parliamentary government',
    notes: ['Island country in the northwest Pacific', 'Major urban corridor includes Tokyo, Nagoya, Osaka, and Kyoto']
  },
  brazil: {
    capital: 'Brasilia',
    region: 'South America',
    government: 'federal presidential republic',
    notes: ['Largest country in South America by area and population', 'Contains a large share of the Amazon basin']
  },
  nigeria: {
    capital: 'Abuja',
    region: 'West Africa',
    government: 'federal presidential republic',
    notes: ['Africa\'s most populous country', 'Major cultural and economic centers include Lagos, Kano, and Port Harcourt']
  },
  france: {
    capital: 'Paris',
    region: 'Western Europe',
    government: 'unitary semi-presidential republic',
    notes: ['Metropolitan France borders the Atlantic, English Channel, North Sea, Mediterranean, and several European countries']
  },
  india: {
    capital: 'New Delhi',
    region: 'South Asia',
    government: 'federal parliamentary republic',
    notes: ['Very large linguistic, religious, and regional diversity', 'Major urban centers include Delhi, Mumbai, Bengaluru, Kolkata, and Chennai']
  },
  'united states': {
    capital: 'Washington, DC',
    region: 'North America',
    government: 'federal presidential constitutional republic',
    notes: ['Federal system with significant state-level variation', 'Includes states, territories, and many regional cultures']
  }
};

export class CountryProfileTool {
  run(input: CountryProfileInput = {}) {
    const query = input.query || '';
    const country = this.detectCountry(query);
    const profile = country ? countryProfiles[country] : undefined;

    return {
      domain: 'geography',
      tool: 'CountryProfileTool',
      country: country || 'unknown',
      profile: profile || {
        note: 'No deterministic country profile matched. Use local KB or a current atlas/source for exact facts.'
      },
      caveats: [
        'Countries are not culturally uniform.',
        'Laws, politics, borders, and demographic statistics can change and should be date-checked.'
      ]
    };
  }

  private detectCountry(query: string): string | undefined {
    const text = query.toLowerCase();
    return Object.keys(countryProfiles).find(country => text.includes(country)) ||
      (/\busa|u\.s\.|america\b/i.test(query) ? 'united states' : undefined);
  }
}
