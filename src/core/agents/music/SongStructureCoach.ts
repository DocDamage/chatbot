export class SongStructureCoach {
  plan(input: string) {
    const text = input.toLowerCase();
    const genre = text.includes('trap') ? 'trap' : text.includes('pop') ? 'pop' : text.includes('r&b') ? 'r&b' : 'modern song';
    return {
      domain: 'music',
      component: 'SongStructureCoach',
      genre,
      structure: ['Intro', 'Verse 1', 'Hook', 'Verse 2', 'Hook', 'Bridge or breakdown', 'Final hook/outro'],
      notes: [
        genre === 'trap' ? 'Keep the intro short and let drums/808 define the hook lift.' : 'Make each repeat add a new layer or variation.',
        'Use contrast between verse and hook: density, register, rhythm, or vocal energy.',
        'Mark arrangement changes every 4-8 bars so the loop does not go flat.'
      ]
    };
  }
}
