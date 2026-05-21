import { validateLocalToolArgs } from './LocalToolPolicy';

describe('validateLocalToolArgs', () => {
  it('allows known safe Aseprite flags', () => {
    const result = validateLocalToolArgs('aseprite', [
      '-b',
      'assets/hero.aseprite',
      '--sheet',
      'out/hero.png',
      '--data',
      'out/hero.json'
    ]);

    expect(result.allowed).toBe(true);
  });

  it('rejects unknown Aseprite flags', () => {
    const result = validateLocalToolArgs('aseprite', ['-b', '--dangerous-flag']);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
  });

  it('does not block tools without a specific policy yet', () => {
    const result = validateLocalToolArgs('custom-tool', ['--anything']);

    expect(result.allowed).toBe(true);
  });
});
