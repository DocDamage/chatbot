export class MusicCopyrightGuardrails {
  check(input: string) {
    const text = input.toLowerCase();
    const risks = [
      /\b(exactly like|sound exactly like|clone|impersonate)\b/.test(text) ? 'artist_cloning' : undefined,
      /\b(continue these lyrics|finish these lyrics|copy the lyrics|full lyrics)\b/.test(text) ? 'copyrighted_lyrics' : undefined,
      /\b(ownership|license|commercial rights|royalty)\b/.test(text) ? 'rights_claim' : undefined
    ].filter(Boolean);

    return {
      domain: 'music',
      component: 'MusicCopyrightGuardrails',
      risks,
      allow: !risks.includes('artist_cloning') && !risks.includes('copyrighted_lyrics'),
      guidance: [
        'Use style traits, era references, instrumentation, tempo, mood, and mix direction instead of naming a living artist to imitate.',
        'Do not continue or reproduce copyrighted lyrics.',
        'For Suno or generated music ownership, check the platform terms that are current for the account and plan.'
      ]
    };
  }
}
