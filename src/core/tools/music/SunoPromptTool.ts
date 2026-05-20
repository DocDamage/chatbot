export interface SunoPromptInput {
  query?: string;
  genre?: string;
  mood?: string;
  vocal?: string;
}

export class SunoPromptTool {
  run(input: SunoPromptInput = {}) {
    const query = input.query || '';
    const genre = input.genre || this.detectGenre(query);
    const mood = input.mood || this.detectMood(query);
    const vocal = input.vocal || this.detectVocal(query);

    return {
      domain: 'music',
      tool: 'SunoPromptTool',
      prompt: `${mood} ${genre}, modern polished mix, ${vocal}, strong hook, dynamic arrangement, clear section contrast, memorable melodic motif.`,
      styleTags: [genre, mood, vocal, 'polished mix', 'dynamic arrangement'],
      avoid: [
        'Do not reference a living artist directly.',
        'Do not ask for copyrighted lyrics or imitation vocals.',
        'Do not make platform ownership/licensing claims without checking current Suno terms.'
      ]
    };
  }

  private detectGenre(query: string): string {
    if (/\btrap\b/i.test(query)) return 'dark futuristic trap';
    if (/\br&b|rnb\b/i.test(query)) return 'contemporary R&B';
    if (/\bpop\b/i.test(query)) return 'cinematic pop';
    if (/\brock\b/i.test(query)) return 'modern rock';
    return 'genre-blended song';
  }

  private detectMood(query: string): string {
    if (/\bdark|minor|haunting\b/i.test(query)) return 'dark cinematic';
    if (/\bsad|melancholy\b/i.test(query)) return 'melancholic';
    if (/\benergetic|hype\b/i.test(query)) return 'high-energy';
    return 'expressive';
  }

  private detectVocal(query: string): string {
    if (/\bfemale\b/i.test(query)) return 'cinematic female vocals';
    if (/\bmale\b/i.test(query)) return 'emotive male vocals';
    if (/\binstrumental\b/i.test(query)) return 'instrumental focus';
    return 'original vocal direction';
  }
}
