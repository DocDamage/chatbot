export interface VibeInterpretation {
  vibes: string[];
  normalizedHints: string[];
}

const vibeMap: Record<string, string> = {
  dark: 'minor key, lower register, tense textures',
  bouncy: 'swing, syncopation, velocity movement',
  bounce: 'swing, syncopation, velocity movement',
  expensive: 'polished vocal, controlled low end, clean top end, subtle saturation',
  cinematic: 'wide pads, risers, orchestral or percussive accents, dynamic sections',
  gritty: 'saturation, texture, noise, rougher transients',
  spacey: 'delays, reverb, wide pads, filtered highs',
  hard: 'transient punch, strong drums, aggressive low end',
  smooth: 'softer transients, warmer EQ, controlled compression',
  clean: 'gain staging, masking cleanup, controlled low mids',
  muddy: 'low-mid cleanup around 200-500 Hz',
  boxy: 'low-mid resonance cleanup around 200-500 Hz'
};

export class VibeInterpreter {
  interpret(message: string): VibeInterpretation {
    const lower = message.toLowerCase();
    const vibes = Object.keys(vibeMap).filter(vibe => lower.includes(vibe));
    return {
      vibes,
      normalizedHints: vibes.map(vibe => vibeMap[vibe])
    };
  }
}
