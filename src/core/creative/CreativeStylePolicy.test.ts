import { CreativeStylePolicy } from './CreativeStylePolicy';

describe('CreativeStylePolicy', () => {
  it('transforms protected-world type requests into copyright-safe descriptors', () => {
    const result = CreativeStylePolicy.evaluate('Write a Lord of the Rings type fantasy scene about a ruined crown.');

    expect(result.allowed).toBe(true);
    expect(result.safeStyle).toContain('mythic secondary-world epic fantasy');
    expect(result.notes).toEqual(expect.arrayContaining([
      expect.stringContaining('Do not use protected characters, places, or lore'),
    ]));
  });

  it('blocks direct protected-world continuation requests', () => {
    const result = CreativeStylePolicy.evaluate('Continue Lord of the Rings with Frodo returning to Mordor.');

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('protected world');
    expect(result.safeAlternative).toContain('original mythic secondary-world quest');
  });

  it('blocks exact living-author imitation while offering a generic style substitute', () => {
    const result = CreativeStylePolicy.evaluate('Write this exactly in Stephen King style.');

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('living author');
    expect(result.safeAlternative).toContain('small-town supernatural psychological horror');
  });
});
