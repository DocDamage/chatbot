export class SunoSongStructurePlanner {
  plan(input: string) {
    const instrumental = /\binstrumental\b/i.test(input);
    return {
      component: 'SunoSongStructurePlanner',
      structure: instrumental
        ? ['[Intro] atmosphere', '[A] groove enters', '[B] bigger melodic layer', '[Breakdown] stripped drums', '[Final] full arrangement']
        : ['[Intro] mood and texture', '[Verse] sparse rhythm', '[Hook] main vocal idea', '[Bridge] contrast/tension', '[Final Hook] doubled energy'],
      note: 'Use section tags to communicate arrangement energy, not copyrighted form or lyrics.'
    };
  }
}
