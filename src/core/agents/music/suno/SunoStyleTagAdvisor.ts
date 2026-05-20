export class SunoStyleTagAdvisor {
  advise(input: string) {
    const text = input.toLowerCase();
    return {
      component: 'SunoStyleTagAdvisor',
      styleTags: [
        text.includes('trap') ? 'dark trap' : 'genre blend',
        text.includes('cinematic') ? 'cinematic' : 'modern production',
        text.includes('female') ? 'female vocal hook' : 'original vocal',
        text.includes('808') ? 'deep 808s' : 'defined low end'
      ],
      avoid: ['living artist names as imitation targets', 'copyrighted lyric references']
    };
  }
}
