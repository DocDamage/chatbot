export class LoudnessTargetTool {
  run(input: Record<string, any> = {}) {
    const query = String(input.query || '').toLowerCase();
    const loudGenre = /\b(trap|edm|drill|club|metal)\b/.test(query);
    return {
      domain: 'music',
      tool: 'LoudnessTargetTool',
      target: loudGenre ? '-9 to -7 LUFS integrated if the mix supports it' : '-14 to -10 LUFS integrated depending on release context',
      truePeak: '-1.0 dBTP safer for lossy streaming',
      caution: 'Do not chase loudness before fixing mix balance, clipping, harshness, or low-end control.'
    };
  }
}
