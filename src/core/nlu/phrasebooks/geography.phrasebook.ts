import { Phrasebook } from '../DomainPhrasebook';

export const geographyPhrasebook: Phrasebook = [
  {
    phrases: ['what is this country like', 'culture there', 'where is this place', 'geopolitics of', 'map context'],
    intent: 'geo_context',
    meaning: 'country, culture, map, demographics, or geopolitical context',
    domain: 'geography',
    route: 'geography'
  }
];
