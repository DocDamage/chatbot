import { HumanLanguageRouter } from '../HumanLanguageRouter';

describe('HumanLanguageRouter', () => {
  const router = new HumanLanguageRouter();

  it('routes casual music low-end slang to Mix Genius intent', () => {
    const result = router.route({ message: 'make the 808 slap but stop it from eating the kick' });

    expect(result.route).toBe('mix_master');
    expect(result.domain).toBe('music');
    expect(result.intent).toBe('mix.low_end_masking');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.slots.target).toBe('808');
    expect(result.slots.secondaryTarget).toBe('kick');
  });

  it('normalizes typos before routing', () => {
    const result = router.route({ message: 'flstuduo mix sound muddy fr' });

    expect(result.aliasesDetected).toContain('flstuduo');
    expect(result.route).toBe('mix_master');
    expect(result.normalizedQuery).toContain('low-mid');
  });

  it('routes casual coding debugging language', () => {
    const result = router.route({ message: 'this thing is buggin, find where it broke' });

    expect(result.domain).toBe('coding');
    expect(result.intent).toBe('debug_error');
  });

  it('routes casual market risk language', () => {
    const result = router.route({ message: 'is NVDA cooked or still got juice?' });

    expect(result.domain).toBe('market');
    expect(result.intent).toBe('market_risk');
  });

  it('routes casual story revision language', () => {
    const result = router.route({ message: 'make this villain less corny' });

    expect(result.domain).toBe('story');
    expect(result.intent).toBe('character.revision');
  });

  it('returns low confidence instead of forcing unrelated routes', () => {
    const result = router.route({ message: 'hello there' });

    expect(result.route).toBeUndefined();
    expect(result.confidence).toBe(0);
  });
});
