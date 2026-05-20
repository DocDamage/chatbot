import { HumanLanguageRouter } from '../HumanLanguageRouter';

describe('Music slang routing', () => {
  const router = new HumanLanguageRouter();

  it.each([
    ['the vocals ain’t sitting right', 'mix.vocal_balance'],
    ['make it less boxy', 'mix.low_mid_mud'],
    ['make it sound expensive', 'mix.low_mid_mud'],
    ['make it bounce more', 'beat.groove'],
    ['cook up a beat for me', 'beat.create']
  ])('routes "%s"', (message, intent) => {
    const result = router.route({ message });

    expect(result.domain).toBe('music');
    expect(result.intent).toBe(intent);
  });
});
