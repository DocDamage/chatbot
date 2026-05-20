export class MusicPromptEngineer {
  build(input: string) {
    return {
      domain: 'music',
      component: 'MusicPromptEngineer',
      promptParts: ['genre', 'mood', 'tempo feel', 'instrumentation', 'vocal direction', 'structure', 'mix aesthetic'],
      safePrompt: input
        .replace(/\b(exactly like|clone|impersonate)\b/gi, 'inspired by broad production traits from')
        .replace(/\b(in the voice of)\b/gi, 'with an original vocal tone influenced by'),
      avoid: [
        'living artist impersonation',
        'copyrighted lyric continuation',
        'unclear ownership claims'
      ]
    };
  }
}
