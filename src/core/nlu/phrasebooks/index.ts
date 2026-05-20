import { Phrasebook } from '../DomainPhrasebook';
import { businessPhrasebook } from './business.phrasebook';
import { chronoPhrasebook } from './chrono.phrasebook';
import { codingPhrasebook } from './coding.phrasebook';
import { engineeringPhrasebook } from './engineering.phrasebook';
import { gamedevPhrasebook } from './gamedev.phrasebook';
import { generalPhrasebook } from './general.phrasebook';
import { geographyPhrasebook } from './geography.phrasebook';
import { healthPhrasebook } from './health.phrasebook';
import { languagePhrasebook } from './language.phrasebook';
import { legalPhrasebook } from './legal.phrasebook';
import { marketPhrasebook } from './market.phrasebook';
import { mathPhrasebook } from './math.phrasebook';
import { musicPhrasebook } from './music.phrasebook';
import { philosophyPhrasebook } from './philosophy.phrasebook';
import { securityPhrasebook } from './security.phrasebook';
import { storyPhrasebook } from './story.phrasebook';

export const allPhrasebooks: Phrasebook = [
  ...musicPhrasebook,
  ...codingPhrasebook,
  ...marketPhrasebook,
  ...gamedevPhrasebook,
  ...mathPhrasebook,
  ...storyPhrasebook,
  ...legalPhrasebook,
  ...healthPhrasebook,
  ...securityPhrasebook,
  ...businessPhrasebook,
  ...philosophyPhrasebook,
  ...languagePhrasebook,
  ...geographyPhrasebook,
  ...engineeringPhrasebook,
  ...chronoPhrasebook,
  ...generalPhrasebook
];
