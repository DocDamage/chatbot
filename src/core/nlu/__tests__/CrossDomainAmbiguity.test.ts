import { HumanLanguageRouter } from '../HumanLanguageRouter';

describe('Cross-domain ambiguity', () => {
  const router = new HumanLanguageRouter();

  it('keeps bare logic low confidence for clarification by legacy/general path', () => {
    const result = router.route({ message: 'logic' });

    expect(result.confidence).toBe(0);
    expect(result.route).toBeUndefined();
  });

  it('routes explicit Logic Pro wording to music tools', () => {
    const result = router.route({ message: 'build a stock Logic Pro vocal chain' });

    expect(result.route).toBe('music');
    expect(result.domain).toBe('music');
  });
});
